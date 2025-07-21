/**
 * ファイルパス: OptiOil-API/pages/api/users/mfa/verify.ts
 * MFA検証API（ログイン時用）- otplib統一版
 */

import { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../../lib/prisma";
import { verifyToken, generateToken } from "../../../../lib/auth/jwt";
import { authenticator } from 'otplib'; // ✅ otplibに統一

// 🆕 型安全エラーハンドリング関数を追加
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown error occurred';
}

// 🔧 CORS設定を環境変数ベースに変更
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

// 🔧 CORS設定関数を直接定義
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
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  try {
    const { tempToken, mfaCode, backupCode } = req.body;

    // 必須パラメータチェック
    if (!tempToken) {
      return res.status(400).json({ message: "一時トークンが必要です" });
    }

    if (!mfaCode && !backupCode) {
      return res.status(400).json({ message: "MFAコードまたはバックアップコードが必要です" });
    }

    // 一時トークンを検証（短時間有効なトークン）
    const tempDecoded = verifyToken(tempToken);
    if (!tempDecoded || typeof tempDecoded === "string") {
      return res.status(401).json({ message: "無効な一時トークンです" });
    }

    // 一時トークンの種類確認（MFA用の特別なトークンかチェック）
    if (!tempDecoded.requiresMFA) {
      return res.status(400).json({ message: "MFA検証が不要なトークンです" });
    }

    // ユーザー情報を取得
    const user = await prisma.user.findUnique({
      where: { id: tempDecoded.id },
      select: {
        id: true,
        email: true,
        name: true,
        systemRole: true,
        companyId: true,
        status: true,
        twoFactorEnabled: true,
        twoFactorSecret: true,
        backupCodes: true,
        companyRel: {
          select: { name: true }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ message: "ユーザーが見つかりません" });
    }

    // MFAが有効でない場合はエラー
    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      return res.status(400).json({ message: "MFAが設定されていません" });
    }

    let verified = false;
    let usedBackupCode = false;

    if (backupCode) {
      // バックアップコード検証
      let backupCodes = [];
      try {
        backupCodes = typeof user.backupCodes === 'string' 
          ? JSON.parse(user.backupCodes) 
          : user.backupCodes || [];
      } catch (e) {
        console.error('バックアップコードのパースエラー:', e);
        return res.status(500).json({ message: "バックアップコードの検証に失敗しました" });
      }

      const codeIndex = backupCodes.indexOf(backupCode.toUpperCase());
      if (codeIndex !== -1) {
        verified = true;
        usedBackupCode = true;
        
        // 使用済みバックアップコードを削除
        backupCodes.splice(codeIndex, 1);
        await prisma.user.update({
          where: { id: user.id },
          data: { backupCodes: JSON.stringify(backupCodes) }
        });
      }
    } else if (mfaCode) {
      // ✅ otplibで TOTPコード検証（speakeasyから変更）
      if (!/^\d{6}$/.test(mfaCode)) {
        return res.status(400).json({ message: "MFAコードは6桁の数字である必要があります" });
      }

      verified = authenticator.verify({
        token: mfaCode,
        secret: user.twoFactorSecret
        // window設定はotplibでは内部で適切に処理される
      });
    }

    if (!verified) {
      console.log('❌ [API] MFA検証失敗:', {
        userId: user.id,
        email: user.email,
        usedBackupCode: !!backupCode,
        usedMFACode: !!mfaCode,
        library: 'otplib'
      });
      return res.status(400).json({ 
        message: usedBackupCode ? "バックアップコードが正しくありません" : "MFAコードが正しくありません"
      });
    }

    // 本格的なログイントークンを生成
    const finalToken = generateToken({
      id: user.id,
      email: user.email,
      systemRole: user.systemRole,
      companyId: user.companyId
    });

    console.log('✅ [API] MFA検証成功:', {
      userId: user.id,
      email: user.email,
      usedBackupCode,
      library: 'otplib',
      remainingBackupCodes: usedBackupCode ? JSON.parse(user.backupCodes as string || '[]').length : 'N/A'
    });

    // レスポンス
    return res.status(200).json({
      message: "ログインが完了しました",
      token: finalToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        systemRole: user.systemRole,
        companyId: user.companyId,
        company: user.companyRel?.name || null,
        status: user.status
      },
      usedBackupCode: usedBackupCode
    });

  } catch (error) {
    console.error("❌ MFA検証エラー:", error);
    return res.status(500).json({ message: "MFA検証に失敗しました" });
  }
}