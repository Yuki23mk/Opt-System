/**
 * ファイルパス: OptiOil-API/pages/api/admin/auth/create-admin.ts
 * 管理者アカウント追加API（セキュリティ強化版）
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { requireAdminAuth, isFirstTimeSetup, AdminAuthRequest } from '../../../../utils/adminAuthMiddleware';

const prisma = new PrismaClient();

export default async function handler(req: AdminAuthRequest, res: NextApiResponse) {
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

    const { username, email, password } = req.body;

    // バリデーション
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'ユーザー名、メールアドレス、パスワードが必要です' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'パスワードは6文字以上である必要があります' });
    }

    // 🔒 セキュリティチェック: 初回セットアップか既存管理者の認証が必要
    const isFirstSetup = await isFirstTimeSetup();
    
    if (!isFirstSetup) {
      // 初回セットアップでない場合は管理者認証が必要
      const authResult = await requireAdminAuth(req, res);
      if (!authResult.success) {
        return res.status(401).json({ 
          error: '管理者作成には認証が必要です。管理者でログインしてください。' 
        });
      }
      
      console.log('✅ 管理者による新規アカウント作成:', {
        createdBy: authResult.adminUser.username,
        newUsername: username
      });
    } else {
      console.log('🆕 初回セットアップによる管理者アカウント作成:', username);
    }

    // 既存ユーザーチェック
    const existingUser = await prisma.adminUser.findFirst({
      where: {
        OR: [
          { username },
          { email }
        ]
      }
    });

    if (existingUser) {
      return res.status(400).json({ 
        error: existingUser.username === username 
          ? 'このユーザー名は既に使用されています' 
          : 'このメールアドレスは既に使用されています'
      });
    }

    // パスワードハッシュ化
    const hashedPassword = await bcrypt.hash(password, 10);

    // 新しい管理者作成
    const newAdmin = await prisma.adminUser.create({
      data: {
        username,
        email,
        passwordHash: hashedPassword,
        role: 'admin',
        status: 'active'
      }
    });

    console.log('✅ 新しい管理者アカウントを作成:', {
      id: newAdmin.id,
      username: newAdmin.username,
      email: newAdmin.email,
      role: newAdmin.role,
      isFirstSetup
    });

    return res.status(201).json({
      message: isFirstSetup 
        ? '初回管理者アカウントを作成しました' 
        : '管理者アカウントを作成しました',
      admin: {
        id: newAdmin.id,
        username: newAdmin.username,
        email: newAdmin.email,
        role: newAdmin.role,
        status: newAdmin.status
      },
      isFirstSetup
    });

  } catch (error) {
    console.error('❌ 管理者アカウント作成API エラー:', error);
    return res.status(500).json({ error: 'サーバーエラーが発生しました' });
  } finally {
    await prisma.$disconnect();
  }
}