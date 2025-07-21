/**
 * ファイルパス: OptiOil-API/pages/api/admin/auth/mfa/login-verify.ts
 * ログイン時MFA認証API
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
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

    const { adminId, token: twoFactorToken, backupCode } = req.body;

    if (!adminId) {
      return res.status(400).json({ error: '管理者IDが必要です' });
    }

    if (!twoFactorToken && !backupCode) {
      return res.status(400).json({ error: '認証コードまたはバックアップコードが必要です' });
    }

    // 管理者情報取得
    const adminUser = await prisma.adminUser.findUnique({
      where: { id: parseInt(adminId) }
    });

    if (!adminUser || adminUser.status !== 'active') {
      return res.status(401).json({ error: '管理者が見つからないか無効です' });
    }

    // MFAが有効でない場合
    if (!adminUser.twoFactorEnabled) {
      return res.status(400).json({ error: 'MFAが有効になっていません' });
    }

    let isAuthValid = false;
    let usedBackupCode = false;

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
        usedBackupCode = true;
        
        // 使用されたバックアップコードを削除
        const updatedBackupCodes = backupCodes.filter((_, index) => index !== codeIndex);
        
        await prisma.adminUser.update({
          where: { id: adminUser.id },
          data: { backupCodes: updatedBackupCodes }
        });

        console.log('🔑 バックアップコード使用:', {
          adminId: adminUser.id,
          username: adminUser.username,
          remainingCodes: updatedBackupCodes.length
        });
      }
    }

    if (!isAuthValid) {
      console.log('❌ 管理者MFAログイン認証失敗:', {
        adminId: adminUser.id,
        username: adminUser.username,
        authMethod: twoFactorToken ? 'MFA_TOKEN' : 'BACKUP_CODE',
        providedToken: twoFactorToken || backupCode
      });
      return res.status(400).json({ error: '認証コードが正しくありません' });
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

    console.log('✅ 管理者MFAログイン成功:', { 
      id: adminUser.id, 
      username: adminUser.username,
      role: adminUser.role,
      authMethod: twoFactorToken ? 'MFA_TOKEN' : 'BACKUP_CODE'
    });

    // レスポンス
    const response: any = {
      message: 'MFA認証に成功しました',
      token: adminToken,
      user: {
        id: adminUser.id,
        username: adminUser.username,
        email: adminUser.email,
        role: adminUser.role
      }
    };

    // バックアップコード使用時の警告
    if (usedBackupCode) {
      const remainingCodes = (adminUser.backupCodes as string[]).length - 1;
      response.warning = `バックアップコードを使用しました。残り${remainingCodes}個です。`;
      
      if (remainingCodes <= 2) {
        response.alert = 'バックアップコードが残り少なくなっています。新しいコードを生成することをお勧めします。';
      }
    }

    return res.status(200).json(response);

  } catch (error) {
    console.error('❌ 管理者MFAログイン認証API エラー:', error);
    return res.status(500).json({ error: 'サーバーエラーが発生しました' });
  } finally {
    await prisma.$disconnect();
  }
}