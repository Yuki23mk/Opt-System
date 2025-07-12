import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { verifyTokenEnhanced, handleSecurityError } from '../../../utils/authSecurity';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // 🔒 セキュリティ強化されたCORS設定
    const FRONTEND_URL = process.env.NEXT_PUBLIC_FRONTEND_URL;
    
    if (!FRONTEND_URL) {
      throw new Error('NEXT_PUBLIC_FRONTEND_URL環境変数が設定されていません。本番環境では必須です。');
    }
    res.setHeader('Access-Control-Allow-Origin', FRONTEND_URL);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    // 🔒 セキュリティ強化された認証
    const user = verifyTokenEnhanced(req);
    const cartId = parseInt(req.query.id as string);

    if (isNaN(cartId)) {
      return res.status(400).json({ message: '無効なカートIDです' });
    }

    // カートアイテムの所有者確認
    const cartItem = await prisma.cart.findFirst({
      where: {
        id: cartId,
        userId: user.id,
      },
    });

    if (!cartItem) {
      return res.status(404).json({ message: 'カートアイテムが見つかりません' });
    }

    if (req.method === 'PUT') {
      // カートアイテムの数量更新
      const { quantity } = req.body;

      if (!quantity || quantity < 1) {
        return res.status(400).json({ message: '数量は1以上である必要があります' });
      }

      console.log('カート数量更新:', {
        cartId,
        oldQuantity: cartItem.quantity,
        newQuantity: quantity,
        userId: user.id,
      });

      const updatedCartItem = await prisma.cart.update({
        where: {
          id: cartId,
        },
        data: {
          quantity: quantity,
        },
        include: {
          companyProduct: {
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
                },
              },
            },
          },
        },
      });

      console.log('✅ カート数量更新成功:', updatedCartItem.id);

      return res.status(200).json({
        message: '数量を更新しました',
        data: {
          id: updatedCartItem.id,
          quantity: updatedCartItem.quantity,
          companyProduct: {
            id: updatedCartItem.companyProduct.id,
            price: updatedCartItem.companyProduct.price,
            enabled: updatedCartItem.companyProduct.enabled,
            productMaster: updatedCartItem.companyProduct.productMaster,
          },
          createdAt: updatedCartItem.createdAt,
        },
      });

    } else if (req.method === 'DELETE') {
      // カートアイテムの削除
      console.log('カートアイテム削除:', {
        cartId,
        userId: user.id,
      });

      await prisma.cart.delete({
        where: {
          id: cartId,
        },
      });

      console.log('✅ カートアイテム削除成功:', cartId);

      return res.status(200).json({
        message: 'カートから削除しました',
        deletedId: cartId,
      });

    } else {
      res.status(405).json({ message: '許可されていないメソッドです' });
    }
  } catch (error) {
    // 🔒 セキュリティ強化されたエラーハンドリング
    return handleSecurityError(res, error, req);
  } finally {
    await prisma.$disconnect();
  }
}