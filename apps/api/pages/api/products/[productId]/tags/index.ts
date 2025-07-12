import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { verifyTokenEnhanced, handleSecurityError } from '../../../../../utils/authSecurity';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

interface AuthenticatedUser {
  id: number;
  companyId: number;
  systemRole?: string; // ← 追加（オプショナル）
}

// JWT検証関数（systemRole対応版）
async function verifyTokenAndGetUser(req: NextApiRequest): Promise<AuthenticatedUser> {
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
    
    const userId = decoded.id || decoded.userId;
    
    // ★★★ データベースからユーザー情報を取得してsystemRoleを確認
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        companyId: true,
        email: true,
        systemRole: true, // ← これが重要
      }
    });

    if (!user) {
      throw new Error('ユーザーが見つかりません');
    }

    return {
      id: user.id,
      companyId: user.companyId,
      systemRole: user.systemRole,
    };
  } catch (error) {
    console.error('JWT検証エラー:', error);
    throw new Error('無効な認証トークンです');
  }
}

// エラーハンドラー
function handleError(res: NextApiResponse, error: any) {
  console.error('API Error:', error);
  
  if (error.message === '認証トークンがありません' || 
      error.message === '無効な認証トークンです' ||
      error.message === 'ユーザーが見つかりません') {
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
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    const user = await verifyTokenAndGetUser(req); // ← 変更：async/awaitを使用
    const { productId } = req.query;
    
    console.log('タグAPI呼び出し:', { 
      method: req.method, 
      productId, 
      userId: user.id, 
      systemRole: user.systemRole 
    });
    
    if (!productId || isNaN(Number(productId))) {
      return res.status(400).json({ message: '有効な商品IDが必要です' });
    }

    const productMasterId = Number(productId);

    if (req.method === 'GET') {
      // タグ一覧取得（メイン・サブ両方OK）
      const tags = await prisma.userTag.findMany({
        where: {
          productMasterId: productMasterId,
          companyId: user.companyId,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
      });

      console.log('取得したタグ:', tags.length);

      const formattedTags = tags.map(tag => ({
        id: tag.id,
        name: tag.name,
        color: tag.color,
        createdBy: tag.user.name,
        createdById: tag.user.id,
        createdAt: tag.createdAt,
      }));

      res.status(200).json(formattedTags);

    } else if (req.method === 'POST') {
      // ✅ メインアカウントのみタグ追加可能
      if (user.systemRole !== 'main') {
        console.log('🚫 サブアカウントによるタグ追加を拒否:', user.systemRole);
        return res.status(403).json({ 
          message: 'タグの追加はメインアカウントのみ可能です' 
        });
      }

      const { name, color = 'blue' } = req.body;

      console.log('タグ追加リクエスト:', { 
        name, 
        color, 
        productMasterId, 
        userId: user.id, 
        companyId: user.companyId,
        systemRole: user.systemRole
      });

      if (!name || !name.trim()) {
        return res.status(400).json({ message: 'タグ名が必要です' });
      }

      // 商品マスターの存在確認
      const productMasterExists = await prisma.adminProductMaster.findUnique({
        where: { id: productMasterId }
      });

      if (!productMasterExists) {
        console.error('商品マスターが見つかりません:', productMasterId);
        return res.status(404).json({ message: '商品が見つかりません' });
      }

      // 有効な色かチェック
      const validColors = ['blue', 'green', 'yellow', 'red', 'purple', 'pink', 'indigo', 'orange', 'teal', 'gray'];
      const tagColor = validColors.includes(color) ? color : 'blue';

      // 同じ名前のタグが既に存在するかチェック
      const existingTag = await prisma.userTag.findFirst({
        where: {
          productMasterId: productMasterId,
          userId: user.id,
          name: name.trim(),
        },
      });

      if (existingTag) {
        return res.status(409).json({ message: '同じ名前のタグが既に存在します' });
      }

      const newTag = await prisma.userTag.create({
        data: {
          productMasterId: productMasterId,
          userId: user.id,
          companyId: user.companyId,
          name: name.trim(),
          color: tagColor,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      console.log('✅ タグ作成成功:', newTag);

      res.status(201).json({
        id: newTag.id,
        name: newTag.name,
        color: newTag.color,
        createdBy: newTag.user.name,
        createdById: newTag.user.id,
        createdAt: newTag.createdAt,
        message: 'タグが追加されました',
      });

    } else {
      res.status(405).json({ message: '許可されていないメソッドです' });
    }
  } catch (error: any) {
    console.error('User Tags API Error:', {
      error: error.message,
      code: error.code,
      productId: req.query.productId,
      userId: req.headers.authorization ? 'トークンあり' : 'トークンなし',
      method: req.method
    });
    
    // Prisma固有のエラーハンドリング
    if (error.code === 'P2003') {
      return res.status(400).json({ 
        message: '関連データが見つかりません。ユーザー、商品、または会社の情報を確認してください。' 
      });
    }
    
    return handleSecurityError(res, error, req);
  } finally {
    await prisma.$disconnect();
  }
}