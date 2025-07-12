/**
 * ファイルパス: OptiOil-API/pages/api/auth/signup.ts
 * 新規登録API（実際のメール送信対応版）
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../lib/prisma";
import bcrypt from "bcryptjs";
import { runMiddleware } from "../../../lib/cors";
import { sendEmail } from "../../../utils/email"; // 🔧 修正: sendEmailのみimport

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
  // CORS対応
  await runMiddleware(req, res);

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  const { name, email, password, phone, company, department, position, agreeToTerms } = req.body;
  
  if (!name || !email || !password || !company) {
    return res.status(400).json({ error: "必須項目が不足しています" });
  }

  // 利用規約同意チェック
  if (!agreeToTerms) {
    return res.status(400).json({ error: "利用規約およびプライバシーポリシーへの同意が必要です" });
  }

  const domain = email.split("@")[1];

  try {
    // 同じドメインのユーザーが存在するかチェック（メインアカウント重複防止）
    const existingMainUser = await prisma.user.findFirst({
      where: {
        email: {
          endsWith: `@${domain}`,
        },
      },
    });

    if (existingMainUser) {
      return res.status(400).json({ 
        error: "この会社のメインアカウントは既に存在します。サブアカウント作成をご検討下さい。" 
      });
    }

    // 現在アクティブな利用規約とプライバシーポリシーの情報を取得
    const [termsDocument, privacyDocument] = await Promise.all([
      prisma.legalDocument.findFirst({
        where: { type: 'terms', isActive: true },
        orderBy: { publishedAt: 'desc' }
      }),
      prisma.legalDocument.findFirst({
        where: { type: 'privacy', isActive: true },
        orderBy: { publishedAt: 'desc' }
      })
    ]);

    // パスワードをハッシュ化
    const hashedPassword = await bcrypt.hash(password, 10);

    // Companyテーブルに登録（会社名とID）
    const newCompany = await prisma.company.create({
      data: {
        name: company,
      },
    });

    // ユーザー作成
    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        phone,
        department,
        position,
        systemRole: "main",
        status: "pending",
        companyId: newCompany.id,
      },
    });

    // IPアドレスとユーザーエージェントを取得
    const ipAddress = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.socket.remoteAddress || null;
    const userAgent = req.headers['user-agent'] || null;

    // 同意情報を保存
    const consentPromises = [];
    
    if (termsDocument) {
      consentPromises.push(
        prisma.userConsent.create({
          data: {
            userId: newUser.id,
            documentType: 'terms',
            documentVersion: termsDocument.version,
            ipAddress: Array.isArray(ipAddress) ? ipAddress[0] : ipAddress,
            userAgent: Array.isArray(userAgent) ? userAgent[0] : userAgent,
          }
        })
      );
    }

    if (privacyDocument) {
      consentPromises.push(
        prisma.userConsent.create({
          data: {
            userId: newUser.id,
            documentType: 'privacy',
            documentVersion: privacyDocument.version,
            ipAddress: Array.isArray(ipAddress) ? ipAddress[0] : ipAddress,
            userAgent: Array.isArray(userAgent) ? userAgent[0] : userAgent,
          }
        })
      );
    }

    // 同意情報を並列で保存
    if (consentPromises.length > 0) {
      await Promise.all(consentPromises);
      console.log(`✅ [API] 同意情報保存完了: userId=${newUser.id}, 文書数=${consentPromises.length}`);
    }

    console.log(`✅ [API] 新規ユーザー登録: ${email}, companyId: ${newCompany.id}`);

    // メール送信（2通）
    const emailPromises = [];

    // 🔧 修正: 1. ユーザーへの登録確認メール（sendEmail関数で実装）
    const userConfirmationSubject = "Opt.システム登録申請を受け付けました";
    const userConfirmationHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #115e59;">登録申請ありがとうございます</h2>
        
        <p>${name} 様</p>
        
        <p>Opt.システムへの登録申請を受け付けました。</p>
        
        <div style="background-color: #f0fdfa; padding: 20px; border-radius: 4px; margin: 20px 0; border-left: 4px solid #115e59;">
          <h3 style="margin: 0 0 10px 0; color: #115e59;">申請内容</h3>
          <p><strong>会社名：</strong> ${company}</p>
          <p><strong>お名前：</strong> ${name}</p>
          <p><strong>メールアドレス：</strong> ${email}</p>
          <p style="margin: 0;"><strong>申請日時：</strong> ${new Date().toLocaleString('ja-JP')}</p>
        </div>
        
        <p>管理者による承認後、ご利用いただけるようになります。</p>
        <p>承認が完了しましたら、改めてメールでご連絡いたします。</p>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
        
        <p style="font-size: 12px; color: #999;">
          ${process.env.COMPANY_NAME || '有限会社丸一機料商会'} Opt.システム
        </p>
      </div>
    `;

    emailPromises.push(
      sendEmail(email, userConfirmationSubject, userConfirmationHtml)
        .then(() => {
          console.log(`✅ [API] ユーザー向け登録確認メール送信成功: ${email}`);
        })
        .catch((error) => {
          console.warn(`⚠️ [API] ユーザー向け登録確認メール送信失敗: ${getErrorMessage(error)}`);
        })
    );

    // 2. 管理者向け新規登録通知メール
    const adminNotificationSubject = "【Opt.】新規メインアカウント登録申請";
    const adminNotificationHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px;">
        <h2 style="color: #115e59;">新規メインアカウント登録申請</h2>
        
        <p>新しい申請がありました：</p>
        
        <table style="border-collapse: collapse; width: 100%; margin: 20px 0;">
          <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9;"><strong>会社名</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${company}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9;"><strong>氏名</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${name}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9;"><strong>メール</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${email}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9;"><strong>部署</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${department || "-"}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9;"><strong>役職</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${position || "-"}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9;"><strong>電話番号</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${phone || "-"}</td></tr>
        </table>
        
        <h3 style="color: #115e59; margin-top: 30px;">同意情報</h3>
        <ul>
          <li>利用規約同意: ${termsDocument ? `○ (v${termsDocument.version})` : '文書なし'}</li>
          <li>プライバシーポリシー同意: ${privacyDocument ? `○ (v${privacyDocument.version})` : '文書なし'}</li>
          <li>同意日時: ${new Date().toLocaleString('ja-JP')}</li>
          <li>IPアドレス: ${Array.isArray(ipAddress) ? ipAddress[0] : ipAddress || '不明'}</li>
        </ul>
        
        <div style="margin: 30px 0; text-align: center;">
          <a href="${process.env.NEXT_PUBLIC_ADMIN_URL}/users" 
             style="background-color: #115e59; color: white; padding: 12px 24px; 
                    text-decoration: none; border-radius: 4px; display: inline-block;">
            管理画面で承認する
          </a>
        </div>
      </div>
    `;

    // 🔧 修正: sendEmail関数の引数を3つの個別引数に変更
    emailPromises.push(
      sendEmail(
        process.env.SUPPORT_EMAIL || process.env.EMAIL_USER!,
        adminNotificationSubject,
        adminNotificationHtml
      )
        .then(() => {
          console.log(`✅ [API] 管理者向け新規登録通知メール送信成功`);
        })
        .catch((error) => {
          console.warn(`⚠️ [API] 管理者向け新規登録通知メール送信失敗: ${getErrorMessage(error)}`);
        })
    );

    // メール送信実行（並列）
    await Promise.allSettled(emailPromises);

    return res.status(201).json({ 
      success: true, 
      userId: newUser.id,
      message: "登録申請を受け付けました。承認までお待ちください。"
    });

  } catch (error) {
    console.error("❌ [API] 新規登録エラー:", error);
    return res.status(500).json({ 
      error: "サーバーエラーが発生しました",
      details: process.env.EMAIL_DEBUG === 'true' ? getErrorMessage(error) : undefined
    });
  }
}