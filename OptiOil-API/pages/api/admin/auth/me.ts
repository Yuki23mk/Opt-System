/**
 * ファイルパス: OptiOil-API/pages/api/admin/auth/me.ts
 * 管理者認証状態確認API
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { verifyTokenEnhanced, handleSecurityError } from '../../../../utils/authSecurity';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // CORS設定を最初に適用
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // OPTIONSリクエストの処理
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'GETメソッドのみ許可されています' });
  }

  try {
    // JWT認証
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: '認証が必要です' });
    }

    const token = authHeader.split(' ')[1];
    const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET;
    if (!ADMIN_JWT_SECRET) {
      throw new Error('ADMIN_JWT_SECRET環境変数が設定されていません');
    }
        
    let adminData;
    try {
      adminData = jwt.verify(token, ADMIN_JWT_SECRET) as any;
    } catch (error) {
      return res.status(401).json({ error: '無効なトークンです' });
    }

    // 管理者情報取得
    const adminUser = await prisma.adminUser.findUnique({
      where: { id: adminData.id },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        status: true,
        twoFactorEnabled: true,
        lastLogin: true,
      },
    });

    if (!adminUser || adminUser.status !== 'active') {
      return res.status(401).json({ error: '管理者が見つからないか無効です' });
    }

    return res.status(200).json(adminUser);

  } catch (error) {
    console.error('❌ 管理者認証状態確認API エラー:', error);
    return res.status(500).json({ error: 'サーバーエラーが発生しました' });
  } finally {
    await prisma.$disconnect();
  }
}