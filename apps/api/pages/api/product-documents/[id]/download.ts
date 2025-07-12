// OptiOil-API/pages/api/product-documents/[id]/download.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { handleSecurityError } from '../../../../utils/authSecurity';
import fs from 'fs';
import path from 'path';
import { generateDownloadUrl } from '../../../../utils/s3';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

// 環境変数の取得
const FRONTEND_URL = process.env.NEXT_PUBLIC_FRONTEND_URL;
const JWT_SECRET = process.env.JWT_SECRET;

if (!FRONTEND_URL) {
  throw new Error('NEXT_PUBLIC_FRONTEND_URL環境変数が設定されていません。');
}

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET環境変数が設定されていません。');
}

// S3使用フラグ
const USE_S3 = process.env.USE_S3_STORAGE === 'true';

// 認証ユーザーの型
interface AuthenticatedUser {
  id: number;
  companyId: number;
  email: string;
}

// トークン検証関数
function verifyToken(token: string): AuthenticatedUser {
  try {
    const decoded = jwt.verify(token, JWT_SECRET!) as any;
    return {
      id: decoded.id || decoded.userId,
      companyId: decoded.companyId,
      email: decoded.email,
    };
  } catch (error) {
    console.error('❌ JWT検証エラー:', error);
    throw new Error('無効な認証トークンです');
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // CORS設定
    res.setHeader('Access-Control-Allow-Origin', FRONTEND_URL!);
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    if (req.method !== 'GET') {
      return res.status(405).json({ 
        error: 'GETメソッドのみ許可されています',
        message: 'GETメソッドのみ許可されています' 
      });
    }

    // ✅ トークンの取得（クエリパラメータまたはヘッダーから）
    let token = '';
    
    // 1. クエリパラメータから取得を試みる
    if (req.query.token && typeof req.query.token === 'string') {
      token = req.query.token;
      console.log('✅ クエリパラメータからトークン取得');
    }
    // 2. Authorizationヘッダーから取得を試みる
    else if (req.headers.authorization) {
      token = req.headers.authorization.replace('Bearer ', '');
      console.log('✅ ヘッダーからトークン取得');
    }

    if (!token) {
      console.log('❌ トークンが見つかりません');
      throw new Error('認証トークンがありません');
    }

    // トークンを検証してユーザー情報を取得
    const user = verifyToken(token);
    console.log('✅ 認証成功:', { userId: user.id, companyId: user.companyId });

    const { id } = req.query;
    
    if (!id || isNaN(Number(id))) {
      return res.status(400).json({ 
        error: '有効なドキュメントIDが必要です',
        message: '有効なドキュメントIDが必要です' 
      });
    }

    const documentId = Number(id);
    console.log('📋 ファイルダウンロード要求:', {
      documentId,
      userId: user.id,
      companyId: user.companyId,
      useS3: USE_S3,
      preview: req.query.preview
    });

    // ドキュメント情報を取得（権限チェック含む）
    const document = await prisma.productDocument.findFirst({
      where: {
        id: documentId,
        companyId: user.companyId,
      },
      include: {
        productMaster: {
          select: {
            id: true,
            name: true,
            code: true
          }
        }
      }
    });

    if (!document) {
      console.log('🚫 ドキュメントが見つからない:', documentId);
      return res.status(404).json({ 
        error: 'ファイルが見つからないか、アクセス権限がありません',
        message: 'ファイルが見つからないか、アクセス権限がありません' 
      });
    }

    // S3保存されている場合の処理
    if (USE_S3 && document.s3Url) {
      console.log('📥 S3からのダウンロード');

      try {
        // S3 URLからキーを抽出
        const url = new URL(document.s3Url);
        const s3Key = decodeURIComponent(url.pathname.substring(1));
        
        // プレビューの場合の処理
        const isPreview = req.query.preview === 'true';
        
        // 署名付きURLを生成（1時間有効）
        const downloadUrl = generateDownloadUrl(
          s3Key,
          document.filename,
          3600,
          isPreview // プレビューフラグを追加
        );

        console.log('✅ 署名付きURL生成成功');

        if (isPreview) {
          // プレビュー用：URLとメタ情報を返す
          return res.status(200).json({
            url: downloadUrl,
            filename: document.filename,
            mimeType: document.mimeType || 'application/octet-stream'
          });
        } else {
          // ダウンロード用：リダイレクト
          res.setHeader('Cache-Control', 'no-cache');
          return res.redirect(302, downloadUrl);
        }

      } catch (s3Error) {
        console.error('❌ S3ダウンロードURL生成エラー:', s3Error);
        throw new Error('ファイルのダウンロードに失敗しました');
      }
    }

    // ローカルファイルの処理（S3を使用しない場合）
    if (!document.storedFilename) {
      console.error('❌ ファイル情報が不完全です');
      throw new Error('ファイル情報が見つかりません');
    }

    // ファイルパスを構築
    const filePath = path.join(process.cwd(), 'uploads/product-documents', document.storedFilename);
    
    console.log('📋 ローカルファイルパス確認:', {
      storedFilename: document.storedFilename,
      fullPath: filePath,
      exists: fs.existsSync(filePath)
    });
    
    // ファイルの存在確認
    if (!fs.existsSync(filePath)) {
      console.error('❌ ファイルが物理的に存在しません:', filePath);
      return res.status(404).json({ 
        error: 'ファイルが見つかりません',
        message: 'ファイルが見つかりません' 
      });
    }

    // ファイル情報を取得
    const stat = fs.statSync(filePath);
    
    console.log('✅ ローカルファイルダウンロード開始:', {
      documentId,
      filename: document.filename,
      productMasterId: document.productMaster?.id,
      productName: document.productMaster?.name,
      size: stat.size
    });

    // レスポンスヘッダーを設定
    res.setHeader('Content-Type', document.mimeType || 'application/octet-stream');
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(document.filename)}"`);
    res.setHeader('Cache-Control', 'private, max-age=3600');

    // ファイルをストリーミング
    const fileStream = fs.createReadStream(filePath);
    
    fileStream.on('error', (streamError) => {
      console.error('❌ ファイルストリーミングエラー:', streamError);
      if (!res.headersSent) {
        res.status(500).json({ 
          error: 'ファイルの読み取りに失敗しました',
          message: 'ファイルの読み取りに失敗しました' 
        });
      }
    });

    fileStream.pipe(res);

  } catch (error) {
    console.error('❌ ダウンロードAPI エラー:', error);
    
    // ✅ handleSecurityErrorを使用してエラーハンドリング
    return handleSecurityError(res, error, req);
  } finally {
    await prisma.$disconnect();
  }
}