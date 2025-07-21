// OptiOil-Frontend/lib/env.ts - クライアントサイド安全版
/**
 * ユーザーFE用環境変数管理ヘルパー
 * クライアントサイドでも確実に動作するよう修正
 */

/**
 * 安全な環境変数取得関数（クライアントサイド対応）
 * @param key 環境変数のキー
 * @returns 環境変数の値
 */
function getSafeEnv(key: string): string {
  // クライアントサイドでも確実に取得
  const value = process.env[key];
  
  if (!value) {
    // 開発環境のみフォールバック値を許可
    if (process.env.NODE_ENV === 'development') {
      const fallbacks = {
        'NEXT_PUBLIC_API_URL': 'http://localhost:3001',
        'NEXT_PUBLIC_FRONTEND_URL': 'http://localhost:3000',
        'NEXT_PUBLIC_ADMIN_URL': 'http://localhost:3002'
      };
      const fallback = fallbacks[key as keyof typeof fallbacks];
      if (fallback) {
        console.warn(`⚠️ ${key}が.envから読み込めませんでした。開発用フォールバック値を使用: ${fallback}`);
        return fallback;
      }
    }
    throw new Error(`${key}環境変数が設定されていません。.envファイルを確認してください。`);
  }
  return value;
}

/**
 * 環境変数を事前に取得して定数として保持
 * これによりクライアントサイドでも確実に動作
 */
const API_URL = getSafeEnv('NEXT_PUBLIC_API_URL');
const FRONTEND_URL = getSafeEnv('NEXT_PUBLIC_FRONTEND_URL');
const ADMIN_URL = getSafeEnv('NEXT_PUBLIC_ADMIN_URL');

/**
 * 環境変数の一元管理オブジェクト
 * getter ではなく直接値を返すことで確実性を向上
 */
export const ENV = {
  /** API サーバーのベースURL */
  API_URL,
  
  /** フロントエンドのベースURL */
  FRONTEND_URL,
  
  /** 管理者画面のURL */
  ADMIN_URL,
} as const;

/**
 * 後方互換性のための関数（非推奨）
 * @deprecated ENV.API_URL を直接使用してください
 */
export function getRequiredEnv(key: string): string {
  return getSafeEnv(key);
}

/**
 * 型安全性を確保するための型定義
 */
export type EnvConfig = typeof ENV;

/**
 * 開発用のヘルパー関数：環境変数の設定状況をチェック
 */
export function checkEnvConfig(): void {
  console.log('🔧 ユーザーFE環境変数チェック:');
  try {
    console.log('API_URL:', ENV.API_URL);
    console.log('FRONTEND_URL:', ENV.FRONTEND_URL);
    console.log('ADMIN_URL:', ENV.ADMIN_URL);
    console.log('📋 ユーザーFE環境変数が正常に読み込まれました');
  } catch (error) {
    console.error('❌ ユーザーFE環境変数エラー:', error);
  }
}

// 初期化時にチェック実行（開発環境のみ）
if (process.env.NODE_ENV === 'development') {
  checkEnvConfig();
}