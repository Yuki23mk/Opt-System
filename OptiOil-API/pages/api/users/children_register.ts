/**
 * ファイルパス: OptiOil-API/pages/api/users/children_register.ts
 * サブアカウント作成API（メール送信機能追加版）
 */

import { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../lib/prisma";
import { verifyToken } from "../../../lib/auth/jwt";
import { sendEmail } from "../../../utils/email"; // 🔧 修正: 既存のsendEmail関数を使用
import { hashPassword, generateTemporaryPassword } from "../../../utils/password";


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
  // 既存のCORS対応を保持
  setCorsHeaders(req, res);

  // 既存のプリフライト対応を保持
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ message: "Method Not Allowed" });

  // 既存の認証処理を保持
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "トークンがありません" });

  const decoded = verifyToken(token);

  if (!decoded || decoded.systemRole !== "main") {
    return res.status(403).json({ message: "操作が許可されていません" });
  }

  try {
    // 既存のバリデーションを保持
    const { 
      email, 
      password, 
      name, 
      phone, 
      position, 
      department,
      sendNotificationEmail = true, // ✅ 追加: メール送信フラグ
      generateTempPassword = true   // ✅ 追加: 一時パスワード生成フラグ
    } = req.body;
    
    if (!email || !name) {
      return res.status(400).json({ message: "メールアドレスと名前は必須です" });
    }

    // パスワードチェック（一時パスワード生成しない場合は必須）
    if (!generateTempPassword && !password) {
      return res.status(400).json({ message: "パスワードが必要です" });
    }

    // 🆕 追加: 削除済みメールアドレスのチェック
    if (email.startsWith('deleted_')) {
      return res.status(400).json({ 
        message: "このメールアドレスは使用できません。別のメールアドレスを指定してください。" 
      });
    }

    // 新規追加：3つまでの制限チェック
    const currentChildrenCount = await prisma.user.count({
      where: {
        createdById: decoded.id,
        systemRole: "child",      // 既存仕様に合わせる
        status: {
          not: "deleted"          // 削除済みは除外してカウント
        }
      }
    });

    if (currentChildrenCount >= 3) {
      return res.status(400).json({ 
        message: "サブアカウントは最大3つまでしか作成できません。既存のアカウントを削除してから再度お試しください。",
        currentCount: currentChildrenCount,
        maxCount: 3
      });
    }

    // 既存のメール重複チェックを保持
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ message: "このメールアドレスは既に使用されています" });
    }

    // ✅ 修正: パスワード処理（一時パスワード生成 or 既存パスワード使用）
    let finalPassword = password;
    let tempPassword = null;

    if (generateTempPassword) {
      tempPassword = generateTemporaryPassword(12);
      finalPassword = tempPassword;
    }

    // 既存のパスワードハッシュ化を保持
    const hashedPassword = await hashPassword(finalPassword);

    // ✅ 追加: メインアカウントユーザーの情報を取得（メール送信用）
    const mainAccountUser = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: {
        companyRel: {
          select: { name: true }
        }
      }
    });

    if (!mainAccountUser) {
      return res.status(404).json({ message: "メインアカウントが見つかりません" });
    }

    // 既存のユーザー作成処理を保持（settingsを追加）
    const newUser = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        phone,
        position,
        department,
        systemRole: "child",          // 既存仕様を保持
        status: "active",             // 既存仕様を保持
        createdById: decoded.id,
        companyId: decoded.companyId,
        permissions: { 
          products: true, 
          orders: true, 
          equipment: true,
          settings: true              // 新規追加
        }
      },
    });

    // 🔧 修正: サブアカウント作成通知メール送信（sendEmail関数で実装）
    if (sendNotificationEmail && tempPassword) {
      try {
        const subject = 'サブアカウントが作成されました';
        const html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #115e59;">サブアカウント作成のお知らせ</h2>
            
            <p>${name} 様</p>
            
            <p>「${mainAccountUser.companyRel.name}」のOpt.システムにサブアカウントが作成されました。</p>
            
            <div style="background-color: #f0fdfa; padding: 20px; border-radius: 4px; margin: 20px 0; border-left: 4px solid #115e59;">
              <h3 style="margin: 0 0 10px 0; color: #115e59;">アカウント情報</h3>
              <p><strong>作成者：</strong> ${mainAccountUser.name}</p>
              <p><strong>会社名：</strong> ${mainAccountUser.companyRel.name}</p>
              <p><strong>お名前：</strong> ${name}</p>
              <p><strong>メールアドレス：</strong> ${email}</p>
              <p style="margin: 0;"><strong>作成日時：</strong> ${new Date().toLocaleString('ja-JP')}</p>
            </div>
            
            <div style="background-color: #fef3c7; padding: 20px; border-radius: 4px; margin: 20px 0; border-left: 4px solid #d97706;">
              <p><strong>一時パスワード：</strong></p>
              <p><code style="background-color: #fed7aa; padding: 4px 8px; font-size: 16px; color: #92400e;">${tempPassword}</code></p>
            </div>
            
            <p style="color: #d97706; font-weight: bold;">
              セキュリティのため、初回ログイン後に必ずパスワードを変更してください。
            </p>
            
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
              作成者: ${mainAccountUser.name}<br>
              作成日時: ${new Date().toLocaleString('ja-JP')}
            </p>
          </div>
        `;

        await sendEmail(email, subject, html);
      } catch (emailError) {
        console.warn(`⚠️ [API] サブアカウント作成通知メール送信失敗: ${getErrorMessage(emailError)}`);
        // メール送信失敗してもアカウント作成は成功扱い
      }
    }

    // 既存のレスポンス + アカウント情報追加
    return res.status(201).json({ 
      message: "サブアカウントを登録しました", 
      user: {
        ...newUser,
        password: undefined, // パスワードは返さない
      },
      accountInfo: {                  // 新規追加：アカウント数情報
        currentCount: currentChildrenCount + 1,
        maxCount: 3,
        remaining: 3 - (currentChildrenCount + 1)
      },
      tempPasswordGenerated: !!tempPassword, // ✅ 追加: 一時パスワード生成フラグ
      emailSent: sendNotificationEmail && !!tempPassword // ✅ 追加: メール送信フラグ
    });

  } catch (error) {
    console.error("❌ サブアカウント作成エラー:", getErrorMessage(error));
    return res.status(500).json({ 
      message: "登録に失敗しました",
      details: process.env.NODE_ENV === 'development' ? getErrorMessage(error) : undefined
    });
  }
}