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

// ✅ 削除済みユーザー表示用のフォーマット関数
const formatUserForDisplay = (user: any) => {
  if (!user) return null;
  
  return {
    ...user,
    isDeleted: user.status === "deleted",
    displayName: user.status === "deleted" ? "削除済みアカウント" : user.name
  };
};

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
    res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    const user = await verifyTokenAndGetUser(req); // ← 変更：async/awaitを使用
    const { productId, tagId } = req.query;
    
    console.log('個別タグAPI呼び出し:', { 
      method: req.method, 
      productId, 
      tagId,
      userId: user.id, 
      systemRole: user.systemRole 
    });
    
    if (!productId || isNaN(Number(productId)) || !tagId || isNaN(Number(tagId))) {
      return res.status(400).json({ message: '有効な商品IDとタグIDが必要です' });
    }

    const productMasterId = Number(productId);
    const tagIdNum = Number(tagId);

    // タグが存在し、ユーザーがアクセス可能かチェック
    const tag = await prisma.userTag.findFirst({
      where: {
        id: tagIdNum,
        productMasterId: productMasterId,
        companyId: user.companyId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            status: true,  // ✅ 削除済み判定用のstatusを追加
          },
        },
      },
    });

    if (!tag) {
      return res.status(404).json({ message: 'タグが見つからないか、アクセス権限がありません' });
    }

    if (req.method === 'GET') {
      // 個別タグ取得（メイン・サブ両方OK）
      const formattedUser = formatUserForDisplay(tag.user);

      res.status(200).json({
        id: tag.id,
        name: tag.name,
        color: tag.color,
        createdBy: formattedUser?.displayName || '不明', // ✅ フォーマット適用
        createdById: tag.user?.id || 0,
        createdAt: tag.createdAt,
      });

    } else if (req.method === 'PUT') {
      // ✅ メインアカウントのみタグ編集可能
      if (user.systemRole !== 'main') {
        console.log('🚫 サブアカウントによるタグ編集を拒否:', user.systemRole);
        return res.status(403).json({ 
          message: 'タグの編集はメインアカウントのみ可能です' 
        });
      }

      const { name, color = 'blue' } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({ message: 'タグ名が必要です' });
      }

      // 作成者本人のみ編集可能
      if (tag.userId !== user.id) {
        return res.status(403).json({ message: 'このタグを編集する権限がありません' });
      }

      // 有効な色かチェック
      const validColors = ['blue', 'green', 'yellow', 'red', 'purple', 'pink', 'indigo', 'orange', 'teal', 'gray'];
      const tagColor = validColors.includes(color) ? color : 'blue';

      // 同じ名前の他のタグが存在するかチェック（自分以外）
      if (name.trim() !== tag.name) {
        const existingTag = await prisma.userTag.findFirst({
          where: {
            productMasterId: productMasterId,
            userId: user.id,
            name: name.trim(),
            id: {
              not: tagIdNum,
            },
          },
        });

        if (existingTag) {
          return res.status(409).json({ message: '同じ名前のタグが既に存在します' });
        }
      }

      const updatedTag = await prisma.userTag.update({
        where: {
          id: tagIdNum,
        },
        data: {
          name: name.trim(),
          color: tagColor,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              status: true,  // ✅ 削除済み判定用のstatusを追加
            },
          },
        },
      });

      console.log('✅ タグ編集成功:', updatedTag);

      // ✅ レスポンスでも削除済みユーザー表示対応
      const formattedUser = formatUserForDisplay(updatedTag.user);

      res.status(200).json({
        id: updatedTag.id,
        name: updatedTag.name,
        color: updatedTag.color,
        createdBy: formattedUser?.displayName || '不明', // ✅ フォーマット適用
        createdById: updatedTag.user?.id || 0,
        createdAt: updatedTag.createdAt,
        message: 'タグが更新されました',
      });

    } else if (req.method === 'DELETE') {
      // ✅ メインアカウントのみタグ削除可能
      if (user.systemRole !== 'main') {
        console.log('🚫 サブアカウントによるタグ削除を拒否:', user.systemRole);
        return res.status(403).json({ 
          message: 'タグの削除はメインアカウントのみ可能です' 
        });
      }

      // 作成者本人のみ削除可能
      if (tag.userId !== user.id) {
        return res.status(403).json({ message: 'このタグを削除する権限がありません' });
      }

      await prisma.userTag.delete({
        where: {
          id: tagIdNum,
        },
      });

      console.log('✅ タグ削除成功:', { tagId: tagIdNum, name: tag.name });

      res.status(200).json({ message: 'タグが削除されました' });

    } else {
      res.status(405).json({ message: '許可されていないメソッドです' });
    }
  } catch (error) {
    console.error('User Tag Detail API Error:', error);
    return handleSecurityError(res, error, req);
  } finally {
    await prisma.$disconnect();
  }
}