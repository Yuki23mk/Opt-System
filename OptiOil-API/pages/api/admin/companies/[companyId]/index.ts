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

  const { companyId } = req.query;
  const id = parseInt(companyId as string);

  if (req.method === 'GET') {
    try {
      const company = await prisma.company.findUnique({
        where: { id },
        include: {
          _count: {
            select: {
              users: true,
              companyProducts: true,
            },
          },
        },
      });

      if (!company) {
        return res.status(404).json({ error: 'Company not found' });
      }

      return res.status(200).json(company);
    } catch (error) {
      console.error('Error fetching company:', error);
      return res.status(500).json({ error: 'Failed to fetch company' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}