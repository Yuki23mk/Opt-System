/**
 * ファイルパス: OptiOil-API/pages/api/admin/auth/list-admins.ts
 * 管理者一覧取得API（セキュリティ強化版）
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { requireAdminAuth, AdminAuthRequest } from '../../../../utils/adminAuthMiddleware';

const prisma = new PrismaClient();

export default async function handler(req: AdminAuthRequest, res: NextApiResponse) {
  try {
    // CORS設定
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'GETメソッドのみ許可されています' });
    }

    // 🔒 セキュリティチェック: 管理者認証が必要
    const authResult = await requireAdminAuth(req, res);
    if (!authResult.success) {
      return res.status(401).json({ 
        error: '管理者一覧の閲覧には認証が必要です' 
      });
    }

    // 全管理者ユーザーを取得（パスワードハッシュは除外）
    const adminUsers = await prisma.adminUser.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        status: true,
        twoFactorEnabled: true,
        createdAt: true,
        lastLogin: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`📋 管理者一覧取得: ${adminUsers.length}件 (要求者: ${authResult.adminUser.username})`);

    return res.status(200).json({
      message: '管理者一覧を取得しました',
      admins: adminUsers,
      requestedBy: authResult.adminUser.username
    });

  } catch (error) {
    console.error('❌ 管理者一覧取得API エラー:', error);
    return res.status(500).json({ error: 'サーバーエラーが発生しました' });
  } finally {
    await prisma.$disconnect();
  }
}