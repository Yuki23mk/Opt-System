/**
 * ファイルパス: OptiOil-API/pages/api/users/mfa/setup.ts
 * MFA設定生成API（QRコード生成）- シークレットキー非返却版
 */

import { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../../lib/prisma";
import { verifyToken } from "../../../../lib/auth/jwt";
import { authenticator } from 'otplib';
import QRCode from 'qrcode';

// 🆕 型安全エラーハンドリング関数を追加
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown error occurred';
}

// 🔧 CORS設定を環境変数ベースに変更
const getAllowedOrigins = (): string[] => {
  const origins = [];
  if (process.env.NEXT_PUBLIC_FRONTEND_URL) {
    origins.push(process.env.NEXT_PUBLIC_FRONTEND_URL);
  }
  if (process.env.NEXT_PUBLIC_ADMIN_URL) {
    origins.push(process.env.NEXT_PUBLIC_ADMIN_URL);
  }
  if (process.env.NEXT_PUBLIC_API_URL) {
    origins.push(process.env.NEXT_PUBLIC_API_URL);
  }
  return origins;
};

// 🔧 CORS設定関数を直接定義
const setCorsHeaders = (req: NextApiRequest, res: NextApiResponse) => {
  const allowedOrigins = getAllowedOrigins();
  const origin = req.headers.origin;
  
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    const corsOrigin = allowedOrigins.length > 0 ? allowedOrigins.join(',') : '*';
    res.setHeader('Access-Control-Allow-Origin', corsOrigin);
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setCorsHeaders(req, res);

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  try {
    // トークン検証
    const bearerToken = req.headers.authorization?.split(" ")[1];
    const cookieToken = req.cookies.token;
    const token = bearerToken || cookieToken;

    if (!token) {
      return res.status(401).json({ message: "トークンがありません" });
    }

    const decoded = verifyToken(token);
    if (!decoded || typeof decoded === "string") {
      return res.status(403).json({ message: "無効なトークンです" });
    }

    // ユーザー情報を取得
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        name: true,
        twoFactorEnabled: true
      }
    });

    if (!user) {
      return res.status(404).json({ message: "ユーザーが見つかりません" });
    }

    // 既にMFAが有効な場合はエラー
    if (user.twoFactorEnabled) {
      return res.status(400).json({ message: "MFA認証は既に有効です" });
    }

    // シークレット生成
    const secret = authenticator.generateSecret();
    
    // サービス名とアカウント設定
    const serviceName = process.env.NEXT_PUBLIC_APP_NAME || 'Opt';
    const accountName = user.email;
    
    // OTPAuth URL生成
    const otpAuthUrl = authenticator.keyuri(accountName, serviceName, secret);
    
    // QRコード生成
    const qrCodeDataUrl = await QRCode.toDataURL(otpAuthUrl);

    // バックアップコードを生成
    const tempBackupCodes = Array.from({ length: 8 }, () => 
      Math.random().toString(36).substr(2, 8).toUpperCase()
    );

    // 🔐 シークレットをDBに一時保存（enableAPIで使用）
    await prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorSecret: secret,
        twoFactorEnabled: false // まだ有効化はしない
      }
    });

    console.log('📱 [API] ユーザーMFA設定生成:', {
      userId: user.id,
      email: user.email,
      serviceName,
      accountName,
      qrCodeLength: qrCodeDataUrl.length,
      note: 'シークレットキーは非返却、DB保存済み'
    });

    // 🔐 シークレットキーは一切返さない
    return res.status(200).json({
      qrCode: qrCodeDataUrl,
      backupCodes: tempBackupCodes,
      // シークレットキーに関する情報は一切含めない
      setupInstructions: [
        'Google Authenticator等のアプリでQRコードをスキャンしてください',
        'アプリに表示される6桁のコードで設定を完了してください'
      ]
    });

  } catch (error) {
    console.error("❌ MFA設定生成エラー:", error);
    return res.status(500).json({ message: "MFA設定の生成に失敗しました" });
  }
}