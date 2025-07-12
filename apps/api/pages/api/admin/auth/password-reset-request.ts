/**
 * ファイルパス: OptiOil-API/pages/api/admin/auth/password-reset-request.ts
 * 管理者用パスワードリセット申請API（ログイン前用）
 */

import { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import { prisma } from '../../../../lib/prisma';
import { runMiddleware } from '../../../../lib/cors';
import { sendPasswordResetEmail } from '../../../../utils/email';

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

// 管理者用の一時的なトークンストレージ（本来はRedisやDBに保存すべき）
const adminResetTokens = new Map<string, { adminId: number; expiry: Date; email: string }>();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await runMiddleware(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POSTメソッドのみ許可されています' });
  }

  const { email } = req.body;

  // 入力値検証
  if (!email) {
    return res.status(400).json({ error: 'メールアドレスを入力してください' });
  }

  // メールアドレス形式チェック
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: '正しいメールアドレスを入力してください' });
  }

  try {
    // 管理者ユーザーを検索
    const adminUser = await prisma.adminUser.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        email: true,
        username: true,
        status: true,
      }
    });

    // ユーザーが存在しない場合でも成功レスポンス（セキュリティ対策）
    if (!adminUser) {
      console.log(`🔍 [API] 管理者パスワードリセット申請: 存在しないメール ${email}`);
      return res.status(200).json({ 
        success: true, 
        message: '管理者パスワードリセットのご案内をメールで送信いたしました。' 
      });
    }

    // アカウント状態確認
    if (adminUser.status !== 'active') {
      console.log(`🔍 [API] 管理者パスワードリセット申請: 非アクティブアカウント ${email}`);
      // 非アクティブでも成功レスポンス（セキュリティ対策）
      return res.status(200).json({ 
        success: true, 
        message: '管理者パスワードリセットのご案内をメールで送信いたしました。' 
      });
    }

    // リセットトークンを生成（32バイトのランダム文字列）
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1時間後

    // トークンを一時的に保存（本来はDBまたはRedisに保存）
    adminResetTokens.set(resetToken, {
      adminId: adminUser.id,
      expiry: resetTokenExpiry,
      email: adminUser.email
    });

    // 期限切れトークンのクリーンアップ
    for (const [token, data] of adminResetTokens.entries()) {
      if (data.expiry < new Date()) {
        adminResetTokens.delete(token);
      }
    }

    console.log(`🔑 [API] 管理者リセットトークン生成: ${adminUser.username} (${email})`);

    // メール送信
    try {
      await sendPasswordResetEmail(email, resetToken, true); // 管理者用フラグ=true
      
      console.log(`✅ [API] 管理者パスワードリセットメール送信成功: ${email}`);
      
      return res.status(200).json({ 
        success: true, 
        message: '管理者パスワードリセットのご案内をメールで送信いたしました。' 
      });
    } catch (emailError) {
      console.error('❌ 管理者パスワードリセットメール送信エラー:', getErrorMessage(emailError));
      
      // メール送信失敗時はトークンをクリア
      adminResetTokens.delete(resetToken);
      
      return res.status(500).json({ 
        error: 'メール送信に失敗しました。しばらく後に再度お試しください。',
        debug: process.env.EMAIL_DEBUG === 'true' ? {
          error: getErrorMessage(emailError), // 🔧 修正: emailError.message → getErrorMessage(emailError)
          token: resetToken // デバッグモードでのみ表示
        } : undefined
      });
    }

  } catch (error) {
    console.error('❌ 管理者パスワードリセット申請エラー:', getErrorMessage(error));
    return res.status(500).json({ 
      error: 'サーバーエラーが発生しました',
      details: process.env.NODE_ENV === 'development' ? getErrorMessage(error) : undefined
    });
  }
}

// トークン検証用のエクスポート関数（password-reset-execute.tsで使用）
export function validateAdminResetToken(token: string) {
  const tokenData = adminResetTokens.get(token);
  
  if (!tokenData || tokenData.expiry < new Date()) {
    if (tokenData) {
      adminResetTokens.delete(token); // 期限切れトークンを削除
    }
    return null;
  }
  
  return tokenData;
}

// トークン消費用のエクスポート関数（password-reset-execute.tsで使用）
export function consumeAdminResetToken(token: string) {
  const tokenData = adminResetTokens.get(token);
  if (tokenData) {
    adminResetTokens.delete(token);
  }
  return tokenData;
}