/**
 * ファイルパス: OptiOil-API/pages/api/auth/login.ts
 * ログインAPI（本番環境用）
 */

import { NextApiRequest, NextApiResponse } from "next";
import { generateToken } from "../../../lib/auth/jwt";
import { prisma } from "../../../lib/prisma";
import { verifyPassword } from "../../../utils/password";

// 型安全エラーハンドリング関数
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown error occurred';
}

// 環境変数ベースのCORS設定
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

// CORS設定関数
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

// 本番環境用ログ関数（シンプル版）
const logSecurity = (level: 'info' | 'warn' | 'error', message: string, metadata?: any) => {
  const timestamp = new Date().toISOString();
  const logData = {
    timestamp,
    level,
    message,
    ...(metadata && { metadata })
  };
  
  // 本番環境では重要なイベントのみログ出力
  if (process.env.OPT_ENVIRONMENT === 'production') {
    if (level === 'error' || level === 'warn') {
      console.log(JSON.stringify(logData));
    }
  } else {
    // 開発環境では詳細ログ
    console.log(JSON.stringify(logData));
  }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setCorsHeaders(req, res);

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }
  
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { email, password } = req.body;

  // 入力値検証
  if (!email || !password) {
    logSecurity('warn', 'Login attempt with missing credentials', { 
      email: email ? 'provided' : 'missing',
      password: password ? 'provided' : 'missing'
    });
    res.status(400).json({ error: "メールアドレスとパスワードを入力してください" });
    return;
  }

  try {
    // deletedから始まるメールアドレスは即座に拒否
    if (email.startsWith('deleted_')) {
      logSecurity('warn', 'Login attempt with deleted email', { 
        emailPrefix: 'deleted_*'
      });
      res.status(401).json({ 
        error: "アカウントが存在しません",
        errorType: "account_not_found"
      });
      return;
    }

    // ユーザー検索
    let user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        password: true,
        name: true,
        systemRole: true,
        companyId: true,
        status: true,
        twoFactorEnabled: true,
        companyRel: {
          select: { name: true }
        }
      }
    });

    if (!user) {
      logSecurity('warn', 'Login attempt with non-existent email', { 
        emailDomain: email.split('@')[1] // ドメインのみログ
      });
      res.status(401).json({ 
        error: "アカウントが存在しません",
        errorType: "account_not_found"
      });
      return;
    }

    // アカウント状態確認
    if (user.status === "deleted") {
      logSecurity('warn', 'Login attempt with deleted account', { 
        userId: user.id
      });
      res.status(401).json({ 
        error: "アカウントが存在しません",
        errorType: "account_not_found"
      });
      return;
    }

    if (user.status === "pending") {
      logSecurity('info', 'Login attempt with pending account', { 
        userId: user.id
      });
      res.status(401).json({ 
        error: "アカウントが承認待ちです。管理者にお問い合わせください。" 
      });
      return;
    }

    if (user.status === "suspended") {
      logSecurity('warn', 'Login attempt with suspended account', { 
        userId: user.id
      });
      res.status(401).json({ 
        error: "アカウントが停止されています。管理者にお問い合わせください。" 
      });
      return;
    }

    // パスワード検証
    let isPasswordValid = false;
    try {
      isPasswordValid = await verifyPassword(password, user.password);
    } catch (passwordError) {
      logSecurity('error', 'Password verification error', { 
        userId: user.id,
        error: getErrorMessage(passwordError)
      });
    }

    if (!isPasswordValid) {
      logSecurity('warn', 'Failed login attempt - invalid password', { 
        userId: user.id,
        emailDomain: email.split('@')[1] // ドメインのみ
      });
      res.status(401).json({ 
        error: "メールアドレスまたはパスワードが正しくありません" 
      });
      return;
    }

    // MFA有効ユーザーの場合
    if (user.twoFactorEnabled) {
      logSecurity('info', 'MFA required for user', { 
        userId: user.id
      });
      
      const tempToken = generateToken({
        id: user.id,
        systemRole: user.systemRole,
        companyId: user.companyId,
        requiresMFA: true
      }, "5m");

      res.status(200).json({
        requiresMFA: true,
        tempToken: tempToken,
        message: "MFA認証が必要です"
      });
      return;
    }

    // 成功時のログ（最小限）
    logSecurity('info', 'Successful login', { 
      userId: user.id,
      systemRole: user.systemRole,
      companyId: user.companyId
    });

    // MFA無効ユーザーの場合（従来通り）
    const token = generateToken({
      id: user.id,
      systemRole: user.systemRole,
      companyId: user.companyId,
    });

    res.status(200).json({
      token,
      user: {
        id: user.id,
        systemRole: user.systemRole,
        companyId: user.companyId,
        status: user.status
      }
    });
    return;

  } catch (error) {
    logSecurity('error', 'Unexpected login error', { 
      error: getErrorMessage(error),
      emailDomain: email ? email.split('@')[1] : 'unknown' // ドメインのみ
    });
    
    res.status(500).json({ 
      error: "サーバーエラーが発生しました",
      details: process.env.NODE_ENV === 'development' ? getErrorMessage(error) : undefined
    });
    return;
  }
}