/**
 * ファイルパス: OptiOil-API/pages/api/admin/orders/[id]/status.ts
 * 管理者用 - 注文ステータス更新API
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { runMiddleware } from '../../../../../lib/cors'; // 🔧 追加
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // 🔧 既存のCORSライブラリを使用
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
      jwt.verify(token, ADMIN_JWT_SECRET);
    } catch (error) {
      return res.status(401).json({ error: '無効な管理者トークンです' });
    }

    const { id } = req.query;
    const { status } = req.body;

    if (!id || isNaN(Number(id))) {
      return res.status(400).json({ error: '有効な注文IDが必要です' });
    }

    if (!status) {
      return res.status(400).json({ error: 'ステータスが必要です' });
    }

    const orderId = Number(id);

    // 有効なステータスかチェック
    const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: '無効なステータスです' });
    }

    // 注文存在チェック
    const existingOrder = await prisma.order.findUnique({
      where: { id: orderId }
    });

    if (!existingOrder) {
      return res.status(404).json({ error: '注文が見つかりません' });
    }

    // ステータス更新
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: { 
        status,
        updatedAt: new Date()
      }
    });

    console.log(`✅ 管理者：注文ステータス更新 ${orderId} -> ${status}`);
    return res.status(200).json({ 
      message: 'ステータスを更新しました',
      order: updatedOrder
    });

  } catch (error) {
    console.error('❌ 管理者ステータス更新API エラー:', error);
    return res.status(500).json({ error: 'サーバーエラーが発生しました' });
  } finally {
    await prisma.$disconnect();
  }
}