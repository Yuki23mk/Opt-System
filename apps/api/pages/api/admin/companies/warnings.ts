// OptiOil-API/pages/api/admin/companies/warnings.ts
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

interface CompanyWarning {
  companyId: number;
  companyName: string;
  warnings: {
    unsetPrice: { count: number; hasWarning: boolean };
    noProducts: { count: number; hasWarning: boolean };
    expiringQuotation: { count: number; hasWarning: boolean };
    unsetQuotationExpiry: { count: number; hasWarning: boolean }; // 🆕 見積期限未設定
  };
  totalWarnings: number;
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
  // CORSミドルウェアの実行
  try {
    await runMiddleware(req, res);
  } catch (error) {
    console.error('CORS error in [API名] API:', error);
    return res.status(403).json({ error: 'CORS error' });
  }
  // CORSここまで

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 管理者認証
    const adminUser = await verifyAdminToken(req);
    if (!adminUser) {
      return res.status(401).json({ error: 'Invalid admin token' });
    }

    // 全会社を取得
    const companies = await prisma.company.findMany({
      include: {
        _count: {
          select: {
            companyProducts: {
              where: { enabled: true }
            }
          }
        }
      }
    });

    const oneMonthFromNow = new Date();
    oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);

    const warnings: CompanyWarning[] = [];

    for (const company of companies) {
      const companyWarning: CompanyWarning = {
        companyId: company.id,
        companyName: company.name,
        warnings: {
          unsetPrice: { count: 0, hasWarning: false },
          noProducts: { count: 0, hasWarning: false },
          expiringQuotation: { count: 0, hasWarning: false },
          unsetQuotationExpiry: { count: 0, hasWarning: false } // 🆕 見積期限未設定
        },
        totalWarnings: 0
      };

      // 1. 価格未設定チェック
      const unsetPriceCount = await prisma.companyProduct.count({
        where: {
          companyId: company.id,
          enabled: true,
          price: null
        }
      });

      if (unsetPriceCount > 0) {
        companyWarning.warnings.unsetPrice = {
          count: unsetPriceCount,
          hasWarning: true
        };
      }

      // 2. 商品表示数0チェック
      const enabledProductsCount = company._count.companyProducts;
      if (enabledProductsCount === 0) {
        companyWarning.warnings.noProducts = {
          count: 0,
          hasWarning: true
        };
      }

// 3. 見積期限1ヶ月以内チェック（🔧修正：スケジュール設定済みは除外）
      const expiringQuotationsData = await prisma.companyProduct.findMany({
        where: {
          companyId: company.id,
          enabled: true,
          quotationExpiryDate: {
            lte: oneMonthFromNow,
            gte: new Date()
          }
        },
        include: {
          priceSchedules: {
            where: {
              effectiveDate: {
                gte: new Date(),
                lte: oneMonthFromNow
              },
              isApplied: false
            }
          }
        }
      });

      // 🔧 修正：スケジュール設定がない商品のみカウント
      const expiringQuotationsCount = expiringQuotationsData.filter(cp => 
        cp.priceSchedules.length === 0
      ).length;

      if (expiringQuotationsCount > 0) {
        companyWarning.warnings.expiringQuotation = {
          count: expiringQuotationsCount,
          hasWarning: true
        };
      }
      
      // 4. 🆕 見積期限未設定チェック
      const unsetQuotationExpiryCount = await prisma.companyProduct.count({
        where: {
          companyId: company.id,
          enabled: true,
          quotationExpiryDate: null
        }
      });

      if (unsetQuotationExpiryCount > 0) {
        companyWarning.warnings.unsetQuotationExpiry = {
          count: unsetQuotationExpiryCount,
          hasWarning: true
        };
      }

      // 警告総数計算
      companyWarning.totalWarnings = 
        (companyWarning.warnings.unsetPrice.hasWarning ? 1 : 0) +
        (companyWarning.warnings.noProducts.hasWarning ? 1 : 0) +
        (companyWarning.warnings.expiringQuotation.hasWarning ? 1 : 0) +
        (companyWarning.warnings.unsetQuotationExpiry.hasWarning ? 1 : 0); // 🆕 見積期限未設定も含める

      // 警告がある会社のみ追加
      if (companyWarning.totalWarnings > 0) {
        warnings.push(companyWarning);
      }
    }

    // 統計情報
    const summary = {
      totalCompaniesWithWarnings: warnings.length,
      totalCompanies: companies.length,
      warningTypes: {
        unsetPrice: warnings.filter(w => w.warnings.unsetPrice.hasWarning).length,
        noProducts: warnings.filter(w => w.warnings.noProducts.hasWarning).length,
        expiringQuotation: warnings.filter(w => w.warnings.expiringQuotation.hasWarning).length,
        unsetQuotationExpiry: warnings.filter(w => w.warnings.unsetQuotationExpiry.hasWarning).length // 🆕 見積期限未設定
      }
    };

    res.status(200).json({
      warnings,
      summary,
      companyWarningMap: Object.fromEntries(
        warnings.map(w => [w.companyId, w])
      )
    });

  } catch (error) {
    console.error('Company warnings error:', error);
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