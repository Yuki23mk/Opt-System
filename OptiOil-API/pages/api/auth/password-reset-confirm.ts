/**
 * ファイルパス: OptiOil-API/pages/api/auth/password-reset-confirm.ts
 * ログイン時パスワードリセット確認・更新API
 */

import { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../lib/prisma";
import { runMiddleware } from "../../../lib/cors";
import { hashPassword, validatePasswordStrength } from "../../../utils/password";

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
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { token, password, confirmPassword } = req.body;

  // 入力値検証
  if (!token) {
    return res.status(400).json({ error: "無効なリクエストです" });
  }

  if (!password || !confirmPassword) {
    return res.status(400).json({ error: "パスワードと確認パスワードを入力してください" });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ error: "パスワードが一致しません" });
  }

  // パスワード強度チェック
  const passwordValidation = validatePasswordStrength(password);
  if (!passwordValidation.isValid) {
    return res.status(400).json({ 
      error: "パスワードが要件を満たしていません",
      details: passwordValidation.errors 
    });
  }
  // 英数字・大文字を含むかチェック
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  
  if (!hasUpperCase || !hasLowerCase || !hasNumbers) {
    return res.status(400).json({ 
      error: "パスワードは大文字・小文字・数字を含む必要があります" 
    });
  }

  try {
    // ✅ トークンでユーザー検索
    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: {
          gt: new Date() // 有効期限内のみ
        }
      },
      select: {
        id: true,
        email: true,
        name: true,
        status: true
      }
    });

    if (!user) {
      return res.status(400).json({ 
        error: "無効または期限切れのリンクです。再度パスワードリセットを申請してください。" 
      });
    }

    // アカウント状態確認
    if (user.status === "deleted") {
      return res.status(400).json({ 
        error: "このアカウントは削除されています" 
      });
    }

    if (user.status === "suspended") {
      return res.status(400).json({ 
        error: "このアカウントは停止されています。管理者にお問い合わせください。" 
      });
    }

    // ✅ パスワードハッシュ化
    const hashedPassword = await hashPassword(password);

    // ✅ パスワード更新・トークンクリア
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null
      }
    });

    console.log(`✅ [API] パスワードリセット完了: ${user.email}`);

    return res.status(200).json({
      success: true,
      message: "パスワードが正常に更新されました。新しいパスワードでログインしてください。"
    });

  } catch (error) {
    console.error("❌ パスワードリセット確認エラー:", error);
    return res.status(500).json({ error: "サーバーエラーが発生しました" });
  }
}