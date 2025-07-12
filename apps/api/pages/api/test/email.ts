// OptiOil-API/pages/api/test/email.ts
import { NextApiRequest, NextApiResponse } from 'next';
import {
  getEmailConfig,
  sendEmail,
  sendRegistrationEmail,
  sendApprovalEmail,
  sendRejectionEmail,
  sendSubAccountEmail,
  sendPasswordResetEmail,
  sendAdminNotificationEmail
} from '../../../utils/email';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // GET: メール設定確認
    if (req.method === 'GET') {
      const config = getEmailConfig();
      
      return res.status(200).json({
        success: true,
        message: 'メール設定情報',
        config: {
          enabled: true,
          debug: config.debug,
          provider: 'auto',
          user: config.user,
          hasPassword: !!config.pass,
          companyName: config.companyName,
          frontendUrl: config.frontendUrl,
          supportEmail: config.user
        },
        available_tests: [
          'basic',
          'registration', 
          'approval',
          'rejection',
          'subaccount',
          'admin-password-reset'
        ]
      });
    }

    // POST: メール送信テスト
    if (req.method === 'POST') {
      const { to, type } = req.body;

      if (!to) {
        return res.status(400).json({
          success: false,
          error: '送信先メールアドレスが必要です',
          details: 'to field is required'
        });
      }

      if (!type) {
        return res.status(400).json({
          success: false,
          error: 'テストタイプが必要です',
          details: 'type field is required (basic, registration, approval, rejection, subaccount, admin-password-reset)'
        });
      }

      let result = false;
      let message = '';

      // テストタイプ別メール送信
      switch (type) {
        case 'basic':
          result = await sendEmail(
            to,
            'Opt. システム - メール機能テスト',
            `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #115e59;">Opt. システム メール機能テスト</h2>
              <p>このメールは${getEmailConfig().companyName}のOpt.システムからの送信テストです。</p>
              <div style="background-color: #f0fdfa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p><strong>送信日時:</strong> ${new Date().toLocaleString('ja-JP')}</p>
                <p><strong>宛先:</strong> ${to}</p>
                <p><strong>テストタイプ:</strong> Basic Email Test</p>
              </div>
              <p>メール機能が正常に動作しています。</p>
            </div>
            `
          );
          message = 'Basic test email sent successfully';
          break;

        case 'registration':
          result = await sendRegistrationEmail(to, 'テスト太郎', 'テスト株式会社');
          message = 'Registration confirmation email sent successfully';
          break;

        case 'approval':
          result = await sendApprovalEmail(to, 'テスト太郎', 'temp123456');
          message = 'Account approval email sent successfully';
          break;

        case 'rejection':
          result = await sendRejectionEmail(to, 'テスト太郎', '申請内容に不備があったため');
          message = 'Account rejection email sent successfully';
          break;

        case 'subaccount':
          result = await sendSubAccountEmail(to, 'テスト次郎', 'テスト太郎', 'temp789012');
          message = 'Sub-account creation email sent successfully';
          break;

        case 'admin-password-reset':
          result = await sendPasswordResetEmail(to, 'test-reset-token-123', true);
          message = 'Admin password reset email sent successfully';
          break;

        default:
          return res.status(400).json({
            success: false,
            error: `不明なテストタイプ: ${type}`,
            available_types: ['basic', 'registration', 'approval', 'rejection', 'subaccount', 'admin-password-reset']
          });
      }

      if (result) {
        return res.status(200).json({
          success: true,
          message: message,
          to: to,
          type: type
        });
      } else {
        return res.status(500).json({
          success: false,
          error: 'メール送信に失敗しました',
          to: to,
          type: type
        });
      }
    }

    // その他のHTTPメソッド
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
      allowed: ['GET', 'POST']
    });

  } catch (error) {
    console.error('❌ Email test error:', error);
    
    return res.status(500).json({
      success: false,
      error: 'メール送信に失敗しました',
      details: error instanceof Error ? error.message : 'Unknown error',
      config: {
        hasEmailConfig: !!process.env.EMAIL_USER,
        hasEmailPassword: !!process.env.EMAIL_PASS
      }
    });
  }
}