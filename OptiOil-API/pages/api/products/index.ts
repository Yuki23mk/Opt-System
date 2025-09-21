//OptiOil-API/pages/api/products/index.ts (packageType追加版)
//JWTではuserid, companyId, emailを使用
import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { verifyTokenEnhanced, handleSecurityError } from '../../../utils/authSecurity';

const prisma = new PrismaClient();

// 🔒 環境変数の安全な取得
const FRONTEND_URL = process.env.NEXT_PUBLIC_FRONTEND_URL;
if (!FRONTEND_URL) {
  throw new Error('NEXT_PUBLIC_FRONTEND_URL環境変数が設定されていません。本番環境では必須です。');
}

const NODE_ENV = process.env.NODE_ENV || 'development';

console.log('Products API初期化:');
console.log('- FRONTEND_URL:', FRONTEND_URL);
console.log('- NODE_ENV:', NODE_ENV);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // 🔒 セキュリティ強化されたCORS設定
    res.setHeader('Access-Control-Allow-Origin', FRONTEND_URL!); // ✅ Non-null assertion
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, Cache-Control, X-Requested-With');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '86400');

    if (req.method === 'OPTIONS') {
      console.log('🔄 CORS プリフライトリクエスト処理');
      return res.status(200).end();
    }

    console.log('🏪 Products API呼び出し:', { 
      method: req.method, 
      origin: req.headers.origin 
    });

    // 🔒 セキュリティ強化された認証
    const user = verifyTokenEnhanced(req);
    console.log('✅ 認証成功 - ユーザー:', user.id, '会社:', user.companyId);
    
    if (req.method === 'POST') {
      const { name, price, description } = req.body;
      const product = await prisma.adminProductMaster.create({
        data: { 
          name, 
          manufacturer: 'Unknown',
          code: `AUTO_${Date.now()}`,
          capacity: '1',
          unit: 'L',
          oilType: 'Unknown',
          packageType: null, // 🆕 荷姿項目（新規作成時はnull）
          internalTag: description || null,
        }
      });
      console.log('✅ 製品登録成功:', product.id, product.name);
      res.status(201).json({ message: '製品登録成功', data: product });
      
    } else if (req.method === 'GET') {
      // ユーザーの会社IDを取得
      const userCompanyId = user.companyId;
      
      if (!userCompanyId) {
        console.log('🚫 ユーザーの会社情報が見つかりません');
        return res.status(400).json({ message: 'ユーザーの会社情報が見つかりません' });
      }

      console.log('🏪 商品取得開始 - 会社ID:', userCompanyId);

      // 会社に設定された商品を取得
      const companyProducts = await prisma.companyProduct.findMany({
        where: {
          companyId: userCompanyId,
          productMaster: {
            active: true
          }
        },
        include: {
          productMaster: true
        },
        orderBy: [
          { displayOrder: "asc" },
          { createdAt: "asc" }
        ]
      });

      console.log('📦 取得した会社製品数:', companyProducts.length);

      // 商品マスターIDを取得（AdminProductMasterのID）
      const productMasterIds = companyProducts.map(cp => cp.productMaster.id);
      console.log('🏷️ 商品マスターIDs:', productMasterIds);

      // ユーザータグを別途取得（実際のDBではproductMasterIdを使用）
      const userTags = await prisma.userTag.findMany({
        where: {
          productMasterId: { in: productMasterIds }, // 実際のDBスキーマに合わせてproductMasterIdを使用
          companyId: userCompanyId,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: {
          createdAt: 'asc'
        }
      });

      console.log('🏷️ 取得したタグ数:', userTags.length);
      if (userTags.length > 0) {
        userTags.forEach(tag => {
          console.log(`🏷️ タグ: ${tag.name} (商品マスターID: ${tag.productMasterId})`);
        });
      }

      // 商品マスターごとにタグをグループ化
      const tagsByProductMaster: Record<number, any[]> = {};
      userTags.forEach(tag => {
        const productMasterId = tag.productMasterId;
        if (!tagsByProductMaster[productMasterId]) {
          tagsByProductMaster[productMasterId] = [];
        }
        tagsByProductMaster[productMasterId].push({
          id: tag.id,
          name: tag.name,
          color: tag.color,
          createdBy: tag.user.name,
          createdById: tag.user.id,
          createdAt: tag.createdAt
        });
      });

      // レスポンス用データの構築
      const responseData = companyProducts.map(companyProduct => {
        const productMasterId = companyProduct.productMaster.id;
        const productTags = tagsByProductMaster[productMasterId] || [];
        
        console.log(`📦 商品「${companyProduct.productMaster.name}」:`, {
          productMasterId,
          companyProductId: companyProduct.id,
          enabled: companyProduct.enabled,
          packageType: companyProduct.productMaster.packageType, // 🆕 荷姿ログ出力
          tagCount: productTags.length
        });
        
        return {
          // ★★★ 重要：AdminProductMasterのIDをidとして返す（ドキュメントAPIで使用）
          id: productMasterId,
          code: companyProduct.productMaster.code,
          name: companyProduct.productMaster.name,
          manufacturer: companyProduct.productMaster.manufacturer,
          capacity: companyProduct.productMaster.capacity,
          unit: companyProduct.productMaster.unit,
          oilType: companyProduct.productMaster.oilType,
          packageType: companyProduct.productMaster.packageType, // 🆕 荷姿項目追加
          tags: companyProduct.productMaster.internalTag || '',
          displayOrder: companyProduct.displayOrder || 0,
          price: companyProduct.price || 0,
          packaging: '', // 既存のフロントエンドとの互換性のため保持（packageTypeとは別項目）
          userTags: productTags,
          // 会社レベルの有効/無効
          enabled: companyProduct.enabled,
          // CompanyProductのID（カート・注文で必要）
          companyProductId: companyProduct.id,
          // 🆕 見積期限を追加
          quotationExpiryDate: companyProduct.quotationExpiryDate,
          // ★★★ デバッグ用：明示的にproductMasterIdも含める
          productMasterId: productMasterId
        };
      });

      // 最初の商品の詳細をログ出力（デバッグ用）
      if (responseData.length > 0) {
        const firstProduct = responseData[0];
        console.log('📦 最初の商品詳細:', {
          id: firstProduct.id,
          productMasterId: firstProduct.productMasterId,
          name: firstProduct.name,
          packageType: firstProduct.packageType, // 🆕 荷姿ログ出力
          companyProductId: firstProduct.companyProductId,
          enabled: firstProduct.enabled
        });
      }

      return res.status(200).json(responseData);
      
    } else {
      console.log('🚫 許可されていないメソッド:', req.method);
      res.setHeader('Allow', ['GET', 'POST']);
      return res.status(405).json({ message: '許可されていないメソッドです' });
    }
  } catch (error) {
    // 🔒 セキュリティ強化されたエラーハンドリング
    return handleSecurityError(res, error, req);
  } finally {
    await prisma.$disconnect();
  }
}