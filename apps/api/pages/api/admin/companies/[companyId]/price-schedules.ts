import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

interface AdminTokenPayload {
  id: number;
  username: string;
  role: string;
  email: string;
}

const setCorsHeaders = (res: NextApiResponse) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { companyId } = req.query;
  const id = parseInt(companyId as string);

  // 管理者認証
  const adminUser = await verifyAdminToken(req);
  if (!adminUser) {
    return res.status(401).json({ error: 'Invalid admin token' });
  }

  if (req.method === 'GET') {
    try {
      // 会社の全商品のスケジュール価格を取得
      const schedules = await prisma.companyProductPriceSchedule.findMany({
        where: {
          companyProduct: {
            companyId: id
          }
        },
        include: {
          companyProduct: {
            include: {
              productMaster: true
            }
          }
        },
        orderBy: {
          effectiveDate: 'asc'
        }
      });

      // companyProductId別にグループ化
      const groupedSchedules: Record<number, any[]> = {};
      
      schedules.forEach(schedule => {
        const companyProductId = schedule.companyProductId;
        if (!groupedSchedules[companyProductId]) {
          groupedSchedules[companyProductId] = [];
        }
        groupedSchedules[companyProductId].push({
          id: schedule.id,
          scheduledPrice: schedule.scheduledPrice,
          effectiveDate: schedule.effectiveDate.toISOString(),
          expiryDate: schedule.expiryDate?.toISOString() || null, // 🆕 追加
          isApplied: schedule.isApplied,
          createdAt: schedule.createdAt.toISOString(),
          productName: schedule.companyProduct.productMaster.name,
          productCode: schedule.companyProduct.productMaster.code,
        });
      });

      return res.status(200).json(groupedSchedules);
    } catch (error) {
      console.error('Error fetching price schedules:', error);
      return res.status(500).json({ error: 'Failed to fetch price schedules' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { companyProductId, scheduledPrice, effectiveDate, expiryDate } = req.body;

      // バリデーション
      if (!companyProductId || !scheduledPrice || !effectiveDate) {
        return res.status(400).json({ error: 'All fields are required' });
      }

      const price = parseFloat(scheduledPrice);
      if (isNaN(price) || price < 0) {
        return res.status(400).json({ error: 'Invalid price value' });
      }

      const effectiveDateObj = new Date(effectiveDate);
      if (effectiveDateObj <= new Date()) {
        return res.status(400).json({ error: 'Effective date must be in the future' });
      }

      // 🆕 expiryDateのバリデーション
      let expiryDateObj = null;
      if (expiryDate) {
        expiryDateObj = new Date(expiryDate);
        if (expiryDateObj <= effectiveDateObj) {
          return res.status(400).json({ error: 'Expiry date must be after effective date' });
        }
      }


      // 該当CompanyProductが存在し、指定会社に属することを確認
      const companyProduct = await prisma.companyProduct.findFirst({
        where: {
          id: companyProductId,
          companyId: id
        }
      });

      if (!companyProduct) {
        return res.status(404).json({ error: 'Company product not found' });
      }

      // 同じ日時の既存スケジュールをチェック
      const existingSchedule = await prisma.companyProductPriceSchedule.findFirst({
        where: {
          companyProductId,
          effectiveDate: effectiveDateObj,
          isApplied: false
        }
      });

      if (existingSchedule) {
        return res.status(400).json({ error: 'Schedule already exists for this date' });
      }

      // スケジュール価格を作成
      const newSchedule = await prisma.companyProductPriceSchedule.create({
        data: {
          companyProductId,
          scheduledPrice: price,
          effectiveDate: effectiveDateObj,
          expiryDate: expiryDateObj, // 🆕 追加
          isApplied: false
        },
        include: {
          companyProduct: {
            include: {
              productMaster: true
            }
          }
        }
      });

      // ログ記録
      await prisma.adminOperationLog.create({
        data: {
          adminId: adminUser.id,
          action: 'CREATE_PRICE_SCHEDULE',
          targetType: 'CompanyProductPriceSchedule',
          targetId: newSchedule.id,
          details: `Company: ${id}, Product: ${newSchedule.companyProduct.productMaster.name}, Price: ${price}, Date: ${effectiveDateObj.toISOString()}`
        }
      });

      return res.status(201).json({
        id: newSchedule.id,
        scheduledPrice: newSchedule.scheduledPrice,
        effectiveDate: newSchedule.effectiveDate.toISOString(),
        expiryDate: newSchedule.expiryDate?.toISOString() || null, // 🆕 追加
        isApplied: newSchedule.isApplied,
        createdAt: newSchedule.createdAt.toISOString(),
        productName: newSchedule.companyProduct.productMaster.name,
        productCode: newSchedule.companyProduct.productMaster.code,
      });
    } catch (error) {
      console.error('Error creating price schedule:', error);
      return res.status(500).json({ error: 'Failed to create price schedule' });
    }
  }

  if (req.method === 'PUT') {
    try {
      const { scheduleId, scheduledPrice, effectiveDate, expiryDate } = req.body;

      if (!scheduleId) {
        return res.status(400).json({ error: 'Schedule ID is required' });
      }

      // 既存スケジュールを確認
      const existingSchedule = await prisma.companyProductPriceSchedule.findFirst({
        where: {
          id: scheduleId,
          companyProduct: {
            companyId: id
          },
          isApplied: false // 適用済みのスケジュールは変更不可
        }
      });

      if (!existingSchedule) {
        return res.status(404).json({ error: 'Schedule not found or already applied' });
      }

      const updateData: any = {};
      
      if (scheduledPrice !== undefined) {
        const price = parseFloat(scheduledPrice);
        if (isNaN(price) || price < 0) {
          return res.status(400).json({ error: 'Invalid price value' });
        }
        updateData.scheduledPrice = price;
      }

      if (effectiveDate !== undefined) {
        const effectiveDateObj = new Date(effectiveDate);
        if (effectiveDateObj <= new Date()) {
          return res.status(400).json({ error: 'Effective date must be in the future' });
        }
        updateData.effectiveDate = effectiveDateObj;
      }

          // 🆕 expiryDateの更新処理
      if (expiryDate !== undefined) {
        if (expiryDate === null) {
          updateData.expiryDate = null;
        } else {
          const expiryDateObj = new Date(expiryDate);
          const effectiveDateToCheck = updateData.effectiveDate || existingSchedule.effectiveDate;
          if (expiryDateObj <= effectiveDateToCheck) {
            return res.status(400).json({ error: 'Expiry date must be after effective date' });
          }
          updateData.expiryDate = expiryDateObj;
        }
      }

      const updatedSchedule = await prisma.companyProductPriceSchedule.update({
        where: { id: scheduleId },
        data: updateData,
        include: {
          companyProduct: {
            include: {
              productMaster: true
            }
          }
        }
      });

      return res.status(200).json({
        id: updatedSchedule.id,
        scheduledPrice: updatedSchedule.scheduledPrice,
        effectiveDate: updatedSchedule.effectiveDate.toISOString(),
        expiryDate: updatedSchedule.expiryDate?.toISOString() || null, // 🆕 追加
        isApplied: updatedSchedule.isApplied,
        productName: updatedSchedule.companyProduct.productMaster.name,
        productCode: updatedSchedule.companyProduct.productMaster.code,
      });
    } catch (error) {
      console.error('Error updating price schedule:', error);
      return res.status(500).json({ error: 'Failed to update price schedule' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { scheduleId } = req.body;

      if (!scheduleId) {
        return res.status(400).json({ error: 'Schedule ID is required' });
      }

      // 削除対象のスケジュールを確認
      const schedule = await prisma.companyProductPriceSchedule.findFirst({
        where: {
          id: scheduleId,
          companyProduct: {
            companyId: id
          },
          isApplied: false // 適用済みのスケジュールは削除不可
        }
      });

      if (!schedule) {
        return res.status(404).json({ error: 'Schedule not found or already applied' });
      }

      await prisma.companyProductPriceSchedule.delete({
        where: { id: scheduleId }
      });

      // ログ記録
      await prisma.adminOperationLog.create({
        data: {
          adminId: adminUser.id,
          action: 'DELETE_PRICE_SCHEDULE',
          targetType: 'CompanyProductPriceSchedule',
          targetId: scheduleId,
          details: `Company: ${id}, Schedule ID: ${scheduleId}`
        }
      });

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error deleting price schedule:', error);
      return res.status(500).json({ error: 'Failed to delete price schedule' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
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