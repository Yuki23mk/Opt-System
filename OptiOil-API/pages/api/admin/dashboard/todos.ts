// OptiOil-API/pages/api/admin/dashboard/todos.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { runMiddleware } from '../../../../lib/cors'; // 🔧 既存のCORS設定を使用
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

interface AdminTokenPayload {
  id: number;
  username: string;
  role: string;
  email: string;
}

interface TodoItem {
  id: string;
  category: 'user_management' | 'order_management' | 'quotation_management';
  priority: 1 | 2 | 3;
  title: string;
  description: string;
  count?: number;
  actionUrl?: string;
  createdAt: Date;
}

interface TodosResponse {
  todos: TodoItem[];
  summary: {
    total: number;
    byCategory: {
      user_management: number;
      order_management: number;
      quotation_management: number;
    };
  };
}

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

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // 🔧 修正: 既存のCORS middleware を適用
  try {
    await runMiddleware(req, res);
  } catch (error) {
    console.error('CORS error in todos API:', error);
    return res.status(403).json({ error: 'CORS error' });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 管理者認証
    const adminUser = await verifyAdminToken(req);
    if (!adminUser) {
      return res.status(401).json({ error: 'Invalid admin token' });
    }

    const todos: TodoItem[] = [];

    // 1. ユーザ管理TODO (優先度1)
    const pendingUsers = await prisma.user.count({
      where: { status: 'pending' }
    });

    if (pendingUsers > 0) {
      todos.push({
        id: 'pending_users',
        category: 'user_management',
        priority: 1,
        title: 'ユーザー承認待ち',
        description: `承認待ちステータスのユーザ申請が${pendingUsers}件あります`,
        count: pendingUsers,
        actionUrl: '/users?filter=pending',
        createdAt: new Date()
      });
    }

    // 2. 受注管理TODO (優先度2)
    const orderStatuses = [
      { status: 'pending', label: '注文受付' },
      { status: 'confirmed', label: '注文確定' },
      { status: 'preparing', label: '商品手配中' },
      { status: 'shipped', label: '発送済み' },
      { status: 'cancel_requested', label: 'キャンセル申請中' }
    ];
    
    for (const { status, label } of orderStatuses) {
      const orderCount = await prisma.order.count({
        where: { status }
      });

      if (orderCount > 0) {
        todos.push({
          id: `orders_${status}`,
          category: 'order_management',
          priority: 2,
          title: `${label}注文対応`,
          description: `${label}の注文が${orderCount}件あります`,
          count: orderCount,
          actionUrl: `/orders?status=${encodeURIComponent(status)}`,
          createdAt: new Date()
        });
      }
    }

    // 3. 価格未設定の商品を取得
    const unsetPriceProducts = await prisma.companyProduct.findMany({
      where: {
        enabled: true, // 有効な商品のみ
        price: null    // 価格が未設定
      },
      include: {
        company: true,
        productMaster: true
      }
    });

    console.log(`[DEBUG] 価格未設定商品数: ${unsetPriceProducts.length}`);

    // 会社別にグループ化して価格未設定TODOを作成
    const companiesWithUnsetPrice = new Map<number, {
      company: any;
      products: any[];
    }>();

    unsetPriceProducts.forEach(cp => {
      if (!companiesWithUnsetPrice.has(cp.companyId)) {
        companiesWithUnsetPrice.set(cp.companyId, {
          company: cp.company,
          products: []
        });
      }
      companiesWithUnsetPrice.get(cp.companyId)!.products.push(cp);
    });

    console.log(`[DEBUG] 価格未設定の会社数: ${companiesWithUnsetPrice.size}`);

    companiesWithUnsetPrice.forEach((data, companyId) => {
      const { company, products } = data;
      
      const productNames = products.map(p => p.productMaster.name).slice(0, 3).join('、');
      const moreText = products.length > 3 ? ` 他${products.length - 3}件` : '';
      
      todos.push({
        id: `unset_price_${companyId}`,
        category: 'quotation_management',
        priority: 3,
        title: `${company.name} - 価格未設定`,
        description: `${company.name}の「${productNames}${moreText}」の価格が未設定です。価格設定が必要です。`,
        count: products.length,
        actionUrl: `/companies/${companyId}/products`,
        createdAt: new Date()
      });
    });

    // 4. 見積期限未設定の商品を取得
    const unsetExpiryProducts = await prisma.companyProduct.findMany({
      where: {
        enabled: true, // 有効な商品のみ
        quotationExpiryDate: null // 見積期限が未設定
      },
      include: {
        company: true,
        productMaster: true
      }
    });

    console.log(`[DEBUG] 見積期限未設定商品数: ${unsetExpiryProducts.length}`);

    // 会社別にグループ化して見積期限未設定TODOを作成
    const companiesWithUnsetExpiry = new Map<number, {
      company: any;
      products: any[];
    }>();

    unsetExpiryProducts.forEach(cp => {
      if (!companiesWithUnsetExpiry.has(cp.companyId)) {
        companiesWithUnsetExpiry.set(cp.companyId, {
          company: cp.company,
          products: []
        });
      }
      companiesWithUnsetExpiry.get(cp.companyId)!.products.push(cp);
    });

    companiesWithUnsetExpiry.forEach((data, companyId) => {
      const { company, products } = data;
      
      const productNames = products.map(p => p.productMaster.name).slice(0, 3).join('、');
      const moreText = products.length > 3 ? ` 他${products.length - 3}件` : '';
      
      todos.push({
        id: `unset_expiry_${companyId}`,
        category: 'quotation_management',
        priority: 3,
        title: `${company.name} - 見積期限未設定`,
        description: `${company.name}の「${productNames}${moreText}」の見積期限が未設定です。見積期限の設定と見積書のアップロードが必要です。`,
        count: products.length,
        actionUrl: `/companies/${companyId}/products`,
        createdAt: new Date()
      });
    });

    // 5. 見積期限が1ヶ月以内に切れる商品を取得
    const oneMonthFromNow = new Date();
    oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);

    const expiringQuotations = await prisma.companyProduct.findMany({
      where: {
        enabled: true, // 有効な商品のみ
        quotationExpiryDate: {
          lte: oneMonthFromNow,
          gte: new Date()
        }
      },
      include: {
        company: true,
        productMaster: true,
        priceSchedules: {
          where: {
            effectiveDate: {
              gte: new Date(),
              lte: oneMonthFromNow
            },
            isApplied: false
          }
        }
      }
    });

    // 会社別にグループ化して見積期限管理TODOを作成
    const companiesWithExpiring = new Map<number, {
      company: any;
      products: any[];
    }>();

    expiringQuotations.forEach(cp => {
      if (!companiesWithExpiring.has(cp.companyId)) {
        companiesWithExpiring.set(cp.companyId, {
          company: cp.company,
          products: []
        });
      }
      companiesWithExpiring.get(cp.companyId)!.products.push(cp);
    });

    companiesWithExpiring.forEach((data, companyId) => {
      const { company, products } = data;
      
      // スケジュール価格が設定されていない商品のみをフィルタ
      const productsNeedingAction = products.filter(p => p.priceSchedules.length === 0);
      
      // 対応が必要な商品がある場合のみTODOを作成
      if (productsNeedingAction.length > 0) {
        const productNames = productsNeedingAction.map(p => p.productMaster.name).slice(0, 3).join('、');
        const moreText = productsNeedingAction.length > 3 ? ` 他${productsNeedingAction.length - 3}件` : '';
        
        todos.push({
          id: `quotation_expiry_${companyId}`,
          category: 'quotation_management',
          priority: 2,
          title: `${company.name} - 見積期限対応`,
          description: `${company.name}の「${productNames}${moreText}」の見積期限が1ヶ月以内に切れます。見積書更新（ドキュメント管理）と価格変更（商品設定）の対応が必要です。`,
          count: productsNeedingAction.length,
          actionUrl: `/companies/${companyId}/products`,
          createdAt: new Date()
        });
      }
    });
    
    // 優先度でソート
    todos.sort((a, b) => a.priority - b.priority);

    console.log(`[DEBUG] 生成されたTODO数: ${todos.length}`);
    console.log(`[DEBUG] TODO内訳 - 価格未設定: ${companiesWithUnsetPrice.size}社, 見積期限未設定: ${companiesWithUnsetExpiry.size}社, 見積期限間近: ${companiesWithExpiring.size}社`);

    res.status(200).json({
      todos,
      summary: {
        total: todos.length,
        byCategory: {
          user_management: todos.filter(t => t.category === 'user_management').length,
          order_management: todos.filter(t => t.category === 'order_management').length,
          quotation_management: todos.filter(t => t.category === 'quotation_management').length,
        }
      }
    });

  } catch (error) {
    console.error('Dashboard todos error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? getErrorMessage(error) : undefined
    });
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * 管理者トークン検証
 */
async function verifyAdminToken(req: NextApiRequest): Promise<AdminTokenPayload | null> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);
    
    // ダミートークンの場合（開発用）
    if (token === 'dummy-token') {
      if (process.env.NODE_ENV === 'development') {
        return {
          id: 1,
          username: 'admin',
          role: 'super_admin',
          email: 'admin@example.com'
        };
      }
      return null;
    }

    const decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET!) as AdminTokenPayload;
    
    const adminUser = await prisma.adminUser.findFirst({
      where: {
        id: decoded.id,
        status: 'active'
      }
    });

    if (!adminUser) {
      return null;
    }

    return decoded;
  } catch (error) {
    console.error('Admin token verification error:', error);
    return null;
  }
}