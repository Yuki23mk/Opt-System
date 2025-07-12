/**
 * ファイルパス: OptiOil-API/pages/api/auth/login.ts
 * ログインAPI（MFA対応版）
 */

import { NextApiRequest, NextApiResponse } from "next";
import { compare } from "bcryptjs"; // ✅ 既存通りbcryptjsを使用
import { generateToken } from "../../../lib/auth/jwt";
import { prisma } from "../../../lib/prisma";

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
  // 🔧 CORS設定を直接適用
  setCorsHeaders(req, res);

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email, password } = req.body;

  // 入力値検証
  if (!email || !password) {
    return res.status(400).json({ error: "メールアドレスとパスワードを入力してください" });
  }

  try {
      // ✅ deletedから始まるメールアドレスは即座に拒否
  if (email.startsWith('deleted_')) {
    return res.status(401).json({ 
      error: "アカウントが存在しません",
      errorType: "account_not_found"
    });
  }
    // ✅ 通常のメールアドレスでユーザー検索
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

    // ✅ ユーザーが存在しない場合
    if (!user) {
      return res.status(401).json({ 
        error: "アカウントが存在しません",
        errorType: "account_not_found"
      });
    }

    // ✅ アカウント状態確認
    if (user.status === "deleted") {
      // 通常この状態には到達しないが、念のため
      return res.status(401).json({ 
        error: "アカウントが存在しません",
        errorType: "account_not_found"
      });
    }

    if (user.status === "pending") {
      return res.status(401).json({ error: "アカウントが承認待ちです。管理者にお問い合わせください。" });
    }

    if (user.status === "suspended") {
      return res.status(401).json({ error: "アカウントが停止されています。管理者にお問い合わせください。" });
    }

    // パスワード検証
    const isPasswordValid = await compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: "メールアドレスまたはパスワードが正しくありません" });
    }

    // ✅ MFA有効ユーザーの場合
    if (user.twoFactorEnabled) {
      // 一時トークンを生成（5分間有効）
      const tempToken = generateToken({
        id: user.id,
        systemRole: user.systemRole,
        companyId: user.companyId,
        requiresMFA: true // MFA検証が必要であることを示すフラグ
      }, "5m"); // 5分間のみ有効


      return res.status(200).json({
        requiresMFA: true,
        tempToken: tempToken,
        message: "MFA認証が必要です"
      });
    }

    // ✅ MFA無効ユーザーの場合（従来通り）
    const token = generateToken({
      id: user.id,
      systemRole: user.systemRole,
      companyId: user.companyId,
    });


    return res.status(200).json({
      token,
      user: {
        id: user.id,
        systemRole: user.systemRole,
        companyId: user.companyId,
        status: user.status
      }
    });

  } catch (error) {
    console.error("❌ ログインエラー:", getErrorMessage(error));
    return res.status(500).json({ 
      error: "サーバーエラーが発生しました",
      details: process.env.NODE_ENV === 'development' ? getErrorMessage(error) : undefined
    });
  }
}