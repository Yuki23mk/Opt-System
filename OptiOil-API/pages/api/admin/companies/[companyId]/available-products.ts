/**
 * ファイルパス: OptiOil-API/pages/api/admin/companies/[companyId]/available-products.ts
 * 管理者API - 会社別利用可能商品取得エンドポイント
 * 指定された会社のCompanyProductに紐づくAdminProductMasterを取得
 * 
 * 🔧 修正点: packageTypeフィールドを追加、型エラー修正
 */
import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

// CORS設定関数
const setCorsHeaders = (res: NextApiResponse) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
};

// JWTトークン検証ヘルパー
function verifyAdminToken(token: string) {
  try {
    const secret = process.env.ADMIN_JWT_SECRET;
    if (!secret) {
      throw new Error('ADMIN_JWT_SECRET is not configured');
    }
    return jwt.verify(token, secret);
  } catch (error) {
    return null;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // CORS設定を最初に適用
  setCorsHeaders(res);

  // OPTIONSメソッドへの対応（プリフライトリクエスト）
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GETメソッドのみ許可
  if (req.method !== 'GET') {
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  try {
    // 認証チェック
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '認証が必要です' });
    }

    const token = authHeader.substring(7);
    const decoded = verifyAdminToken(token);
    if (!decoded) {
      return res.status(401).json({ error: '無効なトークンです' });
    }

    // パラメータ取得
    const { companyId } = req.query;
    
    if (!companyId || isNaN(Number(companyId))) {
      return res.status(400).json({ error: '有効な会社IDが必要です' });
    }

    console.log(`🔍 会社ID ${companyId} の利用可能商品を取得中...`);

    // 会社の存在確認
    const company = await prisma.company.findUnique({
      where: { id: Number(companyId) }
    });

    if (!company) {
      return res.status(404).json({ error: '指定された会社が見つかりません' });
    }

    // その会社のCompanyProductに紐づくAdminProductMasterを取得
    const availableProducts = await prisma.adminProductMaster.findMany({
      where: {
        companyProducts: {
          some: {
            companyId: Number(companyId),
            enabled: true // 有効な商品のみ
          }
        },
        active: true // アクティブな商品マスターのみ
      },
      select: {
        id: true,
        code: true,
        name: true,
        manufacturer: true,
        capacity: true,
        unit: true,
        packageType: true, // 🔧 packageTypeフィールドを追加
        oilType: true,
        internalTag: true
      },
      orderBy: [
        { manufacturer: 'asc' },
        { name: 'asc' }
      ]
    });

    // 🔧 デバッグログ：各商品のpackageType情報を出力
    availableProducts.forEach((product, index) => {
      console.log(`📋 商品${index + 1} ${product.code} (${product.name}):`, {
        packageType: product.packageType,
        packageTypeIsNull: product.packageType === null,
        packageTypeType: typeof product.packageType
      });
    });

    // 🔧 荷姿設定状況の統計
    const withPackageType = availableProducts.filter(p => p.packageType !== null);
    const withoutPackageType = availableProducts.filter(p => p.packageType === null);
    
    console.log(`📊 会社ID ${companyId} - 荷姿設定済み: ${withPackageType.length}件, 未設定: ${withoutPackageType.length}件`);
    
    if (withoutPackageType.length > 0) {
      console.log(`⚠️ 荷姿未設定商品:`, withoutPackageType.map(p => `${p.code}(${p.name})`));
    }

    console.log(`✅ 会社ID ${companyId} の利用可能商品を取得: ${availableProducts.length}件`);
    res.status(200).json(availableProducts);

  } catch (error) {
    console.error('❌ 利用可能商品取得エラー:', error);
    
    // 🔧 型安全なエラーハンドリング
    const errorMessage = error instanceof Error ? error.message : '不明なエラーが発生しました';
    
    res.status(500).json({ 
      error: '利用可能商品の取得に失敗しました',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
    });
  } finally {
    await prisma.$disconnect();
  }
}