// OptiOil-Admin/lib/env.ts
/**
 * 管理者FE用環境変数管理ヘルパー
 * 本番環境での安全性を確保するため、フォールバック値を排除
 */

/**
 * 必須環境変数を取得する関数
 * @param key 環境変数のキー
 * @returns 環境変数の値
 * @throws 環境変数が設定されていない場合はエラー
 */
export function getRequiredEnv(key: string): string {
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
 * よく使用される環境変数の一元管理
 * 遅延評価でエラーを回避
 */
export const ENV = {
  /** API サーバーのベースURL */
  get API_URL() {
    return getRequiredEnv('NEXT_PUBLIC_API_URL');
  },
  
  /** フロントエンドのベースURL */
  get FRONTEND_URL() {
    return getRequiredEnv('NEXT_PUBLIC_FRONTEND_URL');
  },
  
  /** 管理者画面のURL */
  get ADMIN_URL() {
    return getRequiredEnv('NEXT_PUBLIC_ADMIN_URL');
  },
} as const;

/**
 * 型安全性を確保するための型定義
 */
export type EnvConfig = typeof ENV;

/**
 * 開発用のヘルパー関数：環境変数の設定状況をチェック
 */
export function checkEnvConfig(): void {
  console.log('🔧 管理者FE環境変数チェック:');
  try {
    console.log('API_URL:', ENV.API_URL);
    console.log('FRONTEND_URL:', ENV.FRONTEND_URL);
    console.log('ADMIN_URL:', ENV.ADMIN_URL);
    console.log('📋 管理者FE環境変数が正常に読み込まれました');
  } catch (error) {
    console.error('❌ 管理者FE環境変数エラー:', error);
  }
}