import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';

const setCorsHeaders = (res: NextApiResponse) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { productId } = req.query;
  const id = parseInt(productId as string);

  if (req.method === 'PUT') {
    // 商品更新
    try {
      const {
        code,
        name,
        manufacturer,
        capacity,
        unit,
        oilType,
        internalTag,
      } = req.body;

      const product = await prisma.adminProductMaster.update({
        where: { id },
        data: {
          code,
          name,
          manufacturer,
          capacity,
          unit,
          oilType,
          internalTag: internalTag || null,
        },
      });

      return res.status(200).json(product);
    } catch (error) {
      console.error('Error updating product:', error);
      return res.status(500).json({ error: 'Failed to update product' });
    }
  }

  if (req.method === 'DELETE') {
    // 商品削除
    try {
      // トランザクションで関連データも削除
      await prisma.$transaction(async (tx) => {
        // 関連するCompanyProductを削除
        await tx.companyProduct.deleteMany({
          where: { productMasterId: id },
        });

        // 商品マスタを削除
        await tx.adminProductMaster.delete({
          where: { id },
        });
      });

      return res.status(200).json({ message: 'Product deleted successfully' });
    } catch (error) {
      console.error('Error deleting product:', error);
      return res.status(500).json({ error: 'Failed to delete product' });
    }
  }

  if (req.method === 'PATCH') {
    // ステータス切替のための新しいエンドポイント
    try {
      const { active } = req.body;

      const product = await prisma.adminProductMaster.update({
        where: { id },
        data: { active },
      });

      return res.status(200).json(product);
    } catch (error) {
      console.error('Error updating product status:', error);
      return res.status(500).json({ error: 'Failed to update product status' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}