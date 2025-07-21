/**
 * ファイルパス: OptiOil-API/pages/api/orders/[id]/cancel-request.ts
 * キャンセル申請API（理由必須対応版）
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // CORS設定
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'POSTメソッドのみ許可されています' });
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
    const { reason } = req.body;

    if (!id || isNaN(Number(id))) {
      return res.status(400).json({ error: '有効な注文IDが必要です' });
    }

    // キャンセル理由の必須チェック
    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'キャンセル理由が必要です' });
    }

    const orderId = Number(id);

    console.log('🔍 キャンセル申請リクエスト:', {
      orderId,
      userId,
      companyId,
      reason: reason.substring(0, 50) + (reason.length > 50 ? '...' : '')
    });

    // 注文の権限チェック（同じ会社のユーザーのみ）
    const order = await prisma.order.findFirst({
      where: { 
        id: orderId,
        user: { companyId: companyId }
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            companyId: true
          }
        }
      }
    });

    if (!order) {
      console.log('❌ 注文が見つかりません:', { orderId, userId, companyId });
      return res.status(404).json({ error: '注文が見つかりません' });
    }

    // キャンセル可能なステータスかチェック
    if (!['pending', 'confirmed'].includes(order.status)) {
      console.log('❌ キャンセル不可能なステータス:', { 
        orderId, 
        currentStatus: order.status 
      });
      return res.status(400).json({ 
        error: `この注文はキャンセルできません（現在のステータス: ${order.status}）` 
      });
    }

    // 既にキャンセル申請中かチェック
    if (order.status === 'cancel_requested') {
      console.log('⚠️ 既にキャンセル申請中:', { orderId });
      return res.status(400).json({ error: '既にキャンセル申請中です' });
    }

    // キャンセル申請中に変更
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: { 
        status: 'cancel_requested',
        cancelReason: reason.trim(),
        updatedAt: new Date()
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

    console.log('✅ キャンセル申請完了:', {
      orderId: updatedOrder.id,
      orderNumber: updatedOrder.orderNumber,
      userId: updatedOrder.userId,
      userName: updatedOrder.user.name,
      reasonLength: reason.trim().length
    });

    return res.status(200).json({ 
      message: 'キャンセル申請を受け付けました。管理者の承認をお待ちください。',
      orderNumber: updatedOrder.orderNumber,
      status: updatedOrder.status
    });

  } catch (error: any) {
    console.error('❌ キャンセル申請API エラー:', {
      message: error.message,
      code: error.code,
      meta: error.meta
    });

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: '認証トークンが無効です' });
    } else if (error.code === 'P2025') {
      return res.status(404).json({ error: '注文が見つかりません' });
    } else {
      return res.status(500).json({ error: 'サーバーエラーが発生しました' });
    }
  } finally {
    await prisma.$disconnect();
  }
}