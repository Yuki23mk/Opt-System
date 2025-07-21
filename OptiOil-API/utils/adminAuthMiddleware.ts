/**
 * ファイルパス: OptiOil-API/utils/adminAuthMiddleware.ts
 * 管理者認証チェック用ミドルウェア
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

export interface AdminAuthRequest extends NextApiRequest {
  adminUser?: {
    id: number;
    username: string;
    email: string;
    role: string;
  };
}

export const requireAdminAuth = async (
  req: AdminAuthRequest,
  res: NextApiResponse
): Promise<{ success: boolean; adminUser?: any }> => {
  try {
    // JWT認証チェック
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return { success: false };
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
      return { success: false };
    }

    // 管理者情報の確認
    const adminUser = await prisma.adminUser.findUnique({
      where: { id: adminData.id },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        status: true,
      },
    });

    if (!adminUser || adminUser.status !== 'active') {
      return { success: false };
    }

    // リクエストオブジェクトに管理者情報を追加
    req.adminUser = adminUser;
    return { success: true, adminUser };

  } catch (error) {
    console.error('❌ 管理者認証エラー:', error);
    return { success: false };
  } finally {
    await prisma.$disconnect();
  }
};

export const isFirstTimeSetup = async (): Promise<boolean> => {
  try {
    const adminCount = await prisma.adminUser.count();
    return adminCount === 0;
  } catch (error) {
    console.error('❌ 初回セットアップチェックエラー:', error);
    return false;
  } finally {
    await prisma.$disconnect();
  }
};