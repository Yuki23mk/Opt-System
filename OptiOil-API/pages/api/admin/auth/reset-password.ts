/**
 * ファイルパス: OptiOil-API/pages/api/admin/auth/reset-password.ts
 * 管理者パスワードリセットAPI（ログイン後の他管理者向け + メール送信対応版）
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { runMiddleware } from '../../../../lib/cors';
import { sendEmail } from '../../../../utils/email'; // ✅ 追加: メール送信機能

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

const prisma = new PrismaClient();

// 簡易的な管理者認証チェック関数
async function requireAdminAuth(req: NextApiRequest): Promise<{ success: boolean; adminUser?: any; error?: string }> {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return { success: false, error: '認証が必要です' };
    }

    const jwt = require('jsonwebtoken');
    const jwtSecret = process.env.ADMIN_JWT_SECRET;
    if (!jwtSecret) {
      return { success: false, error: 'サーバー設定エラー' };
    }

    const decoded = jwt.verify(token, jwtSecret) as any;
    const adminId = decoded.id || decoded.adminId;
    
    if (!adminId) {
      return { success: false, error: '無効なトークンです' };
    }

    const adminUser = await prisma.adminUser.findUnique({
      where: { id: adminId },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        status: true,
      }
    });

    if (!adminUser || adminUser.status !== 'active') {
      return { success: false, error: '認証に失敗しました' };
    }

    return { success: true, adminUser };
  } catch (error) {
    return { success: false, error: '認証エラー' };
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // CORS設定
    await runMiddleware(req, res);

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'POSTメソッドのみ許可されています' });
    }

    // セキュリティチェック: 管理者認証が必要
    const authResult = await requireAdminAuth(req);
    if (!authResult.success) {
      return res.status(401).json({ 
        error: authResult.error || 'パスワードリセットには管理者認証が必要です' 
      });
    }

    const { 
      username, 
      newPassword, 
      generateTempPassword = false, // ✅ 追加: 一時パスワード自動生成オプション
      sendNotificationEmail = true  // ✅ 追加: メール送信フラグ
    } = req.body;

    // バリデーション
    if (!username) {
      return res.status(400).json({ error: 'ユーザー名が必要です' });
    }

    if (!generateTempPassword && !newPassword) {
      return res.status(400).json({ error: '新しいパスワードまたは一時パスワード生成が必要です' });
    }

    if (newPassword && newPassword.length < 8) {
      return res.status(400).json({ error: 'パスワードは8文字以上である必要があります' });
    }

    // 対象管理者ユーザー存在チェック
    const targetAdmin = await prisma.adminUser.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        status: true,
      }
    });

    if (!targetAdmin) {
      return res.status(404).json({ error: '指定されたユーザー名の管理者が見つかりません' });
    }

    if (targetAdmin.status !== 'active') {
      return res.status(400).json({ error: '対象の管理者アカウントが利用できません' });
    }

    // ✅ 追加: パスワード決定（一時パスワード生成 or 指定されたパスワード）
    let finalPassword = newPassword;
    let tempPassword = null;

    if (generateTempPassword) {
      // 8文字の一時パスワードを生成
      tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-4).toUpperCase();
      finalPassword = tempPassword;
    }

    // パスワードハッシュ化
    const hashedPassword = await bcrypt.hash(finalPassword, 10);

    // パスワード更新
    const updatedAdmin = await prisma.adminUser.update({
      where: { username },
      data: { 
        passwordHash: hashedPassword,
        lastLogin: new Date() // 最終ログイン時刻を更新
      },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
      }
    });

    // ✅ 追加: パスワードリセット通知メール送信
    if (sendNotificationEmail) {
      try {
        const subject = '管理者パスワードがリセットされました';
        const html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #115e59;">管理者パスワードリセット通知</h2>
            
            <p>${targetAdmin.username} 様</p>
            
            <p>管理者「${authResult.adminUser.username}」により、あなたのパスワードがリセットされました。</p>
            
            ${tempPassword ? `
              <div style="background-color: #f8f9fa; padding: 20px; border-radius: 4px; margin: 20px 0;">
                <p><strong>新しい一時パスワード：</strong></p>
                <p><code style="background-color: #e9ecef; padding: 4px 8px; font-size: 16px;">${tempPassword}</code></p>
              </div>
              
              <p style="color: #d97706; font-weight: bold;">
                セキュリティのため、ログイン後に必ずパスワードを変更してください。
              </p>
            ` : `
              <p>新しいパスワードは管理者から直接お受け取りください。</p>
            `}
            
            <div style="margin: 30px 0; text-align: center;">
              <a href="${process.env.NEXT_PUBLIC_ADMIN_URL}/login" 
                 style="background-color: #115e59; color: white; padding: 12px 24px; 
                        text-decoration: none; border-radius: 4px; display: inline-block;">
                管理画面ログイン
              </a>
            </div>
            
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
            
            <p style="font-size: 12px; color: #999;">
              ${process.env.COMPANY_NAME || '有限会社丸一機料商会'} 管理システム<br>
              リセット実行者: ${authResult.adminUser.username}<br>
              実行日時: ${new Date().toLocaleString('ja-JP')}
            </p>
          </div>
        `;

        // 🔧 修正: sendEmail関数の引数を3つの個別引数に変更
        await sendEmail(targetAdmin.email, subject, html);

        console.log(`✅ [API] 管理者パスワードリセット通知メール送信成功: ${targetAdmin.email}`);
      } catch (emailError) {
        console.warn(`⚠️ [API] 管理者パスワードリセット通知メール送信失敗: ${getErrorMessage(emailError)}`);
        // メール送信失敗してもパスワードリセットは成功扱い
      }
    }

    // 操作ログ記録
    try {
      await prisma.adminOperationLog.create({
        data: {
          adminId: authResult.adminUser.id,
          action: 'PASSWORD_RESET_OTHER',
          targetType: 'AdminUser',
          targetId: updatedAdmin.id,
          details: `管理者「${authResult.adminUser.username}」が管理者「${updatedAdmin.username}」のパスワードをリセットしました${tempPassword ? '（一時パスワード生成）' : ''}`,
        },
      });
    } catch (logError) {
      console.warn('⚠️ 操作ログ記録エラー:', logError);
    }

    console.log('✅ 管理者パスワードをリセット:', {
      resetBy: authResult.adminUser.username,
      targetUser: updatedAdmin.username,
      targetEmail: updatedAdmin.email,
      tempPasswordGenerated: !!tempPassword,
      emailSent: sendNotificationEmail,
    });

    return res.status(200).json({
      message: 'パスワードをリセットしました',
      admin: {
        username: updatedAdmin.username,
        email: updatedAdmin.email,
        role: updatedAdmin.role
      },
      resetBy: authResult.adminUser.username,
      tempPasswordGenerated: !!tempPassword, // ✅ 追加: 一時パスワード生成フラグ
      emailSent: sendNotificationEmail,       // ✅ 追加: メール送信フラグ
    });

  } catch (error) {
    console.error('❌ 管理者パスワードリセットAPI エラー:', getErrorMessage(error));
    return res.status(500).json({ 
      error: 'サーバーエラーが発生しました',
      details: process.env.NODE_ENV === 'development' ? getErrorMessage(error) : undefined
    });
  } finally {
    await prisma.$disconnect();
  }
}