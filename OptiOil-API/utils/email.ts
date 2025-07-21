// OptiOil-API/utils/email.ts
import * as nodemailer from 'nodemailer';

// 環境変数の型定義
interface EmailConfig {
  user: string;
  pass: string;
  companyName: string;
  frontendUrl?: string;      // ✅ オプショナルに変更
  adminUrl?: string;         // ✅ 管理者URL追加
  debug: boolean;
}

// メール設定の取得と検証
export function getEmailConfig(): EmailConfig {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  const companyName = process.env.COMPANY_NAME || '有限会社丸一機料商会';
  const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL;    // ✅ undefined可能
  const adminUrl = process.env.NEXT_PUBLIC_ADMIN_URL;          // ✅ 管理者URL追加
  const debug = process.env.EMAIL_DEBUG === 'true';

  if (!user || !pass) {
    throw new Error('EMAIL_USER and EMAIL_PASS must be set in environment variables');
  }

  return { user, pass, companyName, frontendUrl, adminUrl, debug };
}

// nodemailerトランスポーターの作成
export function createEmailTransporter() {
  const config = getEmailConfig();
  
  if (config.debug) {
    console.log('📧 Creating email transporter with config:', {
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      user: config.user,
      hasPassword: !!config.pass,
    });
  }

  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });
}

// メール送信の基本関数
export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const config = getEmailConfig();
  
  try {
    const transporter = createEmailTransporter();
    
    const mailOptions = {
      from: `"${config.companyName}" <${config.user}>`,
      to: to,
      subject: subject,
      html: html,
    };

    if (config.debug) {
      console.log('📧 Sending email:', {
        from: mailOptions.from,
        to: mailOptions.to,
        subject: mailOptions.subject,
      });
    }

    const result = await transporter.sendMail(mailOptions);
    
    if (config.debug) {
      console.log('✅ Email sent successfully:', result.messageId);
    }
    
    return true;
  } catch (error) {
    const config = getEmailConfig();
    console.error('❌ Email sending failed:', error);
    
    if (config.debug) {
      console.error('Email error details:', {
        code: (error as any).code,
        command: (error as any).command,
        response: (error as any).response,
      });
    }
    
    // メール送信失敗でもアプリケーションは継続
    return false;
  }
}

// ===== 各種メールテンプレート =====

// 新規登録確認メール
export async function sendRegistrationEmail(to: string, userName: string, companyName: string): Promise<boolean> {
  const config = getEmailConfig();
  
  const subject = `${config.companyName} - 新規アカウント登録のご確認`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #115e59;">アカウント登録ありがとうございます</h2>
      
      <p>${userName}様</p>
      <p>この度は${config.companyName}のOpt.システムにご登録いただき、ありがとうございます。</p>
      
      <div style="background-color: #f0fdfa; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="color: #115e59; margin-top: 0;">登録内容</h3>
        <p><strong>お名前:</strong> ${userName}</p>
        <p><strong>会社名:</strong> ${companyName}</p>
        <p><strong>メールアドレス:</strong> ${to}</p>
      </div>
      
      <p>アカウントの承認が完了次第、ログイン用の一時パスワードをお送りいたします。</p>
      <p>承認完了まで今しばらくお待ちください。</p>
      
      <hr style="margin: 30px 0;">
      <p style="color: #666; font-size: 12px;">
        このメールは自動送信されています。<br>
        ご不明な点がございましたら、弊社までお問い合わせください。
      </p>
    </div>
  `;
  
  return await sendEmail(to, subject, html);
}

// アカウント承認完了メール
export async function sendApprovalEmail(to: string, userName: string, temporaryPassword: string): Promise<boolean> {
  const config = getEmailConfig();
  
  // ✅ フロントエンドURLの安全な取得
  const loginUrl = config.frontendUrl 
    ? `${config.frontendUrl}/login`
    : 'ログインページ（URLは管理者にお問い合わせください）';
  
  const subject = `${config.companyName} - アカウント承認完了のお知らせ`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #115e59;">アカウント承認が完了しました</h2>
      
      <p>${userName}様</p>
      <p>アカウントの承認が完了いたしました。以下の情報でOpt.システムにログインしてください。</p>
      
      <div style="background-color: #f0fdfa; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="color: #115e59; margin-top: 0;">ログイン情報</h3>
        ${config.frontendUrl ? 
          `<p><strong>ログインURL:</strong> <a href="${loginUrl}">${loginUrl}</a></p>` :
          `<p><strong>ログインURL:</strong> ${loginUrl}</p>`
        }
        <p><strong>メールアドレス:</strong> ${to}</p>
        <p><strong>一時パスワード:</strong> <code style="background: #e5e7eb; padding: 4px 8px; border-radius: 4px;">${temporaryPassword}</code></p>
      </div>
      
      <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
        <p style="margin: 0; color: #92400e;">
          <strong>重要:</strong> セキュリティのため、初回ログイン後に必ずパスワードを変更してください。
        </p>
      </div>
      
      <hr style="margin: 30px 0;">
      <p style="color: #666; font-size: 12px;">
        このメールは自動送信されています。<br>
        ご不明な点がございましたら、弊社までお問い合わせください。
      </p>
    </div>
  `;
  
  return await sendEmail(to, subject, html);
}

