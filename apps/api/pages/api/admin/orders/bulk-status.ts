/**
 * ファイルパス: OptiOil-API/pages/api/admin/orders/bulk-status.ts
 * 管理者用 - 注文ステータス一括更新API
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { runMiddleware } from '../../../../lib/cors'; // 🔧 既存のCORSライブラリを使用
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

// 🆕 エラーメッセージを安全に取得するヘルパー関数
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown error occurred';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // 🔧 既存のCORSライブラリを使用（機能を壊さない修正）
    try {
      await runMiddleware(req, res);
    } catch (corsError) {
      console.error('❌ CORS エラー:', corsError);
      return res.status(403).json({ error: 'CORS policy violation' });
    }

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    if (req.method !== 'PUT') {
      return res.status(405).json({ error: 'PUTメソッドのみ許可されています' });
    }

    // 管理者JWT認証
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: '管理者トークンが必要です' });
    }

    const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET;
    if (!ADMIN_JWT_SECRET) {
      throw new Error('ADMIN_JWT_SECRET環境変数が設定されていません');
    }
        
    try {
      const decoded = jwt.verify(token, ADMIN_JWT_SECRET) as any;
      
      if (!decoded.isAdmin || !['admin', 'super_admin'].includes(decoded.role)) {
        return res.status(403).json({ error: '管理者権限が必要です' });
      }
      
    } catch (error) {
      return res.status(401).json({ error: '無効な管理者トークンです' });
    }

    const { orderIds, newStatus } = req.body;

    // パラメータバリデーション
    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({ error: '更新対象の注文IDが必要です' });
    }

    if (!newStatus) {
      return res.status(400).json({ error: 'ステータスが必要です' });
    }

    // 有効なステータスかチェック
    const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(newStatus)) {
      return res.status(400).json({ error: '無効なステータスです' });
    }

    // orderIds を数値配列に変換
    const numericOrderIds = orderIds.map(id => {
      const numericId = Number(id);
      if (isNaN(numericId)) {
        throw new Error(`無効な注文ID: ${id}`);
      }
      return numericId;
    });

    console.log(`📋 一括ステータス更新開始: ${numericOrderIds.length}件 -> ${newStatus}`);

    // 一括更新実行
    const updateResult = await prisma.order.updateMany({
      where: {
        id: {
          in: numericOrderIds
        }
      },
      data: {
        status: newStatus,
        updatedAt: new Date()
      }
    });

    console.log(`✅ 一括ステータス更新完了: ${updateResult.count}件更新`);

    // 更新された注文の詳細を取得（確認用）
    const updatedOrders = await prisma.order.findMany({
      where: {
        id: {
          in: numericOrderIds
        }
      },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        updatedAt: true
      }
    });

    return res.status(200).json({ 
      message: `${updateResult.count}件の注文ステータスを更新しました`,
      updatedCount: updateResult.count,
      requestedCount: numericOrderIds.length,
      updatedOrders: updatedOrders
    });

  } catch (error) {
    console.error('❌ 一括ステータス更新API エラー:', error);
    return res.status(500).json({ 
      error: 'サーバーエラーが発生しました',
      details: process.env.NODE_ENV === 'development' ? getErrorMessage(error) : undefined // 🔧 本番環境では詳細エラーを非表示
    });
  } finally {
    await prisma.$disconnect();
  }
}