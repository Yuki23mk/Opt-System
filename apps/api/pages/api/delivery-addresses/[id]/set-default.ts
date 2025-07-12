// OptiOil-API/pages/api/delivery-addresses/[id]/set-default.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { verifyTokenEnhanced, handleSecurityError } from '../../../../utils/authSecurity';
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
    res.setHeader('Access-Control-Allow-Methods', 'PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    if (req.method !== 'PATCH') {
      return res.status(405).json({ error: 'PATCHメソッドのみ許可されています' });
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

    console.log('🏠 デフォルト設定開始:', { addressId, userId, companyId });

    // ★★★ 変更: 会社レベルでの権限チェック ★★★
    const address = await prisma.address.findFirst({
      where: { 
        id: addressId,
        User: {
          companyId: companyId  // 同じ会社ならデフォルト設定可能
        }
      }
    });

    if (!address) {
      return res.status(404).json({ error: '配送先が見つかりません' });
    }

    // ★★★ 変更: 同じ会社内でのデフォルト設定 ★★★
    await prisma.$transaction(async (tx) => {
      // 同じ会社の他のデフォルトを解除
      await tx.address.updateMany({
        where: { 
          User: {
            companyId: companyId
          },
          id: { not: addressId }
        },
        data: { isDefault: false }
      });

      // 指定した配送先をデフォルトに設定
      await tx.address.update({
        where: { id: addressId },
        data: { isDefault: true }
      });
    });

    console.log('✅ デフォルト配送先設定成功:', addressId);
    return res.status(200).json({ message: 'デフォルト配送先を設定しました' });

  } catch (error) {
    console.error('❌ デフォルト設定API エラー:', error);
    return res.status(500).json({ error: 'サーバーエラーが発生しました' });
  } finally {
    await prisma.$disconnect();
  }
}