/**
 * ファイルパス: OptiOil-API/pages/api/admin/auth/login.ts
 * 管理者ログインAPI（AdminUserテーブル使用）
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { verifyTokenEnhanced, handleSecurityError } from '../../../../utils/authSecurity';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // CORS設定
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'POSTメソッドのみ許可されています' });
    }

    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'ユーザー名とパスワードが必要です' });
    }

    // AdminUserテーブルから管理者情報を取得
    const adminUser = await prisma.adminUser.findUnique({
      where: { username }
    });

    if (!adminUser) {
      console.log('❌ 管理者ユーザーが見つかりません:', username);
      return res.status(401).json({ error: 'ユーザー名またはパスワードが正しくありません' });
    }

    // ステータスチェック
    if (adminUser.status !== 'active') {
      console.log('❌ 管理者アカウントが無効です:', { username, status: adminUser.status });
      return res.status(401).json({ error: 'アカウントが無効です' });
    }

    // パスワード検証
    const isPasswordValid = await bcrypt.compare(password, adminUser.passwordHash);
    if (!isPasswordValid) {
      console.log('❌ 管理者パスワードが間違っています:', username);
      return res.status(401).json({ error: 'ユーザー名またはパスワードが正しくありません' });
    }

    // MFA有効チェック
    if (adminUser.twoFactorEnabled) {
      console.log('🔐 管理者MFA認証が必要:', {
        id: adminUser.id,
        username: adminUser.username
      });

      return res.status(200).json({
        message: 'MFA認証が必要です',
        requiresMultiFactor: true,
        adminId: adminUser.id,
        username: adminUser.username
      });
    }

    // 最終ログイン時刻を更新
    await prisma.adminUser.update({
      where: { id: adminUser.id },
      data: { lastLogin: new Date() }
    });

    // 管理者JWTトークン生成
    const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET;
    if (!ADMIN_JWT_SECRET) {
      throw new Error('ADMIN_JWT_SECRET環境変数が設定されていません');
    }
    
    const adminToken = jwt.sign(
      { 
        id: adminUser.id,
        username: adminUser.username,
        email: adminUser.email,
        role: adminUser.role,
        isAdmin: true
      },
      ADMIN_JWT_SECRET,
      { expiresIn: '7d' }
    );

    console.log('✅ 管理者ログイン成功:', { 
      id: adminUser.id, 
      username: adminUser.username,
      role: adminUser.role 
    });

    return res.status(200).json({
      message: '管理者ログインに成功しました',
      token: adminToken,
      user: {
        id: adminUser.id,
        username: adminUser.username,
        email: adminUser.email,
        role: adminUser.role
      }
    });

  } catch (error) {
    console.error('❌ 管理者ログインAPI エラー:', error);
    return res.status(500).json({ error: 'サーバーエラーが発生しました' });
  } finally {
    await prisma.$disconnect();
  }
}