/**
 * ファイルパス: OptiOil-API/pages/api/admin/product-masters.ts
 * 管理者用 - 商品マスター一覧取得API
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { verifyTokenEnhanced, handleSecurityError } from '../../../utils/authSecurity';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

// 🆕 型安全エラーハンドリング関数を追加
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown error occurred';
}

// 🔧 環境変数の型安全な取得
const getRequiredEnvVar = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name}環境変数が設定されていません`);
  }
  return value;
};

// 環境変数の取得
const ADMIN_JWT_SECRET = getRequiredEnvVar('ADMIN_JWT_SECRET');

// 🔧 CORS設定を環境変数ベースに変更
const getAllowedOrigins = (): string[] => {
  const origins = [];
  if (process.env.NEXT_PUBLIC_FRONTEND_URL) {
    origins.push(process.env.NEXT_PUBLIC_FRONTEND_URL);
  }
  if (process.env.NEXT_PUBLIC_ADMIN_URL) {
    origins.push(process.env.NEXT_PUBLIC_ADMIN_URL);
  }
  if (process.env.NEXT_PUBLIC_API_URL) {
    origins.push(process.env.NEXT_PUBLIC_API_URL);
  }
  return origins;
};

function verifyAdminToken(req: NextApiRequest) {
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
    
    return decoded;
  } catch (jwtError) {
    console.error('🚫 管理者JWT検証エラー:', getErrorMessage(jwtError));
    throw new Error('無効な管理者トークンです');
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // 🔧 CORS設定（環境変数ベース）
    const allowedOrigins = getAllowedOrigins();
    const origin = req.headers.origin;
    
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
      const corsOrigin = allowedOrigins.length > 0 ? allowedOrigins.join(',') : '*';
      res.setHeader('Access-Control-Allow-Origin', corsOrigin);
    }
    
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    if (req.method !== 'GET') {
      res.setHeader('Allow', ['GET']);
      return res.status(405).json({ 
        error: `メソッド ${req.method} は許可されていません`
      });
    }

    const admin = verifyAdminToken(req);
    console.log('📋 管理者商品マスター一覧取得:', admin.username);

    // 商品マスター一覧を取得
    const productMasters = await prisma.adminProductMaster.findMany({
      orderBy: [
        { active: 'desc' }, // アクティブなものを先に
        { name: 'asc' }     // 名前順
      ]
    });

    console.log('✅ 商品マスター取得完了:', productMasters.length, '件');

    return res.status(200).json(productMasters);

  } catch (error) {
    console.error('❌ 管理者商品マスター一覧API エラー:', getErrorMessage(error));
    
    const errorMessage = getErrorMessage(error);
    if (errorMessage.includes('管理者')) {
      return res.status(401).json({ 
        error: errorMessage
      });
    }
    
    return res.status(500).json({ 
      error: 'サーバーエラーが発生しました',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
    });
  } finally {
    await prisma.$disconnect();
  }
}