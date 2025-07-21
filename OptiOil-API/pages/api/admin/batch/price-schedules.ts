// OptiOil-API/pages/api/admin/batch/price-schedules.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { runMiddleware } from '../../../../lib/cors';
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

// スケジューラートークン検証関数
async function verifySchedulerToken(req: NextApiRequest): Promise<boolean> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }

  const token = authHeader.substring(7);
  const schedulerSecret = process.env.OPT_SCHEDULER_SECRET;
  
  if (!schedulerSecret) {
    console.error('OPT_SCHEDULER_SECRET not configured');
    return false;
  }
  
  // シークレットトークンでの認証
  return token === schedulerSecret;
}

// 管理者トークン検証
async function verifyAdminToken(req: NextApiRequest): Promise<AdminTokenPayload | null> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);
    
    // スケジューラートークンの場合はJWT検証をスキップ
    if (token === process.env.OPT_SCHEDULER_SECRET) {
      return null;
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // CORS設定
  try {
    await runMiddleware(req, res);
  } catch (error) {
    console.error('CORS error in price-schedules API:', error);
    return res.status(403).json({ error: 'CORS error' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // スケジューラー認証を先にチェック
  let adminUser: AdminTokenPayload | null = null;
  
  const isSchedulerToken = await verifySchedulerToken(req);
  
  if (isSchedulerToken) {
    // スケジューラー経由の場合
    adminUser = {
      id: 0,
      username: 'system-scheduler',
      role: 'super_admin',
      email: 'scheduler@system.local'
    };
  } else {
    // 通常の管理者認証
    adminUser = await verifyAdminToken(req);
  }
  
  if (!adminUser) {
    return res.status(401).json({ error: 'Invalid authentication' });
  }

  try {
    const { action } = req.body;

    switch (action) {
      case 'apply_schedules':
        await applyScheduledPrices(res);
        return;
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
 * CompanyProductPriceScheduleテーブル自体が履歴として機能するため、
 * AdminOperationLogへの記録は行わない
 */
async function applyScheduledPrices(res: NextApiResponse) {
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
    res.status(200).json({
      success: true,
      message: 'No schedules to apply',
      appliedCount: 0
    });
    return;
  }

  const results: ScheduleResult[] = [];

  // トランザクションで実行
  await prisma.$transaction(async (tx) => {
    for (const schedule of schedulesToApply) {
      try {
        // expiryDateを見積期限として設定
        const updateData: any = { 
          price: schedule.scheduledPrice 
        };
        
        // 価格スケジュールのexpiryDateを見積期限として設定
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

  res.status(200).json({
    success: true,
    message: `Applied ${results.filter(r => r.success).length} scheduled prices`,
    appliedCount: results.filter(r => r.success).length,
    failedCount: results.filter(r => !r.success).length,
    details: results
  });
  return;
}