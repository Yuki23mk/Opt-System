/**
 * ファイルパス: OptiOil-API/pages/api/orders/approve.ts
 * 注文承認・却下処理API（承認フロー機能）
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { sendEmail } from '../../../utils/email';

const prisma = new PrismaClient();

// CORS設定関数
function setCorsHeaders(res: NextApiResponse) {
  const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL;
  
  if (!frontendUrl) {
    throw new Error('NEXT_PUBLIC_FRONTEND_URL環境変数が設定されていません。');
  }
  
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', frontendUrl);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// 承認依頼メール送信
async function sendApprovalRequestEmail(
  approverEmail: string, 
  approverName: string,
  requesterName: string,
  orderNumber: string,
  totalAmount: number,
  orderItems: any[]
): Promise<boolean> {
  const companyName = process.env.COMPANY_NAME || '有限会社丸一機料商会';
  const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL;
  
  const approvalUrl = frontendUrl 
    ? `${frontendUrl}/approval`
    : '承認画面（URLは管理者にお問い合わせください）';

  const itemsHtml = orderItems.map(item => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${item.companyProduct.productMaster.name}</td>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">¥${item.unitPrice.toLocaleString()}</td>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">¥${item.totalPrice.toLocaleString()}</td>
    </tr>
  `).join('');

  const subject = `${companyName} - 注文承認依頼【${orderNumber}】`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #115e59;">注文承認のご依頼</h2>
      
      <p>${approverName}様</p>
      <p>${requesterName}様から注文の承認依頼が届いています。</p>
      
      <div style="background-color: #f0fdfa; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="color: #115e59; margin-top: 0;">注文詳細</h3>
        <p><strong>注文番号:</strong> ${orderNumber}</p>
        <p><strong>申請者:</strong> ${requesterName}</p>
        <p><strong>申請日時:</strong> ${new Date().toLocaleString('ja-JP')}</p>
        <p><strong>合計金額:</strong> ¥${totalAmount.toLocaleString()} <span style="color: #666;">(税抜)</span></p>
      </div>

      <div style="background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; margin: 20px 0;">
        <h4 style="color: #115e59; margin: 0; padding: 15px; background-color: #f9fafb; border-bottom: 1px solid #e5e7eb;">注文商品</h4>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background-color: #f9fafb;">
              <th style="padding: 12px 8px; text-align: left; border-bottom: 2px solid #e5e7eb;">商品名</th>
              <th style="padding: 12px 8px; text-align: center; border-bottom: 2px solid #e5e7eb;">数量</th>
              <th style="padding: 12px 8px; text-align: right; border-bottom: 2px solid #e5e7eb;">単価</th>
              <th style="padding: 12px 8px; text-align: right; border-bottom: 2px solid #e5e7eb;">小計</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
      </div>
      
      <div style="text-align: center; margin: 30px 0;">
        ${frontendUrl ? `
          <a href="${approvalUrl}" style="display: inline-block; background-color: #115e59; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 0 10px;">
            承認画面を開く
          </a>
        ` : `
          <p style="color: #666;">承認画面URL: ${approvalUrl}</p>
        `}
      </div>
      
      <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
        <p style="margin: 0; color: #92400e;">
          <strong>注意:</strong> 承認・却下は承認画面から行ってください。このメールに返信しても処理されません。
        </p>
      </div>
      
      <hr style="margin: 30px 0;">
      <p style="color: #666; font-size: 12px;">
        このメールは自動送信されています。<br>
        ご不明な点がございましたら、弊社までお問い合わせください。
      </p>
    </div>
  `;
  
  return await sendEmail(approverEmail, subject, html);
}

// 承認結果メール送信
async function sendApprovalResultEmail(
  requesterEmail: string,
  requesterName: string,
  approverName: string,
  orderNumber: string,
  isApproved: boolean,
  rejectionReason?: string
): Promise<boolean> {
  const companyName = process.env.COMPANY_NAME || '有限会社丸一機料商会';
  
  const subject = `${companyName} - 注文${isApproved ? '承認' : '却下'}のお知らせ【${orderNumber}】`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: ${isApproved ? '#115e59' : '#dc2626'};">注文${isApproved ? '承認' : '却下'}のお知らせ</h2>
      
      <p>${requesterName}様</p>
      <p>注文番号【${orderNumber}】について、${approverName}様より${isApproved ? '承認' : '却下'}されました。</p>
      
      <div style="background-color: ${isApproved ? '#f0fdfa' : '#fef2f2'}; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${isApproved ? '#115e59' : '#dc2626'};">
        <h3 style="color: ${isApproved ? '#115e59' : '#dc2626'}; margin-top: 0;">
          ${isApproved ? '✅ 承認完了' : '❌ 却下'}
        </h3>
        <p><strong>注文番号:</strong> ${orderNumber}</p>
        <p><strong>${isApproved ? '承認' : '却下'}者:</strong> ${approverName}</p>
        <p><strong>処理日時:</strong> ${new Date().toLocaleString('ja-JP')}</p>
        ${!isApproved && rejectionReason ? `
          <div style="margin-top: 15px;">
            <strong>却下理由:</strong>
            <p style="margin: 5px 0 0 0; padding: 10px; background-color: rgba(255,255,255,0.5); border-radius: 4px;">
              ${rejectionReason}
            </p>
          </div>
        ` : ''}
      </div>
      
      ${isApproved ? `
        <div style="background-color: #f0fdfa; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; color: #115e59;">
            <strong>次のステップ:</strong> 注文処理を開始いたします。配送準備が整い次第、改めてご連絡いたします。
          </p>
        </div>
      ` : `
        <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; color: #92400e;">
            必要に応じて注文内容を修正の上、再度ご注文ください。ご不明な点がございましたらお問い合わせください。
          </p>
        </div>
      `}
      
      <hr style="margin: 30px 0;">
      <p style="color: #666; font-size: 12px;">
        このメールは自動送信されています。<br>
        ご不明な点がございましたら、弊社までお問い合わせください。
      </p>
    </div>
  `;
  
  return await sendEmail(requesterEmail, subject, html);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    setCorsHeaders(res);

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST']);
      return res.status(405).json({ error: 'メソッドが許可されていません' });
    }

    // JWT認証
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'トークンが必要です' });
    }

    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) {
      console.error('❌ JWT_SECRET環境変数が設定されていません');
      return res.status(500).json({ error: 'サーバー設定エラー' });
    }

    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (jwtError) {
      console.error('❌ JWT認証エラー:', jwtError);
      return res.status(401).json({ error: 'トークンが無効です' });
    }

    const userId = decoded.id;
    const companyId = decoded.companyId;

    if (!userId || !companyId) {
      return res.status(401).json({ error: 'ユーザー情報が不正です' });
    }

    const { orderId, action, rejectionReason } = req.body;

    if (!orderId || !action) {
      return res.status(400).json({ error: '注文IDとアクションが必要です' });
    }

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'アクションは approve または reject である必要があります' });
    }

    if (action === 'reject' && (!rejectionReason || rejectionReason.trim() === '')) {
      return res.status(400).json({ error: '却下理由が必要です' });
    }

    // 承認権限の確認
    const approver = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        systemRole: true,
        permissions: true,
        companyId: true
      }
    });

    if (!approver) {
      return res.status(404).json({ error: 'ユーザーが見つかりません' });
    }

    // 承認権限チェック
    const hasApprovalPermission = 
      approver.systemRole === 'main' || 
      (approver.permissions as any)?.orderApproval?.canApprove === true;

    if (!hasApprovalPermission) {
      return res.status(403).json({ error: '承認権限がありません' });
    }

    // 注文と承認レコードの取得
    const orderApproval = await prisma.orderApproval.findUnique({
      where: { orderId: parseInt(orderId.toString()) },
      include: {
        order: {
          include: {
            orderItems: {
              include: {
                companyProduct: {
                  include: {
                    productMaster: true
                  }
                }
              }
            }
          }
        },
        requester: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    if (!orderApproval) {
      return res.status(404).json({ error: '承認待ちの注文が見つかりません' });
    }

    // 会社権限チェック
    const orderUser = await prisma.user.findUnique({
      where: { id: orderApproval.requesterId },
      select: { companyId: true }
    });

    if (!orderUser || orderUser.companyId !== companyId) {
      return res.status(403).json({ error: '異なる会社の注文は承認できません' });
    }

    // 既に処理済みかチェック
    if (orderApproval.status !== 'pending') {
      return res.status(400).json({ 
        error: `この注文は既に${orderApproval.status === 'approved' ? '承認' : '却下'}済みです` 
      });
    }

    // トランザクションで承認処理
    const result = await prisma.$transaction(async (tx) => {
      const now = new Date();
      
      // 承認レコードの更新
      const updatedApproval = await tx.orderApproval.update({
        where: { id: orderApproval.id },
        data: {
          status: action === 'approve' ? 'approved' : 'rejected',
          approverId: userId,
          approvedAt: action === 'approve' ? now : null,
          rejectedAt: action === 'reject' ? now : null,
          rejectionReason: action === 'reject' ? rejectionReason?.trim() : null
        }
      });

      // 注文レコードの更新  
      const updatedOrder = await tx.order.update({
        where: { id: orderApproval.orderId },
        data: {
          approvalStatus: action === 'approve' ? 'approved' : 'rejected',
          status: action === 'approve' ? 'approved' : 'rejected',
          updatedAt: now
        }
      });

      return { updatedApproval, updatedOrder };
    });

    // メール通知の送信
    try {
      await sendApprovalResultEmail(
        orderApproval.requester.email,
        orderApproval.requester.name,
        approver.name,
        orderApproval.order.orderNumber,
        action === 'approve',
        action === 'reject' ? rejectionReason?.trim() : undefined
      );
      console.log('✅ 承認結果メール送信成功');
    } catch (emailError) {
      console.error('⚠️ 承認結果メール送信失敗:', emailError);
      // メール送信失敗でも承認処理は継続
    }

    console.log(`✅ 注文${action === 'approve' ? '承認' : '却下'}完了:`, {
      orderNumber: orderApproval.order.orderNumber,
      approver: approver.name,
      requester: orderApproval.requester.name,
      action
    });

    return res.status(200).json({
      message: `注文を${action === 'approve' ? '承認' : '却下'}しました`,
      orderNumber: orderApproval.order.orderNumber,
      status: action === 'approve' ? 'approved' : 'rejected'
    });

  } catch (error) {
    console.error('❌ 承認処理API エラー:', error);
    
    return res.status(500).json({ 
      error: 'サーバーエラーが発生しました',
      details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  } finally {
    await prisma.$disconnect();
  }
}