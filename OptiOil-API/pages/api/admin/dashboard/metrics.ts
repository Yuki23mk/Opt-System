// pages/api/admin/dashboard/metrics.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { runMiddleware } from '../../../../lib/cors';

const prisma = new PrismaClient();

interface AdminTokenPayload {
  id: number;
  username: string;
  role: string;
  email: string;
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

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    await runMiddleware(req, res);
  } catch (error) {
    console.error('CORS error in [API名] API:', error);
    return res.status(403).json({ error: 'CORS error' });
  }
  
  // GET メソッドのみ許可
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 管理者認証
    const adminUser = await verifyAdminToken(req);
    if (!adminUser) {
      return res.status(401).json({ error: 'Invalid admin token' });
    }

    // 各メトリクスを並行取得
    const [
      totalProducts,
      totalCompanies,
      activeUsers,
      monthlyOrders
    ] = await Promise.all([
      // 1. 登録商品数（AdminProductMaster - アクティブな商品のみ）
      prisma.adminProductMaster.count({
        where: {
          active: true
        }
      }),

      // 2. 登録会社数
      prisma.company.count(),

      // 3. アクティブユーザー数（statusが'active'のユーザー）
      prisma.user.count({
        where: {
          status: 'active'
        }
      }),

      // 4. 今月の受注数
      getCurrentMonthOrderCount()
    ]);

    // レスポンス
    res.status(200).json({
      totalProducts,
      totalCompanies,
      activeUsers,
      monthlyOrders
    });

  } catch (error) {
    console.error('Dashboard metrics error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? getErrorMessage(error) : undefined // 🔧 修正箇所
    });
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * 管理者トークン検証（Pages Router版）
 */
async function verifyAdminToken(req: NextApiRequest): Promise<AdminTokenPayload | null> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);
    
    // ダミートークンの場合（開発用）
    if (token === 'dummy-token') {
      // 開発環境でのみ許可
      if (process.env.NODE_ENV === 'development') {
        return {
          id: 1,
          username: 'admin',
          role: 'super_admin',
          email: 'admin@example.com'
        };
      }
      return null;
    }

    // JWT検証（ADMIN_JWT_SECRET使用）
    const decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET!) as AdminTokenPayload;
    
    // AdminUserテーブルで存在確認
    const adminUser = await prisma.adminUser.findFirst({
      where: {
        id: decoded.id,
        status: 'active'
      }
    });

    if (!adminUser) {
      return null;
    }

    return decoded;
  } catch (error) {
    console.error('Admin token verification error:', error);
    return null;
  }
}

/**
 * 今月の受注数を取得
 */
async function getCurrentMonthOrderCount(): Promise<number> {
  try {
    // 今月の開始日と終了日を計算
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // Orderテーブルから今月のデータを取得
    const orderCount = await prisma.order.count({
      where: {
        createdAt: {
          gte: startOfMonth,
          lte: endOfMonth
        }
      }
    });

    return orderCount;
  } catch (error) {
    console.error('Error getting monthly order count:', error);
    return 0;
  }
}