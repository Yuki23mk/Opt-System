/**
 * ファイルパス: OptiOil-API/pages/api/admin/auth/mfa/verify.ts
 * 管理者MFA設定完了API（認証コード確認）
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
    // 8桁のランダムな英数字コード生成
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    codes.push(`${code.substring(0, 4)}-${code.substring(4, 8)}`);
  }
  return codes;
}

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

    const { token: twoFactorToken } = req.body;

    if (!twoFactorToken) {
      return res.status(400).json({ error: '認証コードが必要です' });
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

    // MFAシークレットが設定されているかチェック
    if (!adminUser.twoFactorSecret) {
      return res.status(400).json({ error: 'MFA設定が開始されていません' });
    }

    // 既にMFAが有効の場合
    if (adminUser.twoFactorEnabled) {
      return res.status(400).json({ error: 'MFAは既に有効になっています' });
    }

    // トークン検証
    const isValid = authenticator.verify({
      token: twoFactorToken,
      secret: adminUser.twoFactorSecret
    });

    if (!isValid) {
      console.log('❌ 管理者MFA認証失敗:', {
        adminId: adminUser.id,
        username: adminUser.username,
        providedToken: twoFactorToken
      });
      return res.status(400).json({ error: '認証コードが正しくありません' });
    }

    // バックアップコード生成
    const backupCodes = generateBackupCodes(10);

    // MFA有効化
    await prisma.adminUser.update({
      where: { id: adminUser.id },
      data: {
        twoFactorEnabled: true,
        backupCodes: backupCodes,
        updatedAt: new Date()
      }
    });

    console.log('✅ 管理者MFA設定完了:', {
      adminId: adminUser.id,
      username: adminUser.username,
      backupCodesGenerated: backupCodes.length
    });

    return res.status(200).json({
      message: 'MFA設定が完了しました',
      backupCodes: backupCodes,
      notice: [
        'バックアップコードを安全な場所に保存してください',
        '各コードは一度のみ使用可能です',
        '認証アプリが利用できない場合に使用できます'
      ]
    });

  } catch (error) {
    console.error('❌ 管理者MFA設定完了API エラー:', error);
    return res.status(500).json({ error: 'サーバーエラーが発生しました' });
  } finally {
    await prisma.$disconnect();
  }
}