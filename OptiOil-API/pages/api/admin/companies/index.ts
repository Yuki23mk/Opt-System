import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';

const setCorsHeaders = (res: NextApiResponse) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    try {
      const companies = await prisma.company.findMany({
        include: {
          _count: {
            select: {
              users: true,
              companyProducts: true,
            },
          },
        },
        orderBy: { name: 'asc' },
      });

      return res.status(200).json(companies);
    } catch (error) {
      console.error('Error fetching companies:', error);
      return res.status(500).json({ error: 'Failed to fetch companies' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}