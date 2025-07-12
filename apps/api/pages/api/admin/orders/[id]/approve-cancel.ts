/**
 * ファイルパス: OptiOil-API/pages/api/admin/orders/[id]/approve-cancel.ts
 * 管理者用 - キャンセル承認API
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

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'POSTメソッドのみ許可されています' });
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
    if (!id || isNaN(Number(id))) {
      return res.status(400).json({ error: '有効な注文IDが必要です' });
    }

    const orderId = Number(id);

    // 注文存在チェック
    const order = await prisma.order.findUnique({
      where: { id: orderId }
    });

    if (!order) {
      return res.status(404).json({ error: '注文が見つかりません' });
    }

    // キャンセル申請中かチェック
    if (order.status !== 'cancel_requested') {
      return res.status(400).json({ error: 'キャンセル申請中の注文ではありません' });
    }

    // キャンセル承認
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: { 
        status: 'cancelled',
        updatedAt: new Date()
      }
    });

    console.log(`✅ 管理者：キャンセル承認 ${orderId}`);
    return res.status(200).json({ 
      message: 'キャンセルを承認しました',
      order: updatedOrder
    });

  } catch (error) {
    console.error('❌ 管理者キャンセル承認API エラー:', error);
    return res.status(500).json({ error: 'サーバーエラーが発生しました' });
  } finally {
    await prisma.$disconnect();
  }
}