// OptiOil-API/pages/api/admin/batch/price-schedules.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { runMiddleware } from '../../../../lib/cors'; // 🔧 CORS設定統一
import jwt from 'jsonwebtoken';

interface AdminTokenPayload {
  id: number;
  username: string;
  role: string;
  email: string;
}

// 結果の型定義
interface ScheduleResult {
  success: boolean;
  scheduleId: number;
  companyName?: string;
  productName?: string;
  newPrice?: number;
  effectiveDate?: Date;
  expiryDate?: Date | null;
  error?: string;
}

// エラーメッセージを安全に取得するヘルパー関数
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown error occurred';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 🔧 修正: 統一されたCORS設定を適用
  try {
    await runMiddleware(req, res);
  } catch (error) {
    console.error('CORS error in price-schedules API:', error);
    return res.status(403).json({ error: 'CORS error' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 管理者認証
  const adminUser = await verifyAdminToken(req);
  if (!adminUser) {
    return res.status(401).json({ error: 'Invalid admin token' });
  }

  try {
    const { action } = req.body;

    switch (action) {
      case 'apply_schedules':
        return await applyScheduledPrices(res, adminUser);
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('Batch processing error:', error);
    
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    return res.status(500).json({ 
      error: 'Batch processing failed',
      details: isDevelopment ? getErrorMessage(error) : undefined
    });
  }
}

/**
 * スケジュール価格の適用処理
 */
async function applyScheduledPrices(res: NextApiResponse, adminUser: AdminTokenPayload) {
  const now = new Date();
  
  // 適用対象のスケジュール価格を取得（現在時刻以前で未適用）
  const schedulesToApply = await prisma.companyProductPriceSchedule.findMany({
    where: {
      effectiveDate: {
        lte: now
      },
      isApplied: false
    },
    include: {
      companyProduct: {
        include: {
          company: true,
          productMaster: true
        }
      }
    },
    orderBy: {
      effectiveDate: 'asc'
    }
  });

  if (schedulesToApply.length === 0) {
    return res.status(200).json({
      success: true,
      message: 'No schedules to apply',
      appliedCount: 0
    });
  }

  const results: ScheduleResult[] = [];

  // トランザクションで実行
  await prisma.$transaction(async (tx) => {
    for (const schedule of schedulesToApply) {
      try {
        // 🔧 修正: expiryDateを見積期限として設定
        const updateData: any = { 
          price: schedule.scheduledPrice 
        };
        
        // 🔧 修正: 価格スケジュールのexpiryDateを見積期限として設定
        if (schedule.expiryDate) {
          updateData.quotationExpiryDate = schedule.expiryDate;
        }

        // CompanyProductの価格と見積期限を更新
        await tx.companyProduct.update({
          where: { id: schedule.companyProductId },
          data: updateData
        });

        // スケジュールを適用済みにマーク
        await tx.companyProductPriceSchedule.update({
          where: { id: schedule.id },
          data: { isApplied: true }
        });

        // ログ記録
        const logDetails = `Auto-applied scheduled price: ${schedule.scheduledPrice} for ${schedule.companyProduct.productMaster.name} (${schedule.companyProduct.company.name})` +
          (schedule.expiryDate ? ` with quotation expiry date: ${schedule.expiryDate.toISOString()}` : '');

        await tx.adminOperationLog.create({
          data: {
            adminId: adminUser.id,
            action: 'APPLY_SCHEDULED_PRICE',
            targetType: 'CompanyProduct',
            targetId: schedule.companyProductId,
            details: logDetails
          }
        });

        results.push({
          success: true,
          scheduleId: schedule.id,
          companyName: schedule.companyProduct.company.name,
          productName: schedule.companyProduct.productMaster.name,
          newPrice: schedule.scheduledPrice,
          effectiveDate: schedule.effectiveDate,
          expiryDate: schedule.expiryDate
        });

      } catch (error) {
        console.error(`Failed to apply schedule ${schedule.id}:`, error);
        results.push({
          success: false,
          scheduleId: schedule.id,
          error: getErrorMessage(error)
        });
      }
    }
  });

  return res.status(200).json({
    success: true,
    message: `Applied ${results.filter(r => r.success).length} scheduled prices`,
    appliedCount: results.filter(r => r.success).length,
    failedCount: results.filter(r => !r.success).length,
    details: results
  });
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
    
    // 開発環境でのテスト用トークン
    if (token === 'dummy-token' && process.env.NODE_ENV === 'development') {
      return {
        id: 1,
        username: 'admin',
        role: 'super_admin',
        email: 'admin@example.com'
      };
    }

    const jwtSecret = process.env.ADMIN_JWT_SECRET;
    if (!jwtSecret) {
      console.error('ADMIN_JWT_SECRET not configured');
      return null;
    }

    const decoded = jwt.verify(token, jwtSecret) as AdminTokenPayload;
    
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