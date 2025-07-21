import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';

// CORS設定
const setCorsHeaders = (res: NextApiResponse) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setCorsHeaders(res);

  // OPTIONS リクエスト対応
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 開発中は認証をスキップ（本番では認証を追加）
  // const token = req.headers.authorization?.replace('Bearer ', '');
  // if (!token) {
  //   return res.status(401).json({ error: 'Unauthorized' });
  // }

  if (req.method === 'GET') {
    try {
      const { search = '' } = req.query;
      const searchStr = Array.isArray(search) ? search[0] : search;

      const products = await prisma.adminProductMaster.findMany({
        where: searchStr ? {
          OR: [
            { code: { contains: searchStr } },
            { name: { contains: searchStr } },
            { manufacturer: { contains: searchStr } },
            { oilType: { contains: searchStr } },
          ],
        } : undefined,
        orderBy: { code: 'asc' },
      });

      return res.status(200).json(products);
    } catch (error) {
      console.error('Error fetching products:', error);
      return res.status(500).json({ error: 'Failed to fetch products' });
    }
  }

  if (req.method === 'POST') {
    try {
      const data = req.body;

      // 商品コードの重複チェック
      const existing = await prisma.adminProductMaster.findUnique({
        where: { code: data.code },
      });

      if (existing) {
        return res.status(400).json({ error: '商品コードが既に存在します' });
      }

      const product = await prisma.adminProductMaster.create({
        data: {
          code: data.code,
          name: data.name,
          manufacturer: data.manufacturer,
          capacity: data.capacity,
          unit: data.unit,
          oilType: data.oilType,
          internalTag: data.internalTag || null,
          active: true,
        },
      });

      // 開発中はログ記録をスキップ
      // await prisma.adminOperationLog.create({...});

      return res.status(201).json(product);
    } catch (error) {
      console.error('Error creating product:', error);
      return res.status(500).json({ error: 'Failed to create product' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}