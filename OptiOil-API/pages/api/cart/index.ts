import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { verifyTokenEnhanced, handleSecurityError } from '../../../utils/authSecurity';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

interface AuthenticatedUser {
  id: number;
  companyId: number;
}

// JWT検証関数
function verifyToken(req: NextApiRequest): AuthenticatedUser {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    throw new Error('認証トークンがありません');
  }

  try {
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET環境変数が設定されていません');
}
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    return {
      id: decoded.id || decoded.userId,
      companyId: decoded.companyId,
    };
  } catch (error) {
    throw new Error('無効な認証トークンです');
  }
}

// エラーハンドラー
function handleError(res: NextApiResponse, error: any) {
  console.error('Cart API Error:', error);
  
  if (error.message === '認証トークンがありません' || error.message === '無効な認証トークンです') {
    return res.status(401).json({ message: error.message });
  }
  
  res.status(500).json({ 
    message: 'サーバーエラーが発生しました',
    error: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // CORS設定
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

    const user = verifyTokenEnhanced(req);

    if (req.method === 'GET') {
      // カート一覧取得
      const cartItems = await prisma.cart.findMany({
        where: {
          userId: user.id,
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
                  packageType: true, // 荷姿項目追加
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      const responseData = cartItems.map(item => ({
        id: item.id,
        quantity: item.quantity,
        companyProduct: {
          id: item.companyProduct.id,
          price: item.companyProduct.price,
          enabled: item.companyProduct.enabled,
          productMaster: item.companyProduct.productMaster,
        },
        createdAt: item.createdAt,
      }));

      return res.status(200).json(responseData);

    } else if (req.method === 'POST') {
      // カートに追加
      const { companyProductId, quantity = 1 } = req.body;

      if (!companyProductId) {
        return res.status(400).json({ message: 'CompanyProduct IDが必要です' });
      }

      console.log('カート追加リクエスト:', {
        companyProductId,
        quantity,
        userId: user.id,
        companyId: user.companyId,
      });

      // CompanyProductの存在確認
      const companyProduct = await prisma.companyProduct.findFirst({
        where: {
          id: companyProductId,
          companyId: user.companyId,
          enabled: true, // 使用中の製品のみ
        },
        include: {
          productMaster: true,
        },
      });

      if (!companyProduct) {
        return res.status(404).json({ message: '指定された製品が見つからないか、使用中止です' });
      }

      // 既存のカートアイテムがあるかチェック
      const existingCartItem = await prisma.cart.findFirst({
        where: {
          userId: user.id,
          companyProductId: companyProductId,
        },
      });

      let cartItem;

      if (existingCartItem) {
        // 既存アイテムの数量を更新
        cartItem = await prisma.cart.update({
          where: {
            id: existingCartItem.id,
          },
          data: {
            quantity: existingCartItem.quantity + quantity,
          },
          include: {
            companyProduct: {
              include: {
                productMaster: true,
              },
            },
          },
        });
      } else {
        // 新規カートアイテム作成
        cartItem = await prisma.cart.create({
          data: {
            userId: user.id,
            companyProductId: companyProductId,
            quantity: quantity,
          },
          include: {
            companyProduct: {
              include: {
                productMaster: true,
              },
            },
          },
        });
      }

      console.log('✅ カート追加成功:', cartItem.id);

      return res.status(201).json({
        message: 'カートに追加しました',
        data: {
          id: cartItem.id,
          quantity: cartItem.quantity,
          companyProduct: {
            id: cartItem.companyProduct.id,
            price: cartItem.companyProduct.price,
            enabled: cartItem.companyProduct.enabled,
            productMaster: cartItem.companyProduct.productMaster,
          },
          createdAt: cartItem.createdAt,
        },
      });

    } else {
      res.status(405).json({ message: '許可されていないメソッドです' });
    }
  } catch (error) {
    return handleSecurityError(res, error, req);
  } finally {
    await prisma.$disconnect();
  }
}