import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';

const setCorsHeaders = (res: NextApiResponse) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { productId } = req.query;
  const id = parseInt(productId as string);

  if (req.method === 'PATCH') {
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