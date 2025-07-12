/**
 * ファイルパス: OptiOil-API/pages/api/orders/[id]/documents.ts
 * ユーザー用 - 納品書・受領書ダウンロードAPI
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // CORS設定（ユーザーFEと管理者FE両方を許可）
    const allowedOrigins = [
      process.env.NEXT_PUBLIC_FRONTEND_URL, // ユーザーFE
      'http://localhost:3002' // 管理者FE
    ];
    
    const origin = req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
    
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'GETメソッドのみ許可されています' });
    }

    // JWT認証
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'トークンが必要です' });
    }

    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) {
      return res.status(500).json({ error: 'サーバー設定エラー' });
    }

    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (jwtError) {
      return res.status(401).json({ error: 'トークンが無効です' });
    }

    const userId = decoded.id;
    const companyId = decoded.companyId;
    const { id, documentType } = req.query;

    if (!id || isNaN(Number(id))) {
      return res.status(400).json({ error: '有効な注文IDが必要です' });
    }

    const orderId = Number(id);

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
      return res.status(404).json({ error: '注文が見つかりません' });
    }

    // 書類取得
    let whereCondition: any = { orderId };
    
    if (documentType && ['delivery_note', 'receipt'].includes(documentType as string)) {
      whereCondition.documentType = documentType;
    }

    console.log(`📄 注文${orderId}の書類取得開始 - ユーザー${userId}, 会社${companyId}`);

    const paperwork = await prisma.orderPaperwork.findMany({
      where: whereCondition,
      select: {
        id: true,
        documentType: true,
        documentNumber: true,
        status: true,
        deliveryDate: true,
        isApproved: true,
        approvedAt: true,
        approvedBy: true,
        createdAt: true,
        filePath: true,
        s3Url: true
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`📄 書類検索結果: ${paperwork.length}件 (全て)`);

    // ファイナライズされた書類のみ返す
    const finalizedPaperwork = paperwork.filter(doc => doc.status === 'finalized');

    console.log(`📄 ファイナライズ済み書類: ${finalizedPaperwork.length}件`);
    console.log(`📄 注文${orderId}の書類取得完了:`, finalizedPaperwork.map(p => ({
      id: p.id,
      type: p.documentType,
      number: p.documentNumber,
      status: p.status
    })));

    return res.status(200).json(finalizedPaperwork);

  } catch (error) {
    console.error('❌ ユーザードキュメント取得API エラー:', error);
    return res.status(500).json({ error: 'サーバーエラーが発生しました' });
  } finally {
    await prisma.$disconnect();
  }
}