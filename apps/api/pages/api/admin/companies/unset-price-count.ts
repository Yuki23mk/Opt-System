// OptiOil-API/pages/api/admin/companies/unset-price-count.ts
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

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 管理者認証
    const adminUser = await verifyAdminToken(req);
    if (!adminUser) {
      return res.status(401).json({ error: 'Invalid admin token' });
    }

    // 価格未設定の商品を取得
    const unsetPriceProducts = await prisma.companyProduct.findMany({
      where: {
        enabled: true, // 有効な商品のみ
        price: null    // 価格が未設定
      },
      include: {
        company: true,
        productMaster: true
      }
    });

    // 会社別にグループ化
    const companiesWithUnsetPrice = new Map<number, {
      companyId: number;
      companyName: string;
      unsetCount: number;
    }>();

    unsetPriceProducts.forEach(cp => {
      if (!companiesWithUnsetPrice.has(cp.companyId)) {
        companiesWithUnsetPrice.set(cp.companyId, {
          companyId: cp.companyId,
          companyName: cp.company.name,
          unsetCount: 0
        });
      }
      const current = companiesWithUnsetPrice.get(cp.companyId)!;
      current.unsetCount++;
    });

    // 全体の統計
    const totalUnsetCount = unsetPriceProducts.length;
    const affectedCompanyCount = companiesWithUnsetPrice.size;

    // 会社別のデータを配列に変換
    const companiesList = Array.from(companiesWithUnsetPrice.values());

    res.status(200).json({
      total: {
        unsetProductCount: totalUnsetCount,
        affectedCompanyCount: affectedCompanyCount
      },
      companies: companiesList,
      companyMap: Object.fromEntries(
        companiesList.map(c => [c.companyId, c.unsetCount])
      )
    });

  } catch (error) {
    console.error('Unset price count error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? getErrorMessage(error) : undefined // 🔧 修正箇所
    });
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * 管理者トークン検証
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

    const decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET!) as AdminTokenPayload;
    
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