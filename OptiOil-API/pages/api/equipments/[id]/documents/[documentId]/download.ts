import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from "../../../../../../lib/prisma";
import { verifyToken } from "../../../../../../lib/auth/jwt";
import { generateDownloadUrl } from "../../../../../../utils/s3";

// 型安全エラーハンドリング関数
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown error occurred';
}

// CORS対応関数
function setCorsHeaders(res: NextApiResponse) {
  res.setHeader('Access-Control-Allow-Origin', process.env.NEXT_PUBLIC_FRONTEND_URL!);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // CORS設定
    setCorsHeaders(res);

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    if (req.method !== 'GET') {
      return res.status(405).json({ 
        message: 'GETメソッドのみ許可されています' 
      });
    }

    // トークンの取得（クエリパラメータまたはヘッダーから）
    let token = '';
    
    if (req.query.token && typeof req.query.token === 'string') {
      token = req.query.token;
      console.log('✅ クエリパラメータからトークン取得');
    } else if (req.headers.authorization) {
      token = req.headers.authorization.replace('Bearer ', '');
      console.log('✅ ヘッダーからトークン取得');
    }

    if (!token) {
      console.log('❌ トークンが見つかりません');
      return res.status(401).json({ message: "No token provided" });
    }

    // トークンを検証してユーザー情報を取得
    const user = verifyToken(token);
    if (!user || !user.id || !user.companyId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { id: equipmentId, documentId } = req.query;
    
    if (!equipmentId || !documentId || isNaN(Number(equipmentId)) || isNaN(Number(documentId))) {
      return res.status(400).json({ 
        message: '有効な設備IDとドキュメントIDが必要です' 
      });
    }

    const equipmentIdNum = Number(equipmentId);
    const documentIdNum = Number(documentId);

    console.log('📋 ファイルダウンロード要求:', {
      equipmentId: equipmentIdNum,
      documentId: documentIdNum,
      userId: user.id,
      companyId: user.companyId,
      preview: req.query.preview
    });

    // ドキュメント情報を取得（権限チェック含む）
    const document = await prisma.equipmentDocument.findFirst({
      where: {
        id: documentIdNum,
        equipmentId: equipmentIdNum,
        companyId: user.companyId,
      },
      include: {
        equipment: {
          select: {
            id: true,
            name: true,
            code: true
          }
        }
      }
    });

    if (!document) {
      console.log('🚫 ドキュメントが見つからない:', documentIdNum);
      return res.status(404).json({ 
        message: 'ファイルが見つからないか、アクセス権限がありません' 
      });
    }

    // S3保存されている場合の処理
    if (document.s3Url) {
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
          isPreview
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
        return res.status(500).json({ 
          message: 'ファイルのダウンロードに失敗しました' 
        });
      }
    }

    // S3 URLがない場合
    console.error('❌ ファイル情報が不完全です');
    return res.status(500).json({ 
      message: 'ファイル情報が見つかりません' 
    });

  } catch (error) {
    console.error('❌ ダウンロードAPI エラー:', error);
    return res.status(500).json({ 
      message: getErrorMessage(error),
      details: process.env.NODE_ENV === 'development' ? getErrorMessage(error) : undefined
    });
  } finally {
    await prisma.$disconnect();
  }
}