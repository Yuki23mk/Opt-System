// OptiOil-API/lib/auth/jwt.ts
import jwt, { SignOptions } from "jsonwebtoken"; // ← SignOptions追加

const SECRET_KEY = process.env.JWT_SECRET as string;          // .env に JWT_SECRET=xxxx
const EXPIRES_IN = "1h";                                      // 期限をまとめて管理

/**
 * サイン済み JWT を返す（既存関数 - 1時間固定）
 */
export function signToken<T extends object>(payload: T) {
  return jwt.sign(payload, SECRET_KEY, { expiresIn: EXPIRES_IN } as SignOptions);
}

/**
 * ✅ MFA対応：カスタム期限対応のgenerateToken関数を追加
 */
export function generateToken<T extends object>(payload: T, expiresIn: string = EXPIRES_IN) {
  return jwt.sign(payload, SECRET_KEY, { expiresIn } as SignOptions); // ← 型アサーション追加
}

/**
 * 検証が通れば payload（＝token に埋め込んだユーザー情報など）を返す  
 * 検証 NG は throw して呼び出し元でキャッチ
 */
export function verifyToken<T extends object = any>(token: string): T {
  try {
    return jwt.verify(token, SECRET_KEY) as T;
  } catch (error) {
    console.error("JWT検証エラー:", error);
    throw error; // エラーを再スローして呼び出し元でキャッチ
  }
}

// 型定義
export interface JWTPayload {
  id: number;
  companyId: number;
  systemRole: string;
  requiresMFA?: boolean; // ✅ MFA用フラグを追加
  [key: string]: any;
}