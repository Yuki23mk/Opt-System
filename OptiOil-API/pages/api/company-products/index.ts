import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { verifyTokenEnhanced, handleSecurityError } from '../../../utils/authSecurity';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

interface AuthenticatedUser {
  id: number;
  companyId: number;
  email: string;
}

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

// 環境変数の取得
const JWT_SECRET = getRequiredEnvVar('JWT_SECRET');
const FRONTEND_URL = getRequiredEnvVar('NEXT_PUBLIC_FRONTEND_URL');

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
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    return {
      id: decoded.id || decoded.userId,
      companyId: decoded.companyId,
      email: decoded.email,
    };
  } catch (jwtError) {
    console.error('🚫 JWT検証エラー:', getErrorMessage(jwtError));
    throw new Error('無効な認証トークンです');
  }
}

function setCorsHeaders(res: NextApiResponse) {
  const allowedOrigins = getAllowedOrigins();
  const origin = allowedOrigins.length > 0 ? allowedOrigins[0] : FRONTEND_URL;
  
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers', 
    'Content-Type, Authorization, Accept, Cache-Control, X-Requested-With, Origin, X-CSRF-Token'
  );
  res.setHeader('Access-Control-Max-Age', '86400');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 全リクエストにCORSヘッダーを設定
  setCorsHeaders(res);

  // OPTIONSリクエスト（プリフライト）への対応
  if (req.method === 'OPTIONS') {
    console.log("[Company Products API] OPTIONS プリフライトリクエスト受信");
    return res.status(200).end();
  }

  console.log(`[Company Products API] ${req.method} ${req.url} リクエスト受信`);

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    // 認証
    const user = verifyTokenEnhanced(req);
    console.log('✅ 認証成功 - ユーザー:', user.id, '会社:', user.companyId);

    // クエリパラメータの取得
    const { includeDisabled } = req.query;
    const shouldIncludeDisabled = includeDisabled === 'true';

    console.log('📋 Company Products取得開始:', {
      companyId: user.companyId,
      includeDisabled: shouldIncludeDisabled
    });

    // CompanyProductsを取得
    const companyProducts = await prisma.companyProduct.findMany({
      where: {
        companyId: user.companyId,
        ...(shouldIncludeDisabled ? {} : { enabled: true }),
      },
      include: {
        productMaster: {
          select: {
            id: true,
            code: true,
            name: true,
            manufacturer: true,
            capacity: true,
            unit: true,
            oilType: true,
          }
        }
      },
      orderBy: [
        { displayOrder: 'asc' },
        { createdAt: 'desc' }
      ]
    });

    console.log('✅ Company Products取得完了:', companyProducts.length, '件');

    return res.status(200).json(companyProducts);

  } catch (error) {
    console.error('[Company Products API] エラー:', getErrorMessage(error));
    
    const errorMessage = getErrorMessage(error);
    if (errorMessage.includes('認証')) {
      return res.status(401).json({ message: errorMessage });
    }
    
    return res.status(500).json({ 
      message: 'サーバーエラーが発生しました',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
    });
  } finally {
    await prisma.$disconnect();
  }
}