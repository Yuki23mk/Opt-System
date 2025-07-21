/**
 * ファイルパス: OptiOil-API/pages/api/admin/auth/password-reset-execute.ts
 * 管理者用パスワードリセット実行API（トークンによる実際のパスワード変更）
 */

import { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcryptjs';
import { prisma } from '../../../../lib/prisma';
import { runMiddleware } from '../../../../lib/cors';
import { validateAdminResetToken, consumeAdminResetToken } from './password-reset-request';

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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await runMiddleware(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'PUTメソッドのみ許可されています' });
  }

  const { token, newPassword } = req.body;

  // 入力値検証
  if (!token || !newPassword) {
    return res.status(400).json({ error: 'トークンと新しいパスワードが必要です' });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'パスワードは8文字以上で入力してください' });
  }

  try {
    // トークンが有効かチェック
    const tokenData = validateAdminResetToken(token);
    
    if (!tokenData) {
      return res.status(400).json({ error: '無効または期限切れのトークンです' });
    }

    // 管理者ユーザーを取得
    const adminUser = await prisma.adminUser.findUnique({
      where: { id: tokenData.adminId },
      select: {
        id: true,
        username: true,
        email: true,
        status: true,
      }
    });

    if (!adminUser) {
      // トークンが有効でもユーザーが存在しない場合
      consumeAdminResetToken(token); // トークンを無効化
      return res.status(400).json({ error: '無効なリクエストです' });
    }

    if (adminUser.status !== 'active') {
      // アカウントが非アクティブの場合
      consumeAdminResetToken(token); // トークンを無効化
      return res.status(400).json({ error: 'アカウントが利用できません' });
    }

    // 新しいパスワードをハッシュ化
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // パスワードを更新
    const updatedAdmin = await prisma.adminUser.update({
      where: { id: adminUser.id },
      data: {
        passwordHash: hashedPassword,
        lastLogin: new Date(), // 最終ログイン時刻を更新
      },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
      }
    });

    // 使用済みトークンを削除
    consumeAdminResetToken(token);

    // 操作ログ記録（自分でパスワードリセットした場合）
    try {
      await prisma.adminOperationLog.create({
        data: {
          adminId: updatedAdmin.id,
          action: 'PASSWORD_RESET_SELF',
          targetType: 'AdminUser',
          targetId: updatedAdmin.id,
          details: `管理者「${updatedAdmin.username}」がパスワードリセットを実行しました`,
        },
      });
    } catch (logError) {
      console.warn('⚠️ 操作ログ記録エラー:', logError);
      // ログ記録エラーはパスワード変更の成功に影響しない
    }

    console.log(`✅ [API] 管理者パスワード変更成功: ${updatedAdmin.username} (${updatedAdmin.email})`);

    res.status(200).json({ 
      success: true, 
      message: '管理者パスワードが正常に変更されました',
      admin: {
        username: updatedAdmin.username,
        email: updatedAdmin.email,
        role: updatedAdmin.role,
      }
    });

  } catch (error) {
    console.error('❌ 管理者パスワード変更エラー:', getErrorMessage(error));
    res.status(500).json({ 
      error: '管理者パスワードの変更に失敗しました',
      details: process.env.NODE_ENV === 'development' ? getErrorMessage(error) : undefined
    });
  }
}