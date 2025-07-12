// OptiOil-API/pages/api/product-documents/[id].ts（完全版）
import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { verifyTokenEnhanced } from '../../../utils/authSecurity';
import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import { deleteFile } from '../../../utils/s3'; // ✅ S3削除用ユーティリティ

const prisma = new PrismaClient();

// ✅ S3使用フラグ
const USE_S3 = process.env.USE_S3_STORAGE === 'true';

interface AuthenticatedUser {
  id: number;
  companyId: number;
  email: string;
}

// 🆕 エラーメッセージ取得用のヘルパー関数
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return String(error);
}

// 🆕 認証エラー判定用の関数
function isAuthError(error: unknown): boolean {
  const message = getErrorMessage(error);
  return message.includes('認証');
}

// 環境変数の取得
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET環境変数が設定されていません');
}
const FRONTEND_URL = process.env.NEXT_PUBLIC_FRONTEND_URL;
    
if (!FRONTEND_URL) {
  throw new Error('NEXT_PUBLIC_FRONTEND_URL環境変数が設定されていません。本番環境では必須です。');
}

function verifyToken(req: NextApiRequest): AuthenticatedUser {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('認証ヘッダーが無効です');
  }

  const token = authHeader.replace('Bearer ', '');
  
  if (!token) {
    throw new Error('認証トークンがありません');
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET!) as any;
    return {
      id: decoded.id || decoded.userId,
      companyId: decoded.companyId,
      email: decoded.email,
    };
  } catch (jwtError) {
    console.error('🚫 JWT検証エラー:', jwtError);
    throw new Error('無効な認証トークンです');
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // 強化されたCORS設定
    res.setHeader('Access-Control-Allow-Origin', FRONTEND_URL!);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, Cache-Control, X-Requested-With');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '86400');

    // プリフライトリクエストの処理
    if (req.method === 'OPTIONS') {
      console.log('🔄 CORS プリフライトリクエスト処理');
      return res.status(200).end();
    }

    console.log('📋 個別ドキュメントAPI呼び出し:', { 
      method: req.method, 
      origin: req.headers.origin 
    });

    const user = verifyTokenEnhanced(req);
    const { id } = req.query;
    
    if (!id || isNaN(Number(id))) {
      return res.status(400).json({ 
        error: '有効なドキュメントIDが必要です',
        message: '有効なドキュメントIDが必要です' 
      });
    }

    const documentId = Number(id);

    if (req.method === 'DELETE') {
      console.log('📋 ドキュメント削除開始:', documentId);
      
      // ドキュメント取得（権限チェック含む）
      const document = await prisma.productDocument.findFirst({
        where: {
          id: documentId,
          companyId: user.companyId,
        },
        include: {
          productMaster: {
            select: {
              name: true,
              code: true
            }
          },
          uploadedBy: {
            select: {
              id: true,
              name: true,
              status: true
            }
          },
          uploadedByAdmin: {
            select: {
              id: true,
              username: true,
              status: true
            }
          }
        }
      });

      if (!document) {
        console.log('🚫 ドキュメントが見つからない:', documentId);
        return res.status(404).json({ 
          error: 'ドキュメントが見つからないか、アクセス権限がありません',
          message: 'ドキュメントが見つからないか、アクセス権限がありません' 
        });
      }

      // 管理者がアップロードしたファイルは削除禁止
      if (document.uploadedByAdminId && !document.uploadedById) {
        console.log('🚫 管理者アップロードファイルの削除は禁止:', {
          documentId,
          uploadedByAdminId: document.uploadedByAdminId,
          adminName: document.uploadedByAdmin?.username
        });
        return res.status(403).json({ 
          error: '管理者がアップロードしたファイルはユーザーからは削除できません',
          message: '管理者がアップロードしたファイルはユーザーからは削除できません',
          uploaderInfo: {
            type: 'admin',
            name: document.uploadedByAdmin?.username || '不明な管理者'
          }
        });
      }

      // 自分がアップロードしたファイルのみ削除可能
      if (document.uploadedById !== user.id) {
        console.log('🚫 他のユーザーのファイル削除は禁止:', {
          documentId,
          uploadedById: document.uploadedById,
          requestUserId: user.id
        });
        return res.status(403).json({ 
          error: '他のユーザーがアップロードしたファイルは削除できません',
          message: '他のユーザーがアップロードしたファイルは削除できません'
        });
      }

      console.log('📋 関連資料削除:', {
        documentId,
        filename: document.filename,
        productName: document.productMaster?.name,
        productCode: document.productMaster?.code
      });

      // ✅ S3ファイルの削除処理
      if (USE_S3 && document.s3Url) {
        try {
          // S3 URLからキーを抽出
          const url = new URL(document.s3Url);
          const s3Key = decodeURIComponent(url.pathname.substring(1)); // 先頭の/を除去
          
          await deleteFile(s3Key);
          console.log('✅ S3ファイル削除完了:', s3Key);
        } catch (s3Error) {
          console.error('❌ S3ファイル削除エラー:', s3Error);
          // S3削除に失敗してもDBからは削除する
        }
      }

      // 物理ファイルの削除（ローカル保存の場合）
      if (document.storedFilename) {
        try {
          const filePath = path.join(process.cwd(), 'uploads/product-documents', document.storedFilename);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log('✅ ローカルファイル削除完了:', filePath);
          } else {
            console.log('⚠️ ローカルファイルが存在しません:', filePath);
          }
        } catch (fileError) {
          console.error('❌ ローカルファイル削除エラー:', fileError);
          // ファイル削除に失敗してもDBからは削除する
        }
      }

      // データベースから削除
      await prisma.productDocument.delete({
        where: { id: documentId },
      });

      console.log('✅ DB削除完了');

      return res.status(200).json({ 
        message: '関連資料が削除されました',
        success: true 
      });

    } else {
      console.log('🚫 許可されていないメソッド:', req.method);
      res.setHeader('Allow', ['DELETE']);
      return res.status(405).json({ 
        error: `メソッド ${req.method} は許可されていません`,
        message: `メソッド ${req.method} は許可されていません` 
      });
    }

  } catch (error) {
    console.error('❌ 個別ドキュメントAPI エラー:', error);
    
    // ✅ 修正：型安全なエラーハンドリング
    if (isAuthError(error)) {
      return res.status(401).json({ 
        error: getErrorMessage(error),
        message: getErrorMessage(error) 
      });
    }
    
    return res.status(500).json({ 
      error: 'サーバーエラーが発生しました',
      message: 'サーバーエラーが発生しました',
      details: process.env.NODE_ENV === 'development' ? getErrorMessage(error) : undefined
    });
  } finally {
    await prisma.$disconnect();
  }
}