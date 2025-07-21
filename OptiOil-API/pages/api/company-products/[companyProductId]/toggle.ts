import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { verifyTokenEnhanced, handleSecurityError } from '../../../../utils/authSecurity';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // CORS設定
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'PUT, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    if (req.method !== 'PUT') {
      return res.status(405).json({ message: '許可されていないメソッドです' });
    }

    const user = verifyTokenEnhanced(req);
    const { companyProductId } = req.query;
    const { enabled } = req.body;

    console.log('会社製品状態切り替えAPI呼び出し:', {
      companyProductId,
      enabled,
      userId: user.id,
      companyId: user.companyId,
      userRole: 'メイン・サブアカウント両方可能'
    });

    if (!companyProductId || isNaN(Number(companyProductId))) {
      return res.status(400).json({ message: '有効なCompanyProduct IDが必要です' });
    }

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ message: 'enabled値はboolean型である必要があります' });
    }

    const companyProductIdNum = Number(companyProductId);

    // CompanyProductが存在し、ユーザーの会社に属しているかチェック
    const companyProduct = await prisma.companyProduct.findFirst({
      where: {
        id: companyProductIdNum,
        companyId: user.companyId
      },
      include: {
        productMaster: true
      }
    });

    if (!companyProduct) {
      return res.status(404).json({ 
        message: '製品が見つからないか、アクセス権限がありません' 
      });
    }

    // CompanyProductのenabledフィールドを更新
    const updatedCompanyProduct = await prisma.companyProduct.update({
      where: {
        id: companyProductIdNum
      },
      data: {
        enabled: enabled
      },
      include: {
        productMaster: true
      }
    });

    console.log('会社製品状態更新成功:', {
      companyProductId: updatedCompanyProduct.id,
      productName: updatedCompanyProduct.productMaster.name,
      enabled: updatedCompanyProduct.enabled,
      updatedBy: `ユーザーID: ${user.id}（メイン・サブアカウント両方可能）`
    });

    res.status(200).json({
      message: `製品を${enabled ? '有効' : '無効'}にしました`,
      data: {
        companyProductId: updatedCompanyProduct.id,
        productMasterId: updatedCompanyProduct.productMaster.id,
        name: updatedCompanyProduct.productMaster.name,
        enabled: updatedCompanyProduct.enabled
      }
    });

  } catch (error) {
    console.error('Company Product Toggle API Error:', error);
    return handleSecurityError(res, error, req);
  } finally {
    await prisma.$disconnect();
  }
}