// アカウント拒否通知メール
export async function sendRejectionEmail(to: string, userName: string, reason: string): Promise<boolean> {
  const config = getEmailConfig();
  
  const subject = `${config.companyName} - アカウント申請について`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #dc2626;">アカウント申請の結果について</h2>
      
      <p>${userName}様</p>
      <p>この度はOpt.システムへのアカウント申請をいただき、ありがとうございました。</p>
      
      <p>誠に申し訳ございませんが、今回のアカウント申請については、以下の理由により承認いたしかねます。</p>
      
      <div style="background-color: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
        <h3 style="color: #dc2626; margin-top: 0;">拒否理由</h3>
        <p style="margin: 0;">${reason}</p>
      </div>
      
      <p>ご不明な点やご質問がございましたら、お気軽にお問い合わせください。</p>
      
      <hr style="margin: 30px 0;">
      <p style="color: #666; font-size: 12px;">
        このメールは自動送信されています。<br>
        ご不明な点がございましたら、弊社までお問い合わせください。
      </p>
    </div>
  `;
  
  return await sendEmail(to, subject, html);
}

// サブアカウント作成通知メール
export async function sendSubAccountEmail(to: string, userName: string, createdByName: string, temporaryPassword: string): Promise<boolean> {
  const config = getEmailConfig();
  
  // ✅ フロントエンドURLの安全な取得
  const loginUrl = config.frontendUrl 
    ? `${config.frontendUrl}/login`
    : 'ログインページ（URLは管理者にお問い合わせください）';
  
  const subject = `${config.companyName} - アカウントが作成されました`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #115e59;">Opt.システムアカウントが作成されました</h2>
      
      <p>${userName}様</p>
      <p>${createdByName}様により、あなたのOpt.システムアカウントが作成されました。</p>
      
      <div style="background-color: #f0fdfa; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="color: #115e59; margin-top: 0;">ログイン情報</h3>
        ${config.frontendUrl ? 
          `<p><strong>ログインURL:</strong> <a href="${loginUrl}">${loginUrl}</a></p>` :
          `<p><strong>ログインURL:</strong> ${loginUrl}</p>`
        }
        <p><strong>メールアドレス:</strong> ${to}</p>
        <p><strong>一時パスワード:</strong> <code style="background: #e5e7eb; padding: 4px 8px; border-radius: 4px;">${temporaryPassword}</code></p>
      </div>
      
      <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
        <p style="margin: 0; color: #92400e;">
          <strong>重要:</strong> セキュリティのため、初回ログイン後に必ずパスワードを変更してください。
        </p>
      </div>
      
      <hr style="margin: 30px 0;">
      <p style="color: #666; font-size: 12px;">
        このメールは自動送信されています。<br>
        ご不明な点がございましたら、弊社までお問い合わせください。
      </p>
    </div>
  `;
  
  return await sendEmail(to, subject, html);
}

