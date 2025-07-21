/**
 * ファイルパス: OptiOil-API/pages/api/orders/index.ts
 * ユーザー用注文取得API（新スキーマ対応・キャンセル拒否理由対応・注文番号重複エラー修正版・日本時間対応） ※JWTではuserIdとcompanyIdを使用
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

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
      // 注文履歴取得（会社単位・ソート機能付き）
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
          deliveryAddress: true
        },
        orderBy
      });

      // ✅ 削除済みユーザー表示対応 + レスポンス詳細情報
      const ordersWithDetails = orders.map(order => ({
        ...order,
        user: formatUserForDisplay(order.user), // ✅ ユーザー情報をフォーマット
        cancelRejectReason: order.cancelRejectReason || null,
        cancelMessage: 'キャンセル理由を入力してください。お急ぎの場合は丸一機料商会（084-962-0525）まで直接ご連絡頂けますようお願いします。',
        priceNote: '※価格は税抜表示です'
      }));

      console.log(`📋 注文履歴取得: ${ordersWithDetails.length}件 (sortBy: ${sortBy}, productFilter: ${productFilter || 'なし'})`);
      return res.status(200).json(ordersWithDetails);

    } else if (req.method === 'POST') {
      // 新規注文作成（新スキーマ対応・注文番号重複エラー修正）
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
        totalAmount 
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
      const order = await prisma.$transaction(async (tx) => {
        // 注文作成
        const newOrder = await tx.order.create({
          data: {
            orderNumber,
            userId,
            totalAmount: totalAmount || calculatedTotal,
            status: 'pending',
            deliveryAddressId: parseInt(deliveryAddressId.toString()),
            deliveryName: deliveryInfo.name,
            deliveryCompany: deliveryInfo.company,
            deliveryZipCode: deliveryInfo.zipCode,
            deliveryPrefecture: deliveryInfo.prefecture,
            deliveryCity: deliveryInfo.city,
            deliveryAddress1: deliveryInfo.address1,
            deliveryAddress2: deliveryInfo.address2,
            deliveryPhone: deliveryInfo.phone,
          }
        });

        // 注文商品作成
        for (const item of items) {
          const companyProduct = await tx.companyProduct.findUnique({
            where: { id: parseInt(item.companyProductId.toString()) }
          });
          
          const itemUnitPrice = companyProduct?.price || item.unitPrice || 0;
          const itemQuantity = parseInt(item.quantity.toString()) || 0;
          
          await tx.orderItem.create({
            data: {
              orderId: newOrder.id,
              companyProductId: parseInt(item.companyProductId.toString()),
              quantity: itemQuantity,
              unitPrice: itemUnitPrice,
              totalPrice: itemUnitPrice * itemQuantity
            }
          });
        }

        return newOrder;
      });

      console.log('✅ 注文作成成功:', {
        orderNumber: order.orderNumber,
        orderId: order.id,
        itemCount: items.length,
        totalAmount: order.totalAmount
      });

      return res.status(201).json({ 
        message: '注文を受け付けました',
        orderNumber: order.orderNumber,
        orderId: order.id,
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