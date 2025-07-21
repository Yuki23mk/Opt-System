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

// 環境変数の型安全な取得
const getRequiredEnvVar = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name}環境変数が設定されていません`);
  }
  return value;
};

// 環境変数の取得
const ADMIN_JWT_SECRET = getRequiredEnvVar('ADMIN_JWT_SECRET');

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 修正: 統一されたCORS設定を適用
  try {
    await runMiddleware(req, res);
  } catch (error) {
    console.error('CORS error in reject API:', error);
    return res.status(403).json({ error: 'CORS error' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;
  const { reason, sendNotificationEmail = true } = req.body; // ✅ 追加: メール送信フラグ
  const userId = parseInt(id as string);

  if (isNaN(userId)) {
    return res.status(400).json({ error: '無効なユーザーIDです' });
  }

  if (!reason || !reason.trim()) {
    return res.status(400).json({ error: '拒否理由は必須です' });
  }

  try {
    // JWT認証
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: '認証が必要です' });
    }

    const decoded = jwt.verify(token, ADMIN_JWT_SECRET) as any;
    if (!decoded.adminId && !decoded.id) {
      return res.status(401).json({ error: '無効なトークンです' });
    }

    // adminId変数を正しく定義
    const adminId = decoded.adminId || decoded.id;

    // ユーザー存在確認
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ error: 'ユーザーが見つかりません' });
    }

    if (user.status !== 'pending') {
      return res.status(400).json({ error: '承認待ち状態のユーザーではありません' });
    }

    // 🔧 修正: アカウント拒否通知メール送信（削除前に送信）
    if (sendNotificationEmail) {
      try {
        const subject = 'アカウント申請について';
        const html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #dc2626;">アカウント申請の結果について</h2>
            
            <p>${user.name} 様</p>
            
            <p>Opt.システムへのアカウント申請をご審査させていただきましたが、今回は申請をお受けすることができませんでした。</p>
            
            <div style="background-color: #fef2f2; padding: 20px; border-radius: 4px; margin: 20px 0; border-left: 4px solid #dc2626;">
              <p><strong>拒否理由：</strong></p>
              <p style="margin: 0; color: #7f1d1d;">${reason}</p>
            </div>
            
            <p>ご不明な点がございましたら、お気軽にお問い合わせください。</p>
            
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
            
            <p style="font-size: 12px; color: #999;">
              ${process.env.COMPANY_NAME || '有限会社丸一機料商会'} Opt.システム<br>
              拒否日時: ${new Date().toLocaleString('ja-JP')}
            </p>
          </div>
        `;

        await sendEmail(user.email, subject, html);
        console.log(`✅ [API] アカウント拒否通知メール送信成功: ${user.email}`);
      } catch (emailError) {
        console.warn(`⚠️ [API] アカウント拒否通知メール送信失敗: ${getErrorMessage(emailError)}`);
        // メール送信失敗してもアカウント拒否は続行
      }
    }

    // ユーザー拒否（削除またはステータス更新）
    // ここでは削除する方針で実装
    await prisma.user.delete({
      where: { id: userId },
    });

    // 管理者操作ログ記録
    await prisma.adminOperationLog.create({
      data: {
        adminId: adminId,
        action: 'USER_REJECTED',
        targetType: 'User',
        targetId: userId,
        details: `ユーザー「${user.name}」(${user.email})の申請を拒否しました。理由: ${reason}`,
      },
    });

    console.log('✅ ユーザー拒否完了:', {
      userId,
      userName: user.name,
      userEmail: user.email,
      reason,
      adminId,
      emailSent: sendNotificationEmail
    });

    return res.status(200).json({ 
      message: 'ユーザー申請を拒否しました',
      reason: reason,
      emailSent: sendNotificationEmail, // ✅ 追加: メール送信フラグ
    });

  } catch (error) {
    console.error('❌ ユーザー拒否エラー:', getErrorMessage(error));
    return res.status(500).json({ 
      error: 'サーバーエラーが発生しました',
      details: process.env.NODE_ENV === 'development' ? getErrorMessage(error) : undefined
    });
  }
}