// パスワードリセット通知メール
export async function sendPasswordResetEmail(to: string, resetToken: string, isAdmin: boolean = false): Promise<boolean> {
  const config = getEmailConfig();
  
  const systemName = isAdmin ? 'Opt.管理者システム' : 'Opt.システム';
  
  // ✅ URL の安全な取得・構築
  let resetUrl: string;
  
  if (isAdmin) {
    // 管理者の場合
    if (config.adminUrl) {
      resetUrl = `${config.adminUrl}/admin/password-reset/${resetToken}`;
    } else {
      resetUrl = `管理者パスワードリセットページ（URLは管理者にお問い合わせください。トークン: ${resetToken}）`;
    }
  } else {
    // 一般ユーザーの場合
    if (config.frontendUrl) {
      resetUrl = `${config.frontendUrl}/password-reset/${resetToken}`;
    } else {
      resetUrl = `パスワードリセットページ（URLは管理者にお問い合わせください。トークン: ${resetToken}）`;
    }
  }
  
  const subject = `${config.companyName} - ${systemName} パスワードリセット`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #115e59;">パスワードリセットのご案内</h2>
      
      <p>${systemName}のパスワードリセットが申請されました。</p>
      
      <div style="background-color: #f0fdfa; padding: 20px; border-radius: 8px; margin: 20px 0;">
        ${(isAdmin && config.adminUrl) || (!isAdmin && config.frontendUrl) ? `
          <p style="margin: 0 0 15px 0;">以下のリンクをクリックして、新しいパスワードを設定してください：</p>
          <p style="margin: 0;">
            <a href="${resetUrl}" style="display: inline-block; background-color: #115e59; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">
              パスワードを再設定する
            </a>
          </p>
        ` : `
          <p style="margin: 0 0 15px 0;">パスワードリセットを実行するには、管理者にお問い合わせの上、以下のトークンをお伝えください：</p>
          <p style="margin: 0; font-family: monospace; background: #e5e7eb; padding: 8px; border-radius: 4px;">
            ${resetToken}
          </p>
        `}
      </div>
      
      <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
        <p style="margin: 0; color: #92400e;">
          <strong>注意:</strong> この${(isAdmin && config.adminUrl) || (!isAdmin && config.frontendUrl) ? 'リンク' : 'トークン'}は${isAdmin ? '1時間' : '30分'}で期限切れになります。<br>
          ${(isAdmin && config.adminUrl) || (!isAdmin && config.frontendUrl) ? `
            リンクが機能しない場合は、以下のURLを直接ブラウザにコピーしてください：<br>
            <code style="word-break: break-all;">${resetUrl}</code>
          ` : ''}
        </p>
      </div>
      
      <p>このリクエストに心当たりがない場合は、このメールを無視してください。</p>
      
      <hr style="margin: 30px 0;">
      <p style="color: #666; font-size: 12px;">
        このメールは自動送信されています。<br>
        ご不明な点がございましたら、弊社までお問い合わせください。
      </p>
    </div>
  `;
  
  return await sendEmail(to, subject, html);
}

// 管理者向け新規登録通知メール
export async function sendAdminNotificationEmail(adminEmail: string, userName: string, userEmail: string, companyName: string): Promise<boolean> {
  const config = getEmailConfig();
  
  const subject = `${config.companyName} - 新規アカウント登録申請`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #115e59;">新規アカウント登録申請の通知</h2>
      
      <p>Opt.システムに新しいアカウント登録申請がありました。</p>
      
      <div style="background-color: #f0fdfa; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="color: #115e59; margin-top: 0;">申請者情報</h3>
        <p><strong>お名前:</strong> ${userName}</p>
        <p><strong>会社名:</strong> ${companyName}</p>
        <p><strong>メールアドレス:</strong> ${userEmail}</p>
        <p><strong>申請日時:</strong> ${new Date().toLocaleString('ja-JP')}</p>
      </div>
      
      <p>管理画面から承認・拒否の操作を行ってください。</p>
      
      <hr style="margin: 30px 0;">
      <p style="color: #666; font-size: 12px;">
        このメールは自動送信されています。
      </p>
    </div>
  `;
  
  return await sendEmail(adminEmail, subject, html);
}