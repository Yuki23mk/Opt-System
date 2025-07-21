/**
 * ファイルパス: OptiOil-API/pages/api/admin/auth/mfa/backup-codes.ts
 * バックアップコード管理API
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { authenticator } from 'otplib';
import { verifyTokenEnhanced, handleSecurityError } from '../../../../../utils/authSecurity';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

// バックアップコード生成関数
function generateBackupCodes(count: number = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    codes.push(`${code.substring(0, 4)}-${code.substring(4, 8)}`);
  }
  return codes;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // CORS設定
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
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

    // GET: バックアップコード表示
    if (req.method === 'GET') {
      const backupCodes = adminUser.backupCodes as string[] || [];
      
      return res.status(200).json({
        message: 'バックアップコードを取得しました',
        backupCodes: backupCodes,
        totalCodes: backupCodes.length,
        notice: [
          'これらのコードは認証アプリが利用できない場合に使用できます',
          '各コードは一度のみ使用可能です',
          'コードを安全な場所に保存してください'
        ]
      });
    }

    // POST: バックアップコード再生成
    if (req.method === 'POST') {
      const { token: twoFactorToken, regenerate } = req.body;

      if (!regenerate) {
        return res.status(400).json({ error: 'regenerateフラグが必要です' });
      }

      if (!twoFactorToken) {
        return res.status(400).json({ error: '認証コードが必要です' });
      }

      // MFA認証
      if (!adminUser.twoFactorSecret) {
        return res.status(400).json({ error: 'MFAシークレットが設定されていません' });
      }

      const isValid = authenticator.verify({
        token: twoFactorToken,
        secret: adminUser.twoFactorSecret
      });

      if (!isValid) {
        console.log('❌ バックアップコード再生成認証失敗:', {
          adminId: adminUser.id,
          username: adminUser.username
        });
        return res.status(400).json({ error: '認証コードが正しくありません' });
      }

      // 新しいバックアップコード生成
      const newBackupCodes = generateBackupCodes(10);

      await prisma.adminUser.update({
        where: { id: adminUser.id },
        data: {
          backupCodes: newBackupCodes,
          updatedAt: new Date()
        }
      });

      console.log('✅ バックアップコード再生成完了:', {
        adminId: adminUser.id,
        username: adminUser.username,
        newCodesCount: newBackupCodes.length
      });

      return res.status(200).json({
        message: 'バックアップコードを再生成しました',
        backupCodes: newBackupCodes,
        warning: [
          '古いバックアップコードは無効になりました',
          '新しいコードを安全な場所に保存してください'
        ]
      });
    }

    return res.status(405).json({ error: 'GETまたはPOSTメソッドのみ許可されています' });

  } catch (error) {
    console.error('❌ バックアップコード管理API エラー:', error);
    return res.status(500).json({ error: 'サーバーエラーが発生しました' });
  } finally {
    await prisma.$disconnect();
  }
}