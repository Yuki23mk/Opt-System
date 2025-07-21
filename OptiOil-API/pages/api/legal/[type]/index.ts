// OptiOil-API/pages/api/legal/[type]/index.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { type } = req.query;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // typeの検証
    const validTypes = ['terms', 'privacy', 'beta-terms'];
    if (!validTypes.includes(type as string)) {
      return res.status(400).json({ error: 'Invalid document type' });
    }

    // データベースから最新の有効な文書を取得
    const document = await prisma.legalDocument.findFirst({
      where: {
        type: type as string,
        isActive: true
      },
      orderBy: {
        publishedAt: 'desc'
      },
      select: {
        id: true,
        title: true,
        version: true,
        publishedAt: true,
        metadata: true
      }
    });

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.status(200).json(document);
  } catch (error) {
    console.error('Legal document fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}