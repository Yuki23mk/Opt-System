import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';

const setCorsHeaders = (res: NextApiResponse) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { companyId } = req.query;
  const id = parseInt(companyId as string);

  if (req.method === 'GET') {
    try {
      const { search = '' } = req.query;
      const searchStr = Array.isArray(search) ? search[0] : search;

      const products = await prisma.adminProductMaster.findMany({
        where: {
          active: true,
          ...(searchStr ? {
            OR: [
              { code: { contains: searchStr } },
              { name: { contains: searchStr } },
              { manufacturer: { contains: searchStr } },
              { oilType: { contains: searchStr } },
            ],
          } : {}),
        },
        include: {
          companyProducts: {
            where: { companyId: id },
            select: {
              id: true,
              enabled: true,
              displayOrder: true,
              price: true,
              quotationExpiryDate: true, // 🆕 見積期限追加
            },
          },
        },
        orderBy: { code: 'asc' },
      });

      const formattedProducts = products.map(product => ({
        ...product,
        companyProduct: product.companyProducts[0] || null,
        companyProducts: undefined,
      }));

      return res.status(200).json(formattedProducts);
    } catch (error) {
      console.error('Error fetching company products:', error);
      return res.status(500).json({ error: 'Failed to fetch company products' });
    }
  }

  if (req.method === 'PUT') {
    try {
      const { productIds } = req.body;

      await prisma.$transaction(async (tx) => {
        // 既存の商品を取得
        const existingProducts = await tx.companyProduct.findMany({
          where: { companyId: id },
        });

        // 削除対象と保持対象を分離
        const existingProductIds = existingProducts.map(p => p.productMasterId);
        const toDelete = existingProductIds.filter(id => !productIds.includes(id));
        const toAdd = productIds.filter((id: number) => !existingProductIds.includes(id));

        // 不要な商品のみ削除（スケジュール価格も一緒に削除される）
        if (toDelete.length > 0) {
          await tx.companyProduct.deleteMany({
            where: { 
              companyId: id,
              productMasterId: { in: toDelete }
            },
          });
        }

        // 新規商品のみ追加
        if (toAdd.length > 0) {
          await tx.companyProduct.createMany({
            data: toAdd.map((productId: number, index: number) => ({
              companyId: id,
              productMasterId: productId,
              enabled: true,
              displayOrder: existingProducts.length + index + 1,
              price: null,
              quotationExpiryDate: null, // 🆕 初期値はnull
            })),
          });
        }
      });

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error updating company products:', error);
      return res.status(500).json({ error: 'Failed to update company products' });
    }
  }

if (req.method === 'PATCH') {
    try {
      const { companyProductId, price, quotationExpiryDate } = req.body;

      if (!companyProductId) {
        return res.status(400).json({ error: 'Company product ID is required' });
      }

      // 更新データの準備
      const updateData: any = {};
      
      // 価格の更新
      if (price !== undefined) {
        updateData.price = price ? parseFloat(price) : null;
      }
      
      // 見積期限の更新
      if (quotationExpiryDate !== undefined) {
        updateData.quotationExpiryDate = quotationExpiryDate ? new Date(quotationExpiryDate) : null;
      }

      const updatedProduct = await prisma.companyProduct.update({
        where: { 
          id: companyProductId,
          companyId: id, // 安全のため会社IDも確認
        },
        data: updateData,
        include: {
          productMaster: true,
        },
      });

      // 🗑️ メール通知機能は削除済

      return res.status(200).json(updatedProduct);
    } catch (error) {
      console.error('Error updating product:', error);
      return res.status(500).json({ error: 'Failed to update product' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}