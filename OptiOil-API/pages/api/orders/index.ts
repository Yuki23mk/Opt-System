/**
 * ファイルパス: OptiOil-API/pages/api/orders/index.ts
 * ユーザー用注文取得API（承認フロー対応版・新スキーマ対応・キャンセル拒否理由対応・注文番号重複エラー修正版・日本時間対応） ※JWTではuserIdとcompanyIdを使用
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { sendEmail } from '../../../utils/email';

const prisma = new PrismaClient();

// CORS設定関数（他のAPIと統一・本番対応）
function setCorsHeaders(res: NextApiResponse) {
  const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL;
  
  if (!frontendUrl) {
    throw new Error('NEXT_PUBLIC_FRONTEND_URL環境変数が設定されていません。本番環境では必須です。');
  }
  
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', frontendUrl);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
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

// ✅ 安全な注文番号生成関数（重複回避・日本時間対応）
const generateUniqueOrderNumber = async (companyId: number, retryCount = 0): Promise<string> => {
  const maxRetries = 10; // 最大リトライ回数
  
  if (retryCount > maxRetries) {
    throw new Error('注文番号の生成に失敗しました（最大リトライ回数に達しました）');
  }
  
  // ✅ 日本時間（JST）を使用
  const now = new Date();
  const jstOffset = 9 * 60; // 日本は UTC+9
  const jstTime = new Date(now.getTime() + (jstOffset * 60 * 1000));
  const dateStr = jstTime.toISOString().slice(0, 10).replace(/-/g, '');
  
  // タイムスタンプ + ランダム要素を追加してユニーク性を向上
  const timestamp = Date.now().toString().slice(-6); // 末尾6桁
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  const sequence = `${timestamp}${random}`;
  
  const orderNumber = `${dateStr}-${companyId}-${sequence}`;
  
  // 既存の注文番号との重複チェック
  const existingOrder = await prisma.order.findUnique({
    where: { orderNumber }
  });
  
  if (existingOrder) {
    console.log(`⚠️ 注文番号重複検出: ${orderNumber}, リトライ ${retryCount + 1}回目`);
    // 重複していた場合は再生成
    return generateUniqueOrderNumber(companyId, retryCount + 1);
  }
  
  return orderNumber;
};

// 🆕 承認依頼メール送信関数
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
      
      <hr style="margin: 30px 0;">
      <p style="color: #666; font-size: 12px;">
        このメールは自動送信されています。<br>
        ご不明な点がございましたら、弊社までお問い合わせください。
      </p>
    </div>
  `;
  
  return await sendEmail(approverEmail, subject, html);
}

  // 🆕 承認が必要かどうか判定する関数（修正版）
  async function checkIfApprovalRequired(userId: number, companyId: number): Promise<{
    requiresApproval: boolean;
    approver?: { id: number; name: string; email: string };
  }> {
    // 注文者の情報を取得
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        systemRole: true,
        permissions: true
      }
    });

    if (!user) {
      throw new Error('ユーザーが見つかりません');
    }

    // メインアカウントは承認不要
    if (user.systemRole === 'main') {
      return { requiresApproval: false };
    }

    // サブアカウントの承認設定をチェック
    const permissions = user.permissions as any;
    const requiresApproval = permissions?.orderApproval?.requiresApproval !== false; // デフォルトは承認必要

    if (!requiresApproval) {
      return { requiresApproval: false };
    }

    // ✅ 1. まずメインアカウントを検索
    let approvers = await prisma.user.findMany({
      where: {
        companyId: companyId,
        status: { not: 'deleted' },
        systemRole: 'main'
      },
      select: {
        id: true,
        name: true,
        email: true,
        systemRole: true
      }
    });

    // ✅ 2. メインアカウントがいない場合、承認権限を持つサブアカウントを検索
    if (approvers.length === 0) {
      const allUsers = await prisma.user.findMany({
        where: {
          companyId: companyId,
          status: { not: 'deleted' },
          systemRole: 'child'
        },
        select: {
          id: true,
          name: true,
          email: true,
          systemRole: true,
          permissions: true
        }
      });

      // JavaScriptで承認権限をチェック
      approvers = allUsers.filter(user => {
        const userPermissions = user.permissions as any;
        return userPermissions?.orderApproval?.canApprove === true;
      }).map(user => ({
        id: user.id,
        name: user.name,
        email: user.email,
        systemRole: user.systemRole
      }));
    }

    if (approvers.length === 0) {
      throw new Error('承認者が見つかりません。管理者にお問い合わせください。');
    }

    // 最初の承認者を返す（通常はメインアカウント）
    return { 
      requiresApproval: true, 
      approver: approvers[0] 
    };
  }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // CORS設定（他のAPIと統一）
    setCorsHeaders(res);

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
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

    if (req.method === 'GET') {
      // 注文履歴取得（会社単位・ソート機能付き・承認ステータス表示対応）
      const { sortBy = 'createdAt', sortOrder = 'desc', productFilter } = req.query;

      const orderBy: any = {};
      
      // ソート条件の設定
      switch (sortBy) {
        case 'orderNumber':
          orderBy.orderNumber = sortOrder;
          break;
        case 'status':
          orderBy.status = sortOrder;
          break;
        case 'totalAmount':
          orderBy.totalAmount = sortOrder;
          break;
        case 'userName':
          orderBy.user = { name: sortOrder };
          break;
        default:
          orderBy.createdAt = sortOrder;
      }

      // 基本的なwhere条件
      const whereCondition: any = {
        user: {
          companyId: companyId
        }
      };

      // 製品フィルターが指定されている場合
      if (productFilter && typeof productFilter === 'string') {
        whereCondition.orderItems = {
          some: {
            companyProduct: {
              productMaster: {
                name: {
                  contains: productFilter
                }
              }
            }
          }
        };
      }

      const orders = await prisma.order.findMany({
        where: whereCondition,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              status: true  // ✅ 追加: 削除済みユーザー判定用
            }
          },
          orderItems: {
            include: {
              companyProduct: {
                include: {
                  productMaster: {
                    select: {
                      id: true,
                      code: true,
                      name: true,
                      manufacturer: true,
                      capacity: true,
                      unit: true,
                      oilType: true
                    }
                  }
                }
              }
            }
          },
          deliveryAddress: true,
          // 🆕 承認情報を含める
          approval: {
            include: {
              approver: {
                select: {
                  id: true,
                  name: true,
                  status: true
                }
              }
            }
          }
        },
        orderBy
      });

      // ✅ 削除済みユーザー表示対応 + 承認情報追加
      const ordersWithDetails = orders.map(order => ({
        ...order,
        user: formatUserForDisplay(order.user), // ✅ ユーザー情報をフォーマット
        cancelRejectReason: order.cancelRejectReason || null,
        cancelMessage: 'キャンセル理由を入力してください。お急ぎの場合は丸一機料商会（084-962-0525）まで直接ご連絡頂けますようお願いします。',
        priceNote: '※価格は税抜表示です',
        // 🆕 承認情報を追加
        approvalInfo: order.approval ? {
          status: order.approval.status,
          requestedAt: order.approval.requestedAt,
          approvedAt: order.approval.approvedAt,
          rejectedAt: order.approval.rejectedAt,
          rejectionReason: order.approval.rejectionReason,
          approver: order.approval.approver ? formatUserForDisplay(order.approval.approver) : null
        } : null
      }));

      console.log(`📋 注文履歴取得: ${ordersWithDetails.length}件 (sortBy: ${sortBy}, productFilter: ${productFilter || 'なし'})`);
      return res.status(200).json(ordersWithDetails);

    } else if (req.method === 'POST') {
      // 新規注文作成（承認フロー対応・新スキーマ対応・注文番号重複エラー修正）
      const { 
        items, 
        deliveryAddressId, 
        deliveryName,
        deliveryCompany,
        deliveryZipCode,
        deliveryPrefecture,
        deliveryCity,
        deliveryAddress1,
        deliveryAddress2,
        deliveryPhone,
        totalAmount,
        // 🆕 フロントエンドからの承認フラグを受け取る（オプション）
        requiresApproval: frontendRequiresApproval
      } = req.body;

      console.log('📦 受信した注文データ:', {
        items: items?.length || 0,
        deliveryAddressId,
        totalAmount,
        userId,
        companyId
      });

      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: '注文商品が必要です' });
      }

      if (!deliveryAddressId) {
        return res.status(400).json({ error: '配送先が必要です' });
      }

      // 🆕 承認が必要かチェック（フロントエンドとサーバーの両方で判定）
      let approvalInfo;
      try {
        approvalInfo = await checkIfApprovalRequired(userId, companyId);
        
        // フロントエンドからの判定と一致しているかログ出力（デバッグ用）
        if (frontendRequiresApproval !== undefined && 
            frontendRequiresApproval !== approvalInfo.requiresApproval) {
          console.log('⚠️ 承認要否の判定が不一致:', {
            frontend: frontendRequiresApproval,
            server: approvalInfo.requiresApproval
          });
        }
      } catch (error) {
        return res.status(400).json({ error: (error as Error).message });
      }

      // 配送先情報の取得・検証
      let deliveryInfo;
      
      if (deliveryName && deliveryZipCode && deliveryPrefecture && deliveryCity && deliveryAddress1) {
        // フロントエンドから配送先詳細が送信されている場合
        deliveryInfo = {
          name: deliveryName,
          company: deliveryCompany || '',
          zipCode: deliveryZipCode,
          prefecture: deliveryPrefecture,
          city: deliveryCity,
          address1: deliveryAddress1,
          address2: deliveryAddress2 || '',
          phone: deliveryPhone || ''
        };
      } else {
        // DBから配送先を取得
        const deliveryAddress = await prisma.address.findFirst({
          where: { 
            id: parseInt(deliveryAddressId.toString()),
            userId: userId 
          }
        });

        if (!deliveryAddress) {
          return res.status(400).json({ error: '指定された配送先が見つかりません' });
        }

        deliveryInfo = {
          name: deliveryAddress.name,
          company: deliveryAddress.company || '',
          zipCode: deliveryAddress.zipCode,
          prefecture: deliveryAddress.prefecture,
          city: deliveryAddress.city,
          address1: deliveryAddress.address1,
          address2: deliveryAddress.address2 || '',
          phone: deliveryAddress.phone || ''
        };
      }

      // 商品の存在確認（CompanyProduct基準）
      let calculatedTotal = 0;
      for (const item of items) {
        console.log('🔍 商品検証:', {
          companyProductId: item.companyProductId,
          quantity: item.quantity,
          unitPrice: item.unitPrice
        });

        if (!item.companyProductId) {
          return res.status(400).json({ 
            error: '商品の会社製品IDが必要です' 
          });
        }

        // CompanyProductの存在確認
        const companyProduct = await prisma.companyProduct.findFirst({
          where: {
            id: parseInt(item.companyProductId.toString()),
            companyId: companyId,
            enabled: true
          },
          include: {
            productMaster: true
          }
        });

        if (!companyProduct) {
          return res.status(400).json({ 
            error: `会社商品ID ${item.companyProductId} が無効または使用中止です` 
          });
        }

        // 価格の検証（CompanyProductの価格を使用）
        const itemUnitPrice = companyProduct.price || item.unitPrice || 0;
        const itemQuantity = parseInt(item.quantity.toString()) || 0;
        calculatedTotal += itemUnitPrice * itemQuantity;

        console.log('✅ 商品確認OK:', {
          companyProductId: companyProduct.id,
          productName: companyProduct.productMaster.name,
          unitPrice: itemUnitPrice,
          quantity: itemQuantity
        });
      }

      // ✅ 安全な注文番号生成（重複回避・日本時間対応）
      let orderNumber: string;
      try {
        orderNumber = await generateUniqueOrderNumber(companyId);
        console.log('✅ 注文番号生成成功:', orderNumber);
      } catch (error) {
        console.error('❌ 注文番号生成エラー:', error);
        return res.status(500).json({ 
          error: '注文番号の生成に失敗しました。しばらく待ってから再度お試しください。' 
        });
      }

      // トランザクションで注文作成
      const result = await prisma.$transaction(async (tx) => {
        // 注文作成
        const newOrder = await tx.order.create({
          data: {
            orderNumber,
            userId,
            totalAmount: totalAmount || calculatedTotal,
            // 🆕 承認フロー対応
            status: approvalInfo.requiresApproval ? 'pending_approval' : 'pending',
            requiresApproval: approvalInfo.requiresApproval,
            approvalStatus: approvalInfo.requiresApproval ? 'pending' : null,
            
            deliveryAddressId: parseInt(deliveryAddressId.toString()),
            deliveryName: deliveryInfo.name,
            deliveryCompany: deliveryInfo.company,
            deliveryZipCode: deliveryInfo.zipCode,
            deliveryPrefecture: deliveryInfo.prefecture,
            deliveryCity: deliveryInfo.city,
            deliveryAddress1: deliveryInfo.address1,
            deliveryAddress2: deliveryInfo.address2,
            deliveryPhone: deliveryInfo.phone,
          },
          include: {
            user: {
              select: { name: true }
            }
          }
        });

        // 注文商品作成
        const orderItems = [];
        for (const item of items) {
          const companyProduct = await tx.companyProduct.findUnique({
            where: { id: parseInt(item.companyProductId.toString()) },
            include: {
              productMaster: true
            }
          });
          
          const itemUnitPrice = companyProduct?.price || item.unitPrice || 0;
          const itemQuantity = parseInt(item.quantity.toString()) || 0;
          
          const orderItem = await tx.orderItem.create({
            data: {
              orderId: newOrder.id,
              companyProductId: parseInt(item.companyProductId.toString()),
              quantity: itemQuantity,
              unitPrice: itemUnitPrice,
              totalPrice: itemUnitPrice * itemQuantity
            },
            include: {
              companyProduct: {
                include: {
                  productMaster: true
                }
              }
            }
          });
          
          orderItems.push(orderItem);
        }

        // 🆕 承認が必要な場合は OrderApproval レコードを作成
        if (approvalInfo.requiresApproval && approvalInfo.approver) {
          await tx.orderApproval.create({
            data: {
              orderId: newOrder.id,
              requesterId: userId,
              status: 'pending'
            }
          });
        }

        return { order: newOrder, orderItems, approvalInfo };
      });

      // 🆕 承認依頼メールの送信
      if (result.approvalInfo.requiresApproval && result.approvalInfo.approver) {
        try {
          await sendApprovalRequestEmail(
            result.approvalInfo.approver.email,
            result.approvalInfo.approver.name,
            result.order.user.name,
            result.order.orderNumber,
            result.order.totalAmount,
            result.orderItems
          );
          console.log('✅ 承認依頼メール送信成功');
        } catch (emailError) {
          console.error('⚠️ 承認依頼メール送信失敗:', emailError);
          // メール送信失敗でも注文作成は継続
        }
      }

      console.log('✅ 注文作成成功:', {
        orderNumber: result.order.orderNumber,
        orderId: result.order.id,
        itemCount: result.orderItems.length,
        totalAmount: result.order.totalAmount,
        requiresApproval: result.approvalInfo.requiresApproval
      });

      const responseMessage = result.approvalInfo.requiresApproval 
        ? '注文を受け付けました。承認者による承認をお待ちください。'
        : '注文を受け付けました';

      return res.status(201).json({ 
        message: responseMessage,
        orderNumber: result.order.orderNumber,
        orderId: result.order.id,
        requiresApproval: result.approvalInfo.requiresApproval,
        priceNote: '※価格は税抜表示です'
      });

    } else if (req.method === 'PUT') {
      // 注文キャンセル要求
      const { orderId, cancelReason } = req.body;

      if (!orderId) {
        return res.status(400).json({ error: '注文IDが必要です' });
      }

      if (!cancelReason || cancelReason.trim() === '') {
        return res.status(400).json({ 
          error: 'キャンセル理由を入力してください。お急ぎの場合は丸一機料商会（084-962-0525）まで直接ご連絡頂けますようお願いします。' 
        });
      }

      // 注文の存在確認と権限チェック
      const order = await prisma.order.findFirst({
        where: {
          id: parseInt(orderId.toString()),
          user: { companyId: companyId }
        }
      });

      if (!order) {
        return res.status(404).json({ error: '注文が見つかりません' });
      }

      if (order.status === 'cancelled') {
        return res.status(400).json({ error: '既にキャンセル済みの注文です' });
      }

      if (order.status === 'completed' || order.status === 'shipped') {
        return res.status(400).json({ error: 'この注文はキャンセルできません' });
      }

      // 注文をキャンセル要求状態に更新
      const updatedOrder = await prisma.order.update({
        where: { id: parseInt(orderId.toString()) },
        data: {
          status: 'cancel_requested',
          cancelReason: cancelReason.trim(),
          updatedAt: new Date()
        }
      });

      console.log('📝 キャンセル要求受付:', {
        orderNumber: updatedOrder.orderNumber,
        cancelReason: cancelReason.trim()
      });

      return res.status(200).json({
        message: 'キャンセル要求を受け付けました',
        orderNumber: updatedOrder.orderNumber
      });

    } else {
      res.setHeader('Allow', ['GET', 'POST', 'PUT']);
      return res.status(405).json({ error: 'メソッドが許可されていません' });
    }

  } catch (error) {
    console.error('❌ 注文API エラー:', error);
    
    if (error instanceof Error) {
      console.error('エラー詳細:', {
        name: error.name,
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
    
    return res.status(500).json({ 
      error: 'サーバーエラーが発生しました',
      details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  } finally {
    await prisma.$disconnect();
  }
}