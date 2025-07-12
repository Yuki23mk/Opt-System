import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../../../lib/prisma';
import { runMiddleware } from '../../../../../lib/cors'; // 統一されたCORS設定を使用
import { sendEmail } from '../../../../../utils/email'; // 🔧 修正: 既存のsendEmail関数を使用
import jwt from 'jsonwebtoken';

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
  // 修正: 統一されたCORS設定を適用
  try {
    await runMiddleware(req, res);
  } catch (error) {
    console.error('CORS error in approve API:', error);
    return res.status(403).json({ error: 'CORS error' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;
  const { generateTempPassword = false } = req.body; // ✅ 追加: 一時パスワード生成オプション
  const userId = parseInt(id as string);

  if (isNaN(userId)) {
    return res.status(400).json({ error: '無効なユーザーIDです' });
  }

  try {
    // JWT認証
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: '認証が必要です' });
    }

    // 環境変数の確認
    const jwtSecret = process.env.ADMIN_JWT_SECRET;
    if (!jwtSecret) {
      console.error('❌ ADMIN_JWT_SECRET が設定されていません');
      return res.status(500).json({ error: 'サーバー設定エラー' });
    }

    const decoded = jwt.verify(token, jwtSecret) as any;
    const adminId = decoded.id || decoded.adminId;
    if (!adminId) {
      return res.status(401).json({ error: '無効なトークンです' });
    }

    // ユーザー存在確認
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        companyRel: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'ユーザーが見つかりません' });
    }

    if (user.status !== 'pending') {
      return res.status(400).json({ error: '承認待ち状態のユーザーではありません' });
    }

    // 会社の製品設定確認
    const companyProducts = await prisma.companyProduct.count({
      where: { companyId: user.companyId },
    });

    if (companyProducts === 0) {
      return res.status(400).json({ 
        error: `承認前に「${user.companyRel.name}」の表示製品設定が必要です。会社管理から製品設定を行ってください。` 
      });
    }

    // ✅ 追加: 一時パスワード生成（必要な場合）
    let tempPassword = null;
    let hashedPassword = user.password; // デフォルトは既存パスワード

    if (generateTempPassword) {
      // 8文字の一時パスワードを生成
      tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-4).toUpperCase();
      
      const bcrypt = require('bcryptjs');
      hashedPassword = await bcrypt.hash(tempPassword, 10);
    }

    // ユーザー承認（ステータス更新 + パスワード更新）
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        status: 'active',
        ...(generateTempPassword && { password: hashedPassword }), // 一時パスワードが生成された場合のみ更新
      },
      include: {
        companyRel: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // 管理者操作ログ記録（エラーハンドリング追加）
    try {
      await prisma.adminOperationLog.create({
        data: {
          adminId: adminId,
          action: 'USER_APPROVED',
          targetType: 'User',
          targetId: userId,
          details: `ユーザー「${user.name}」(${user.email})を承認しました${generateTempPassword ? '（一時パスワード生成）' : ''}`,
        },
      });
    } catch (logError) {
      console.error('⚠️ 操作ログ記録エラー:', logError);
      // ログ記録エラーは承認処理の成功に影響しない
    }

    // 🔧 修正: アカウント承認完了メール送信（sendEmail関数を使用）
    try {
      const subject = 'アカウントが承認されました';
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #115e59;">アカウント承認完了のお知らせ</h2>
          
          <p>${user.name} 様</p>
          
          <p>Opt.システムへのアカウント申請が承認されました。</p>
          
          ${tempPassword ? `
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 4px; margin: 20px 0;">
              <p><strong>一時パスワード：</strong></p>
              <p><code style="background-color: #e9ecef; padding: 4px 8px; font-size: 16px;">${tempPassword}</code></p>
            </div>
            
            <p style="color: #d97706; font-weight: bold;">
              セキュリティのため、初回ログイン後に必ずパスワードを変更してください。
            </p>
          ` : `
            <p>登録時に設定されたパスワードでログインしてください。</p>
          `}
          
          <div style="margin: 30px 0; text-align: center;">
            <a href="${process.env.NEXT_PUBLIC_FRONTEND_URL}/login" 
               style="background-color: #115e59; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 4px; display: inline-block;">
              ログイン画面へ
            </a>
          </div>
          
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          
          <p style="font-size: 12px; color: #999;">
            ${process.env.COMPANY_NAME || '有限会社丸一機料商会'} Opt.システム<br>
            承認日時: ${new Date().toLocaleString('ja-JP')}
          </p>
        </div>
      `;

      await sendEmail(user.email, subject, html);
      console.log(`✅ [API] アカウント承認完了メール送信成功: ${user.email}`);
    } catch (emailError) {
      console.warn(`⚠️ [API] アカウント承認完了メール送信失敗: ${getErrorMessage(emailError)}`);
      // メール送信失敗してもアカウント承認は成功扱い
    }

    console.log('✅ ユーザー承認成功:', {
      userId: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      status: updatedUser.status,
      tempPasswordGenerated: !!tempPassword,
    });

    return res.status(200).json({ 
      message: 'ユーザーを承認しました',
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        status: updatedUser.status,
        companyRel: updatedUser.companyRel,
      },
      tempPasswordGenerated: !!tempPassword, // ✅ 追加: 一時パスワード生成フラグ
    });

  } catch (error) {
    console.error('❌ ユーザー承認エラー:', getErrorMessage(error));
    
    return res.status(500).json({ 
      error: 'サーバーエラーが発生しました',
      details: process.env.NODE_ENV === 'development' ? getErrorMessage(error) : undefined
    });
  }
}