/**
 * ファイルパス: OptiOil-API/pages/api/auth/password-reset-request.ts
 * ログイン時のパスワードリセット申請API（utils/email対応版）
 */

import { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../lib/prisma";
import { sendPasswordResetEmail } from "../../../utils/email"; // ✅ 変更: sendMail → utils/email
import crypto from "crypto";

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

// CORS設定を環境変数ベースに変更
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

// CORS設定関数を直接定義
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

  const { email } = req.body;

  // 入力値検証
  if (!email) {
    return res.status(400).json({ error: "メールアドレスを入力してください" });
  }

  // メールアドレス形式チェック
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: "正しいメールアドレスを入力してください" });
  }

  try {
    // deletedから始まるメールアドレスは即座に拒否
    if (email.startsWith('deleted_')) {
      // セキュリティ上、存在しないメールでも成功レスポンスを返す
      return res.status(200).json({ 
        success: true, 
        message: "パスワードリセットのご案内をメールで送信いたしました。" 
      });
    }

    // ユーザー検索
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        companyRel: {
          select: { name: true }
        }
      }
    });

    // ユーザーが存在しない場合でも成功レスポンス（セキュリティ対策）
    if (!user) {
      console.log(`🔍 [API] パスワードリセット申請: 存在しないメール ${email}`);
      return res.status(200).json({ 
        success: true, 
        message: "パスワードリセットのご案内をメールで送信いたしました。" 
      });
    }

    // アカウント状態確認
    if (user.status === "deleted") {
      console.log(`🔍 [API] パスワードリセット申請: 削除済みアカウント ${email}`);
      // 削除済みでも成功レスポンス（セキュリティ対策）
      return res.status(200).json({ 
        success: true, 
        message: "パスワードリセットのご案内をメールで送信いたしました。" 
      });
    }

    if (user.status === "pending") {
      return res.status(400).json({ 
        error: "アカウントが承認待ちです。管理者にお問い合わせください。" 
      });
    }

    if (user.status === "suspended") {
      return res.status(400).json({ 
        error: "アカウントが停止されています。管理者にお問い合わせください。" 
      });
    }

    // リセットトークン生成（32バイトのランダム文字列）
    const resetToken = crypto.randomBytes(32).toString('hex');
    
    // 有効期限設定（30分後）
    const resetTokenExpiry = new Date();
    resetTokenExpiry.setMinutes(resetTokenExpiry.getMinutes() + 30);

    // データベース更新
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken: resetToken,
        resetTokenExpiry: resetTokenExpiry
      }
    });

    // ✅ メール送信（utils/emailを使用）
    try {
      await sendPasswordResetEmail(email, resetToken, false);

      console.log(`✅ [API] パスワードリセットメール送信成功: ${email}`);
      
    } catch (mailError) {
      console.error("❌ メール送信エラー:", getErrorMessage(mailError));
      
      // メール送信失敗時はトークンをクリア
      await prisma.user.update({
        where: { id: user.id },
        data: {
          resetToken: null,
          resetTokenExpiry: null
        }
      });
      
      return res.status(500).json({ 
        error: "メール送信に失敗しました。しばらく後に再度お試しください。" 
      });
    }

    return res.status(200).json({
      success: true,
      message: "パスワードリセットのご案内をメールで送信いたしました。"
    });

  } catch (error) {
    console.error("❌ パスワードリセット申請エラー:", getErrorMessage(error));
    return res.status(500).json({ 
      error: "サーバーエラーが発生しました",
      details: process.env.NODE_ENV === 'development' ? getErrorMessage(error) : undefined
    });
  }
}