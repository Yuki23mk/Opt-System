/**
 * ファイルパス: OptiOil-API/pages/api/users/mfa/disable.ts
 * MFA無効化API
 */

import { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../../lib/prisma";
import { verifyToken } from "../../../../lib/auth/jwt";

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
        twoFactorEnabled: true
      }
    });

    if (!user) {
      return res.status(404).json({ message: "ユーザーが見つかりません" });
    }

    // MFAが有効でない場合はエラー
    if (!user.twoFactorEnabled) {
      return res.status(400).json({ message: "MFA認証は既に無効です" });
    }

    // MFAを無効化（関連データもクリア）
    await prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        backupCodes: null as any
      }
    });

    console.log('✅ [API] MFA無効化成功:', {
      userId: user.id,
      email: user.email
    });

    return res.status(200).json({
      message: "MFA認証を無効にしました"
    });

  } catch (error) {
    console.error("❌ MFA無効化エラー:", getErrorMessage(error));
    return res.status(500).json({ 
      message: "MFA無効化に失敗しました",
      details: process.env.NODE_ENV === 'development' ? getErrorMessage(error) : undefined
    });
  }
}