/**
 * ファイルパス: OptiOil-API/pages/api/admin/product-documents/[id].ts
 * 管理者用 - 個別ドキュメント管理API（削除）
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { verifyTokenEnhanced, handleSecurityError } from '../../../../utils/authSecurity';
import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

interface AuthenticatedAdmin {
  id: number;
  username: string;
  role: string;
  isAdmin: boolean;
}

// 🆕 エラーメッセージを安全に取得するヘルパー関数
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown error occurred';
}

function verifyAdminToken(req: NextApiRequest): AuthenticatedAdmin {
  // 🔧 環境変数の取得を適切な位置に移動
  const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET;
  if (!ADMIN_JWT_SECRET) {
    throw new Error('ADMIN_JWT_SECRET環境変数が設定されていません');
  }

  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('管理者認証ヘッダーが無効です');
  }

  const token = authHeader.replace('Bearer ', '');
  
  if (!token) {
    throw new Error('管理者認証トークンがありません');
  }

  try {
    const decoded = jwt.verify(token, ADMIN_JWT_SECRET) as any;
    
    if (!decoded.isAdmin || !['admin', 'super_admin'].includes(decoded.role)) {
      throw new Error('管理者権限が不足しています');
    }
    
    return {
      id: decoded.id,
      username: decoded.username,
      role: decoded.role,
      isAdmin: decoded.isAdmin,
    };
  } catch (jwtError) {
    console.error('🚫 管理者JWT検証エラー:', jwtError);
    throw new Error('無効な管理者トークンです');
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // 🔧 CORS設定（完全環境変数ベース）
    const allowedOrigins = [];
    if (process.env.NEXT_PUBLIC_FRONTEND_URL) {
      allowedOrigins.push(process.env.NEXT_PUBLIC_FRONTEND_URL);
    }
    if (process.env.NEXT_PUBLIC_ADMIN_URL) {
      allowedOrigins.push(process.env.NEXT_PUBLIC_ADMIN_URL);
    }
    
    const corsOrigin = allowedOrigins.length > 0 ? allowedOrigins.join(',') : '*';
    
    res.setHeader('Access-Control-Allow-Origin', corsOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    if (req.method !== 'DELETE') {
      res.setHeader('Allow', ['DELETE']);
      return res.status(405).json({ 
        error: `メソッド ${req.method} は許可されていません`
      });
    }

    console.log('📋 管理者個別ドキュメントAPI呼び出し:', { method: req.method });

    const admin = verifyAdminToken(req);
    const { id } = req.query;
    
    if (!id || isNaN(Number(id))) {
      return res.status(400).json({ 
        error: '有効なドキュメントIDが必要です'
      });
    }

    const documentId = Number(id);

    console.log('📋 管理者ドキュメント削除開始:', {
      documentId,
      adminId: admin.id,
      adminUsername: admin.username
    });
    
    // ★★★ 修正：ドキュメント取得時に管理者/ユーザー情報も確認
    const document = await prisma.productDocument.findUnique({
      where: {
        id: documentId,
      },
      include: {
        productMaster: {
          select: {
            name: true,
            code: true
          }
        },
        company: {
          select: {
            id: true,
            name: true
          }
        },
        uploadedBy: { // ★★★ ユーザー情報
          select: {
            id: true,
            name: true,
            status: true
          }
        },
        uploadedByAdmin: { // ★★★ 管理者情報
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
        error: 'ドキュメントが見つかりません'
      });
    }

    // ★★★ 追加：ユーザーがアップロードしたファイルは削除禁止
    if (document.uploadedById && !document.uploadedByAdminId) {
      console.log('🚫 ユーザーアップロードファイルの削除は禁止:', {
        documentId,
        uploadedByUserId: document.uploadedById,
        uploaderName: document.uploadedBy?.name
      });
      return res.status(403).json({ 
        error: 'ユーザーがアップロードしたファイルは管理者からは削除できません',
        uploaderInfo: {
          type: 'user',
          name: document.uploadedBy?.name || '不明なユーザー'
        }
      });
    }

    // ★★★ 管理者がアップロードしたファイルのみ削除可能
    if (!document.uploadedByAdminId) {
      console.log('🚫 削除権限なし:', {
        documentId,
        uploadedById: document.uploadedById,
        uploadedByAdminId: document.uploadedByAdminId
      });
      return res.status(403).json({ 
        error: '削除権限がありません'
      });
    }

    console.log('📋 管理者資料削除:', {
      documentId,
      filename: document.filename,
      productName: document.productMaster?.name,
      productCode: document.productMaster?.code,
      companyName: document.company?.name,
      uploadedByAdmin: document.uploadedByAdmin?.username
    });

    // 物理ファイルの削除
    try {
      const filePath = path.join(process.cwd(), 'uploads/product-documents', document.storedFilename || '');
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log('✅ 物理ファイル削除完了:', filePath);
      } else {
        console.log('⚠️ 物理ファイルが存在しません:', filePath);
      }
    } catch (fileError) {
      console.error('❌ ファイル削除エラー:', fileError);
      // ファイル削除に失敗してもDBからは削除する
    }

    // データベースから削除
    await prisma.productDocument.delete({
      where: { id: documentId },
    });

    console.log('✅ 管理者DB削除完了');

    return res.status(200).json({ 
      success: true,
      message: '商品資料が削除されました',
    });

  } catch (error) {
    console.error('❌ 管理者個別ドキュメントAPI エラー:', error);
    
    const errorMessage = getErrorMessage(error); // 🔧 型安全なエラーメッセージ取得
    
    if (errorMessage.includes('管理者')) {
      return res.status(401).json({ 
        error: errorMessage,
        success: false
      });
    }
    
    return res.status(500).json({ 
      error: 'サーバーエラーが発生しました',
      success: false,
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined // 🔧 型安全なエラーハンドリング
    });
  } finally {
    await prisma.$disconnect();
  }
}