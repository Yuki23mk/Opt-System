/**
 * ファイルパス: OptiOil-API/pages/api/orders/pending-approvals.ts
 * 承認待ち注文一覧取得API
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

// CORS設定関数
function setCorsHeaders(res: NextApiResponse) {
  const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL;
  
  if (!frontendUrl) {
    throw new Error('NEXT_PUBLIC_FRONTEND_URL環境変数が設定されていません。');
  }
  
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', frontendUrl);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// 削除済みユーザー表示用のフォーマット関数
const formatUserForDisplay = (user: any) => {
  if (!user) return null;
  
  return {
    ...user,
    isDeleted: user.status === "deleted",
    displayName: user.status === "deleted" ? "削除済みアカウント" : user.name
  };
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    setCorsHeaders(res);

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    if (req.method !== 'GET') {
      res.setHeader('Allow', ['GET']);
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

    // 承認権限の確認
    const approver = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
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

    // ソート条件の設定
    const { sortBy = 'requestedAt', sortOrder = 'desc' } = req.query;

    const orderBy: any = {};
    switch (sortBy) {
      case 'orderNumber':
        orderBy.order = { orderNumber: sortOrder };
        break;
      case 'requesterName':
        orderBy.requester = { name: sortOrder };
        break;
      case 'totalAmount':
        orderBy.order = { totalAmount: sortOrder };
        break;
      default:
        orderBy.requestedAt = sortOrder;
    }

    // 承認待ち注文一覧を取得
    const pendingApprovals = await prisma.orderApproval.findMany({
      where: {
        status: 'pending',
        // 同じ会社内の承認依頼のみ
        requester: {
          companyId: companyId
        }
      },
      include: {
        order: {
          include: {
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
            }
          }
        },
        requester: {
          select: {
            id: true,
            name: true,
            email: true,
            status: true,
            department: true,
            position: true
          }
        },
        approver: {
          select: {
            id: true,
            name: true,
            email: true,
            status: true
          }
        }
      },
      orderBy
    });

    // レスポンス用にデータを整形
    const formattedApprovals = pendingApprovals.map(approval => ({
      id: approval.id,
      orderId: approval.orderId,
      status: approval.status,
      requestedAt: approval.requestedAt,
      rejectionReason: approval.rejectionReason,
      
      // 注文情報
      order: {
        id: approval.order.id,
        orderNumber: approval.order.orderNumber,
        totalAmount: approval.order.totalAmount,
        status: approval.order.status,
        createdAt: approval.order.createdAt,
        deliveryName: approval.order.deliveryName,
        deliveryCompany: approval.order.deliveryCompany,
        deliveryAddress: {
          zipCode: approval.order.deliveryZipCode,
          prefecture: approval.order.deliveryPrefecture,
          city: approval.order.deliveryCity,
          address1: approval.order.deliveryAddress1,
          address2: approval.order.deliveryAddress2,
          phone: approval.order.deliveryPhone
        },
        orderItems: approval.order.orderItems.map(item => ({
          id: item.id,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
          companyProduct: {
            id: item.companyProduct.id,
            productMaster: item.companyProduct.productMaster
          }
        }))
      },
      
      // 申請者情報（削除済みユーザー対応）
      requester: formatUserForDisplay(approval.requester),
      
      // 承認者情報（まだ未承認なのでnull）
      approver: approval.approver ? formatUserForDisplay(approval.approver) : null,
      
      // 追加情報
      priceNote: '※価格は税抜表示です',
      itemCount: approval.order.orderItems.length
    }));

    console.log(`📋 承認待ち注文取得: ${formattedApprovals.length}件 (承認者: ${approver.name})`);

    return res.status(200).json({
      approvals: formattedApprovals,
      totalCount: formattedApprovals.length,
      approverInfo: {
        id: approver.id,
        name: approver.name,
        hasApprovalPermission: true
      }
    });

  } catch (error) {
    console.error('❌ 承認待ち一覧API エラー:', error);
    
    return res.status(500).json({ 
      error: 'サーバーエラーが発生しました',
      details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  } finally {
    await prisma.$disconnect();
  }
}