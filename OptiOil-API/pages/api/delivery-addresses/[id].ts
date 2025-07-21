// OptiOil-API/pages/api/delivery-addresses/[id].ts

import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { verifyTokenEnhanced, handleSecurityError } from '../../../utils/authSecurity';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // 環境変数からフロントエンドURLを取得
    const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL;
  
  if (!frontendUrl) {
    throw new Error('NEXT_PUBLIC_FRONTEND_URL環境変数が設定されていません。本番環境では必須です。');
  }
    
    // CORS設定
    res.setHeader('Access-Control-Allow-Origin', frontendUrl);
    res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    // JWT認証
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'トークンが必要です' });
    }

    const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET環境変数が設定されていません');
}
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const userId = decoded.id;
    const companyId = decoded.companyId;

    const { id } = req.query;
    if (!id || isNaN(Number(id))) {
      return res.status(400).json({ error: '有効なIDが必要です' });
    }

    const addressId = Number(id);

    // ★★★ 変更: 会社レベルでの権限チェック ★★★
    const address = await prisma.address.findFirst({
      where: { 
        id: addressId,
        User: {
          companyId: companyId  // 同じ会社なら編集・削除可能
        }
      },
      include: {
        User: {
          select: {
            name: true,
            status: true
          }
        }
      }
    });

    if (!address) {
      return res.status(404).json({ error: '配送先が見つかりません' });
    }

    if (req.method === 'GET') {
      // 個別配送先取得
      return res.status(200).json(address);

    } else if (req.method === 'PUT') {
      // 配送先更新
      const { name, company, zipCode, prefecture, city, address1, address2, phone, isDefault } = req.body;

      if (!name || !zipCode || !address1) {
        return res.status(400).json({ error: '必須項目が不足しています' });
      }

      // ★★★ 変更: デフォルト設定の場合、同じ会社の他のデフォルトを解除 ★★★
      if (isDefault && !address.isDefault) {
        await prisma.address.updateMany({
          where: { 
            User: {
              companyId: companyId
            }
          },
          data: { isDefault: false }
        });
      }

      const updatedAddress = await prisma.address.update({
        where: { id: addressId },
        data: {
          name,
          company: company || null,
          zipCode,
          prefecture: prefecture || '',
          city: city || '',
          address1,
          address2: address2 || null,
          phone: phone || null,
          isDefault: isDefault || false,
        },
      });

      console.log('✅ 配送先更新成功:', addressId);
      return res.status(200).json(updatedAddress);

    } else if (req.method === 'DELETE') {
      // 配送先削除
      // デフォルト配送先は削除不可
      if (address.isDefault) {
        return res.status(400).json({ error: 'デフォルト配送先は削除できません' });
      }

      await prisma.address.delete({
        where: { id: addressId }
      });

      console.log('✅ 配送先削除成功:', addressId);
      return res.status(200).json({ message: '配送先を削除しました' });

    } else {
      res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
      return res.status(405).json({ error: 'メソッドが許可されていません' });
    }

  } catch (error) {
    console.error('❌ 配送先API エラー:', error);
    return res.status(500).json({ error: 'サーバーエラーが発生しました' });
  } finally {
    await prisma.$disconnect();
  }
}