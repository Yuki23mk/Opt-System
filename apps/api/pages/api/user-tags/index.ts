// OptiOil-API/pages/api/user-tags/index.ts (TypeScriptエラー修正版)

import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

// 🆕 エラーメッセージ取得用のヘルパー関数
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return String(error);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // CORS設定を追加
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    // JWT認証
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      console.log('❌ トークンが見つかりません');
      return res.status(401).json({ error: 'トークンが必要です' });
    }

    console.log('🔍 受信したトークン:', token.substring(0, 20) + '...');

    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) {
      throw new Error('JWT_SECRET環境変数が設定されていません');
    }
    
    const decoded = jwt.verify(token, JWT_SECRET!) as any; // ✅ Non-null assertion
    const userId = decoded.id;
    const companyId = decoded.companyId;

    console.log('✅ 認証成功 - ユーザー:', userId, '会社:', companyId);

    if (req.method === 'GET') {
      // ユーザータグ一覧取得
      console.log('📥 タグ一覧取得開始');
      const userTags = await prisma.userTag.findMany({
        where: {
          companyId: companyId
        },
        include: {
          user: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: {
          createdAt: 'asc'
        }
      });

      console.log(`📤 タグ取得完了: ${userTags.length}件`);
      return res.status(200).json(userTags);

    } else if (req.method === 'POST') {
      // ユーザータグ追加
      const { productMasterId, name, color } = req.body; // ★★★ 変更：productId → productMasterId
      console.log('📥 タグ追加リクエスト:', { productMasterId, name, color });

      if (!productMasterId || !name) {
        return res.status(400).json({ error: 'productMasterIdとnameは必須です' });
      }

      // 重複チェック ★★★ 変更：unique制約名を修正
      const existingTag = await prisma.userTag.findUnique({
        where: {
          productMasterId_userId_name: { // ★★★ 変更：制約名修正
            productMasterId: parseInt(productMasterId), // ★★★ 変更
            userId: userId,
            name: name
          }
        }
      });

      if (existingTag) {
        return res.status(400).json({ error: '同じ名前のタグが既に存在します' });
      }

      const newTag = await prisma.userTag.create({
        data: {
          productMasterId: parseInt(productMasterId), // ★★★ 変更：productId → productMasterId
          userId: userId,
          companyId: companyId,
          name: name,
          color: color || 'blue'
        },
        include: {
          user: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });

      console.log('✅ タグ作成成功:', newTag);
      return res.status(201).json(newTag);

    } else if (req.method === 'PUT') {
      // ユーザータグ編集
      const { id, name, color } = req.body;
      console.log('📥 タグ編集リクエスト:', { id, name, color });

      if (!id || !name) {
        return res.status(400).json({ error: 'idとnameは必須です' });
      }

      // 権限チェック（自分が作成したタグのみ編集可能）
      const tag = await prisma.userTag.findUnique({
        where: { id: parseInt(id) }
      });

      if (!tag || tag.userId !== userId) {
        return res.status(403).json({ error: 'このタグを編集する権限がありません' });
      }

      // 重複チェック（同じ商品で同じユーザーが同じ名前のタグを持っていないか）★★★ 変更
      const existingTag = await prisma.userTag.findUnique({
        where: {
          productMasterId_userId_name: { // ★★★ 変更：制約名修正
            productMasterId: tag.productMasterId, // ★★★ 変更
            userId: userId,
            name: name
          }
        }
      });

      if (existingTag && existingTag.id !== parseInt(id)) {
        return res.status(400).json({ error: '同じ名前のタグが既に存在します' });
      }

      const updatedTag = await prisma.userTag.update({
        where: { id: parseInt(id) },
        data: {
          name: name,
          color: color || tag.color
        },
        include: {
          user: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });

      console.log('✅ タグ更新成功:', updatedTag);
      return res.status(200).json(updatedTag);

    } else if (req.method === 'DELETE') {
      // ユーザータグ削除
      const { id } = req.query;
      console.log('📥 タグ削除リクエスト:', { id });

      if (!id) {
        return res.status(400).json({ error: 'タグIDが必要です' });
      }

      // 権限チェック（自分が作成したタグのみ削除可能）
      const tag = await prisma.userTag.findUnique({
        where: { id: parseInt(id as string) }
      });

      if (!tag || tag.userId !== userId) {
        return res.status(403).json({ error: 'このタグを削除する権限がありません' });
      }

      await prisma.userTag.delete({
        where: { id: parseInt(id as string) }
      });

      console.log('✅ タグ削除成功');
      return res.status(200).json({ message: 'タグが削除されました' });

    } else {
      res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
      return res.status(405).json({ error: 'メソッドが許可されていません' });
    }

  } catch (error) {
    console.error('❌ UserTags API Error:', error);
    // ✅ 修正：型安全なエラーハンドリング
    return res.status(500).json({ 
      error: 'サーバーエラーが発生しました',
      details: process.env.NODE_ENV === 'development' ? getErrorMessage(error) : undefined
    });
  } finally {
    await prisma.$disconnect();
  }
}