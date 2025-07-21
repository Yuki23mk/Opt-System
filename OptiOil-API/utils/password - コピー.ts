/**
 * ファイルパス: OptiOil-API/utils/password.ts
 * パスワードハッシュ化の共有コンポーネント関数
 * * パスワード関連のユーティリティ（11文字以上・記号対応版）
 */
import bcrypt from "bcryptjs";

// 環境変数からSalt Rounds（ハッシュ強度）を取得（デフォルト: 10）
const SALT_ROUNDS = parseInt(process.env.PASSWORD_SALT_ROUNDS || "10", 10);
const MIN_LENGTH = parseInt(process.env.PASSWORD_MIN_LENGTH || "11", 10);

/**
 * パスワードをハッシュ化
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * パスワードを検証
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * パスワードの強度をチェック（記号対応版）
 */
export function validatePasswordStrength(password: string): { 
  isValid: boolean; 
  errors: string[] 
} {
  const errors: string[] = [];
  
  // 長さチェック（11文字以上）
  if (password.length < MIN_LENGTH) {
    errors.push(`パスワードは${MIN_LENGTH}文字以上で入力してください`);
  }
  
  // 大文字チェック
  if (!/[A-Z]/.test(password)) {
    errors.push("大文字を1文字以上含めてください");
  }
  
  // 小文字チェック
  if (!/[a-z]/.test(password)) {
    errors.push("小文字を1文字以上含めてください");
  }
  
  // 数字チェック
  if (!/\d/.test(password)) {
    errors.push("数字を1文字以上含めてください");
  }
  
  // 記号チェック（オプション：必須にする場合はコメントアウトを外す）
  // const symbols = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/;
  // if (!symbols.test(password)) {
  //   errors.push("記号を1文字以上含めてください");
  // }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * パスワード強度のスコアを計算（0-5）
 * UI表示用のオプション機能
 */
export function calculatePasswordStrength(password: string): {
  score: number;
  level: 'weak' | 'fair' | 'good' | 'strong' | 'very-strong';
  feedback: string;
} {
  let score = 0;
  
  // 長さによるスコア
  if (password.length >= 11) score += 1;
  if (password.length >= 14) score += 1;
  if (password.length >= 18) score += 1;
  
  // 文字種によるスコア
  if (/[a-z]/.test(password)) score += 0.5;
  if (/[A-Z]/.test(password)) score += 0.5;
  if (/\d/.test(password)) score += 0.5;
  if (/[^a-zA-Z0-9]/.test(password)) score += 0.5; // 記号
  
  // レベル判定
  let level: 'weak' | 'fair' | 'good' | 'strong' | 'very-strong';
  let feedback: string;
  
  if (score < 2) {
    level = 'weak';
    feedback = '弱い：より複雑なパスワードを使用してください';
  } else if (score < 3) {
    level = 'fair';
    feedback = '普通：もう少し強化できます';
  } else if (score < 4) {
    level = 'good';
    feedback = '良い：十分な強度があります';
  } else if (score < 5) {
    level = 'strong';
    feedback = '強い：とても安全なパスワードです';
  } else {
    level = 'very-strong';
    feedback = '非常に強い：最高レベルのセキュリティです';
  }
  
  return { score, level, feedback };
}

/**
 * 安全なランダムパスワード生成
 * サブアカウント作成時の一時パスワード用
 */
export function generateSecurePassword(length: number = 12): string {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*()_+-=';
  
  const allChars = lowercase + uppercase + numbers + symbols;
  let password = '';
  
  // 各種類から最低1文字を含める
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];
  
  // 残りの文字をランダムに生成
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  // シャッフル
  return password.split('').sort(() => Math.random() - 0.5).join('');
}