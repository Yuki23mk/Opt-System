/**
 * ファイルパス: OptiOil-API/pages/api/admin/orders/[id]/status.ts
 * 管理者用 - 注文ステータス更新API（修正版）
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { runMiddleware } from '../../../../../lib/cors';
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

    // ✅ 修正: 有効なステータスリストを拡張（bulk-status.tsと同じ定義）
    const validStatuses = [
      'pending',              // 注文受付
      'confirmed',            // 注文確定
      'processing',           // 商品手配中
      'shipped',              // 発送済み
      'partially_delivered',  // 一部納品済み(分納の場合) ← 追加
      'delivered',            // 配送完了
      'cancel_requested',     // キャンセル申請中 ← 追加
      'cancelled',            // キャンセル
      'cancel_rejected'       // キャンセル拒否 ← 追加
    ];

    if (!validStatuses.includes(status)) {
      console.error('❌ 無効なステータス:', status, '有効なステータス:', validStatuses);
      return res.status(400).json({ 
        error: '無効なステータスです',
        validStatuses: validStatuses,
        receivedStatus: status
      });
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
    return res.status(500).json({ 
      error: 'サーバーエラーが発生しました',
      details: process.env.NODE_ENV === 'development' ? getErrorMessage(error) : undefined
    });
  } finally {
    await prisma.$disconnect();
  }
}