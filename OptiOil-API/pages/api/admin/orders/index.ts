/**
 * ファイルパス: OptiOil-API/pages/api/admin/orders/index.ts
 * 管理者用 - 全受注データ取得API（ステータス整合性修正版）
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { runMiddleware } from '../../../../lib/cors';
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

    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'GETメソッドのみ許可されています' });
    }

    // 管理者JWT認証
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      console.log('❌ 管理者トークンがありません');
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
      
      // 管理者ユーザーの存在確認（オプション）
      const adminUser = await prisma.adminUser.findUnique({
        where: { id: decoded.id }
      });
      
      if (!adminUser || adminUser.status !== 'active') {
        console.log('❌ 管理者アカウントが無効:', { found: !!adminUser, status: adminUser?.status });
        return res.status(401).json({ error: '管理者アカウントが無効です' });
      }
      
    } catch (error) {
      console.error('❌ 管理者トークン検証失敗:', getErrorMessage(error));

      if (error instanceof Error) { // 🔧 型安全なアクセス
        if (error.name === 'JsonWebTokenError') {
          return res.status(401).json({ error: 'トークンの形式が正しくありません' });
        } else if (error.name === 'TokenExpiredError') {
          return res.status(401).json({ error: 'トークンが期限切れです' });
        }
      }
      return res.status(401).json({ error: '無効な管理者トークンです' });
    }

    // 全受注データ取得 - cancelRejectReasonを含める + 承認待ち・却下済みを除外
    console.log('📋 受注データ取得開始...');

    // ✅ 修正: 承認待ち・却下済みを除外（拡張ステータス対応）
    const excludedStatuses = [
      'pending_approval',   // 承認待ち  
      'rejected'            // 却下済み
    ];

    // まず基本的な注文データのみ取得（承認中除外・cancelRejectReasonを追加）
    const basicOrders = await prisma.order.findMany({
      where: {
        status: {
          notIn: excludedStatuses
        }
      },
      select: {
        id: true,
        orderNumber: true,
        totalAmount: true,
        status: true,
        approvalStatus: true,
        requiresApproval: true,
        createdAt: true,
        userId: true,
        deliveryName: true,
        deliveryCompany: true,
        deliveryAddress1: true,
        deliveryAddress2: true,
        deliveryPrefecture: true,
        deliveryCity: true,
        deliveryZipCode: true,
        deliveryPhone: true,
        cancelReason: true,
        cancelRejectReason: true,
        userNote: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`📋 基本注文データ取得完了: ${basicOrders.length}件`);

    // ユーザー情報と会社情報を別途取得
    const ordersWithUserData = await Promise.all(
      basicOrders.map(async (order) => {
        try {
          // ユーザー情報取得
          const user = await prisma.user.findUnique({
            where: { id: order.userId },
            select: {
              id: true,
              name: true,
              email: true,
              companyId: true
            }
          });

          // 会社情報取得
          let company = null;
          if (user?.companyId) {
            company = await prisma.company.findUnique({
              where: { id: user.companyId },
              select: {
                id: true,
                name: true
              }
            });
          }

          // 注文商品取得
          const orderItems = await prisma.orderItem.findMany({
            where: { orderId: order.id },
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
          });

          // フロントエンド互換性のため、productフィールドに変換
          const transformedOrderItems = orderItems.map(item => ({
            ...item,
            product: item.companyProduct.productMaster
          }));

          return {
            ...order,
            user: {
              ...user,
              company: company,
              userNote: order.userNote, 
            },
            orderItems: transformedOrderItems
          };
        } catch (error) {
          console.error(`❌ 注文ID ${order.id} のデータ取得エラー:`, error);
          return {
            ...order,
            user: {
              id: order.userId,
              name: 'データ取得エラー',
              email: '',
              company: { id: 0, name: 'データ取得エラー' }
            },
            orderItems: []
          };
        }
      })
    );

    console.log(`📋 管理者：全受注データ取得完了 ${ordersWithUserData.length}件`);
    console.log('🔍 cancelRejectReasonを含む注文:', 
      ordersWithUserData.filter(o => o.cancelRejectReason).length + '件'
    );

    return res.status(200).json(ordersWithUserData);

  } catch (error) {
    console.error('❌ 管理者受注データ取得API エラー:', error);
    return res.status(500).json({ 
      error: 'サーバーエラーが発生しました',
      details: process.env.NODE_ENV === 'development' ? getErrorMessage(error) : undefined
    });
  } finally {
    await prisma.$disconnect();
  }
}