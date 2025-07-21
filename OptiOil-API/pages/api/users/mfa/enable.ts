/**
 * ファイルパス: OptiOil-API/pages/api/users/mfa/enable.ts
 * MFA有効化API - DB保存シークレットを利用
 */

import { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../../lib/prisma";
import { verifyToken } from "../../../../lib/auth/jwt";
import { runMiddleware } from "../../../../lib/cors";
import { authenticator } from 'otplib';

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

    const { verificationCode } = req.body; // secretは受け取らない

    // 必須パラメータチェック
    if (!verificationCode) {
      return res.status(400).json({ message: "認証コードが必要です" });
    }

    // 認証コードの形式チェック
    if (!/^\d{6}$/.test(verificationCode)) {
      return res.status(400).json({ message: "認証コードは6桁の数字である必要があります" });
    }

    // ユーザー情報を取得（一時保存されたシークレットも含む）
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        twoFactorEnabled: true,
        twoFactorSecret: true // 🔐 setupAPIで一時保存されたシークレット
      }
    });

    if (!user) {
      return res.status(404).json({ message: "ユーザーが見つかりません" });
    }

    // 既に2FAが有効な場合はエラー
    if (user.twoFactorEnabled) {
      return res.status(400).json({ message: "2FA認証は既に有効です" });
    }

    // 🔐 セットアップ未完了の場合
    if (!user.twoFactorSecret) {
      return res.status(400).json({ message: "MFAセットアップが完了していません。最初にQRコードの設定を行ってください。" });
    }

    // 🔐 DB保存されたシークレットで認証コード検証
    const verified = authenticator.verify({
      token: verificationCode,
      secret: user.twoFactorSecret
    });

    if (!verified) {
      console.log('❌ [API] MFA有効化 - 認証コード検証失敗:', {
        userId: user.id,
        email: user.email
      });
      return res.status(400).json({ message: "認証コードが正しくありません" });
    }

    // バックアップコードを生成
    const backupCodes = Array.from({ length: 8 }, () => 
      Math.random().toString(36).substr(2, 8).toUpperCase()
    );

    // MFAを有効化
    await prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorEnabled: true,
        // twoFactorSecret は既に保存済みなので更新不要
        backupCodes: JSON.stringify(backupCodes)
      }
    });

    console.log('✅ [API] MFA有効化成功:', {
      userId: user.id,
      email: user.email,
      backupCodesCount: backupCodes.length,
      method: 'DB保存シークレット利用'
    });

    return res.status(200).json({
      message: "MFA認証が有効になりました",
      backupCodes: backupCodes
    });

  } catch (error) {
    console.error("❌ MFA有効化エラー:", error);
    return res.status(500).json({ message: "MFA有効化に失敗しました" });
  }
}