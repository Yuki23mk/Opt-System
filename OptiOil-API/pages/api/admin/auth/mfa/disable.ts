/**
 * ファイルパス: OptiOil-API/pages/api/admin/auth/mfa/disable.ts
 * 管理者MFA無効化API - Prisma JSON型エラー修正版
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient, Prisma } from '@prisma/client'; // ✅ Prismaを追加インポート
import { authenticator } from 'otplib';
import { verifyTokenEnhanced, handleSecurityError } from '../../../../../utils/authSecurity';
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

    const { token: twoFactorToken, backupCode, password } = req.body;

    // 認証方法の確認
    if (!twoFactorToken && !backupCode) {
      return res.status(400).json({ error: '認証コードまたはバックアップコードが必要です' });
    }

    if (!password) {
      return res.status(400).json({ error: 'パスワードの再入力が必要です' });
    }

    // JWT認証
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: '認証が必要です' });
    }

    const authToken = authHeader.split(' ')[1];
    const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET;
    if (!ADMIN_JWT_SECRET) {
      throw new Error('ADMIN_JWT_SECRET環境変数が設定されていません');
    }    
    let adminData;
    try {
      adminData = jwt.verify(authToken, ADMIN_JWT_SECRET) as any;
    } catch (error) {
      return res.status(401).json({ error: '無効なトークンです' });
    }

    // 管理者情報取得
    const adminUser = await prisma.adminUser.findUnique({
      where: { id: adminData.id }
    });

    if (!adminUser || adminUser.status !== 'active') {
      return res.status(401).json({ error: '管理者が見つからないか無効です' });
    }

    // MFAが有効でない場合
    if (!adminUser.twoFactorEnabled) {
      return res.status(400).json({ error: 'MFAが有効になっていません' });
    }

    // パスワード確認（bcryptでハッシュ化されている場合）
    const bcrypt = require('bcryptjs');
    const isPasswordValid = await bcrypt.compare(password, adminUser.passwordHash);
    if (!isPasswordValid) {
      return res.status(400).json({ error: 'パスワードが正しくありません' });
    }

    let isAuthValid = false;

    // MFAトークンによる認証
    if (twoFactorToken && adminUser.twoFactorSecret) {
      isAuthValid = authenticator.verify({
        token: twoFactorToken,
        secret: adminUser.twoFactorSecret
      });
    }

    // バックアップコードによる認証
    if (!isAuthValid && backupCode && adminUser.backupCodes) {
      const backupCodes = adminUser.backupCodes as string[];
      const codeIndex = backupCodes.findIndex(code => code === backupCode.toUpperCase());
      
      if (codeIndex !== -1) {
        isAuthValid = true;
        // 使用されたバックアップコードを削除
        const updatedBackupCodes = backupCodes.filter((_, index) => index !== codeIndex);
        
        await prisma.adminUser.update({
          where: { id: adminUser.id },
          data: { backupCodes: updatedBackupCodes }
        });
      }
    }

    if (!isAuthValid) {
      console.log('❌ 管理者MFA無効化認証失敗:', {
        adminId: adminUser.id,
        username: adminUser.username,
        authMethod: twoFactorToken ? 'MFA_TOKEN' : 'BACKUP_CODE'
      });
      return res.status(400).json({ error: '認証に失敗しました' });
    }

    // ✅ MFA無効化 - Prisma.JsonNull使用
    await prisma.adminUser.update({
      where: { id: adminUser.id },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        backupCodes: Prisma.JsonNull, // ✅ null の代わりに Prisma.JsonNull を使用
        updatedAt: new Date()
      }
    });

    console.log('✅ 管理者MFA無効化完了:', {
      adminId: adminUser.id,
      username: adminUser.username
    });

    return res.status(200).json({
      message: 'MFAを無効にしました',
      notice: '今後はユーザー名とパスワードのみでログインできます'
    });

  } catch (error) {
    console.error('❌ 管理者MFA無効化API エラー:', error);
    return res.status(500).json({ error: 'サーバーエラーが発生しました' });
  } finally {
    await prisma.$disconnect();
  }
}