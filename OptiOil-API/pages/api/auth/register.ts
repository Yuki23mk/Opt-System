/**
 * ファイルパス: OptiOil-API/pages/api/auth/register.ts
 * ユーザー登録API（サブアカウント作成）
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { hashPassword, validatePasswordStrength } from "../../../utils/password";

const prisma = new PrismaClient();

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

// 🔧 バリデーション関数
function validateRegistrationData(data: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!data.email || typeof data.email !== 'string' || data.email.trim() === '') {
    errors.push('メールアドレスは必須です');
  }
  
  // メールアドレス形式チェック
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (data.email && !emailRegex.test(data.email)) {
    errors.push('正しいメールアドレスを入力してください');
  }
  
  if (!data.password || typeof data.password !== 'string' || data.password.length < 6) {
    errors.push('パスワードは6文字以上で入力してください');
  }
  
  if (!data.name || typeof data.name !== 'string' || data.name.trim() === '') {
    errors.push('氏名は必須です');
  }
  
  if (!data.companyId || isNaN(Number(data.companyId))) {
    errors.push('有効な会社IDが必要です');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 🔧 CORS設定を追加
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, password, name, companyId, department, position, phone } = req.body;

  try {
    // 🔧 バリデーション
    const validation = validateRegistrationData({ email, password, name, companyId });
    if (!validation.isValid) {
      return res.status(400).json({ 
        error: '入力データが無効です',
        details: validation.errors 
      });
    }

    // パスワード強度チェック
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.isValid) {
      return res.status(400).json({ 
        error: 'パスワードが要件を満たしていません',
        details: passwordValidation.errors 
      });
    }

    // 🔧 メールアドレス重複チェック
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'このメールアドレスは既に登録されています' });
    }

    // 🔧 会社存在確認
    const company = await prisma.company.findUnique({
      where: { id: parseInt(companyId) }
    });

    if (!company) {
      return res.status(400).json({ error: '指定された会社が見つかりません' });
    }

    // 🔧 パスワードハッシュ化
    const hashedPassword = await hashPassword(password);

    // 🔧 ユーザー作成（Opt.スキーマに対応）
    const newUser = await prisma.user.create({
      data: {
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        name: name.trim(),
        companyId: parseInt(companyId),
        department: department?.trim() || null,
        position: position?.trim() || null,
        phone: phone?.trim() || null,
        systemRole: 'child', // サブアカウントとして作成
        status: 'pending', // 管理者承認待ち
        twoFactorEnabled: false,
        createdById: null // 自己登録の場合はnull
      },
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        systemRole: true,
        companyRel: {
          select: { name: true }
        }
      }
    });

    console.log('✅ ユーザー登録成功:', {
      userId: newUser.id,
      email: newUser.email,
      companyName: newUser.companyRel.name
    });

    return res.status(201).json({ 
      message: 'ユーザー登録が完了しました。管理者の承認をお待ちください。',
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        status: newUser.status,
        company: newUser.companyRel.name
      }
    });

  } catch (error) {
    console.error('❌ ユーザー登録エラー:', getErrorMessage(error));
    
    return res.status(500).json({ 
      error: 'ユーザー登録に失敗しました',
      details: process.env.NODE_ENV === 'development' ? getErrorMessage(error) : undefined
    });
  } finally {
    await prisma.$disconnect();
  }
}