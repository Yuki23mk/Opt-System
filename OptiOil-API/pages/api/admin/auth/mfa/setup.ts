/**
 * ファイルパス: OptiOil-API/pages/api/admin/auth/mfa/setup.ts
 * 管理者MFA設定開始API（QRコード生成）- シークレット非返却版
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
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

    // 管理者存在確認
    const adminUser = await prisma.adminUser.findUnique({
      where: { id: adminData.id }
    });

    if (!adminUser || adminUser.status !== 'active') {
      return res.status(401).json({ error: '管理者が見つからないか無効です' });
    }

    // 既にMFAが有効の場合
    if (adminUser.twoFactorEnabled) {
      return res.status(400).json({ error: 'MFAは既に有効になっています' });
    }

    // MFAシークレット生成
    const secret = authenticator.generateSecret();
    
    // サービス名とアカウント情報を設定
    const serviceName = process.env.NEXT_PUBLIC_APP_NAME || 'OptiOil Admin';
    const accountName = adminUser.username;
    
    // OTPAuth URL生成
    const otpAuthUrl = authenticator.keyuri(accountName, serviceName, secret);
    
    // QRコード生成
    const qrCodeDataUrl = await QRCode.toDataURL(otpAuthUrl);

    // 🔐 シークレットをDBに保存（検証時に使用）
    await prisma.adminUser.update({
      where: { id: adminUser.id },
      data: { 
        twoFactorSecret: secret,
        twoFactorEnabled: false // まだ有効化はしない
      }
    });

    console.log('✅ 管理者MFA設定開始:', {
      adminId: adminUser.id,
      username: adminUser.username,
      note: 'シークレットキーは非返却、DBに保存済み'
    });

    // 🔐 シークレットキーは一切返さない
    return res.status(200).json({
      message: 'MFA設定を開始しました',
      qrCode: qrCodeDataUrl,
      setupInstructions: [
        'Google Authenticator、Authy、1Passwordなどの認証アプリをインストール',
        'アプリでQRコードをスキャンしてください',
        'アプリに表示される6桁のコードで設定を完了してください'
      ]
      // シークレットキーは一切含めない
    });

  } catch (error) {
    console.error('❌ 管理者MFA設定開始API エラー:', error);
    return res.status(500).json({ error: 'サーバーエラーが発生しました' });
  } finally {
    await prisma.$disconnect();
  }
}