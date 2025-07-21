import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

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

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // JWT認証
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: '認証が必要です' });
    }

    const decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET!) as any;
    if (!decoded.id && !decoded.adminId) {
      return res.status(401).json({ error: '無効なトークンです' });
    }

    // ユーザー一覧取得（会社情報含む）
    const users = await prisma.user.findMany({
      include: {
        companyRel: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        { status: 'asc' }, // pending が先頭に
        { createdAt: 'desc' },
      ],
    });

    return res.status(200).json({ 
      users: users.map(user => ({
        id: user.id,
        name: user.name,
        email: user.email,
        companyRel: user.companyRel,
        department: user.department,
        position: user.position,
        phone: user.phone,
        status: user.status,
        createdAt: user.createdAt,
        systemRole: user.systemRole,
      }))
    });

  } catch (error) {
    console.error('ユーザー取得エラー:', error);
    return res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
}