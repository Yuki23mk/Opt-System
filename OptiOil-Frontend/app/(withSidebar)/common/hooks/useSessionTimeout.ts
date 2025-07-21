/**
 * ファイルパス: app/(withSidebar)/common/hooks/useSessionTimeout.ts
 * セッションタイムアウトチェック用フック
 */

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ENV } from '@/lib/env';

const CHECK_INTERVAL = 5 * 60 * 1000; // 5分ごとにチェック
const WARNING_TIME = 5 * 60 * 1000;   // 期限切れ5分前

export function useSessionTimeout() {
  const router = useRouter();

  const checkTokenExpiry = useCallback(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      // JWTをデコード（ライブラリを使わない簡易版）
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expiryTime = payload.exp * 1000; // expはUNIXタイムスタンプ（秒）
      const currentTime = Date.now();

      // 期限切れまで5分以内の場合は警告
      if (expiryTime - currentTime < WARNING_TIME) {
        console.log('⏰ セッション期限が近づいています');
        
        // 期限切れの場合
        if (currentTime >= expiryTime) {
          console.log('⏰ セッション期限切れ - ログアウト処理実行');
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          router.push('/login?expired=true');
        }
      }
    } catch (error) {
      console.error('トークンチェックエラー:', error);
    }
  }, [router]);

  useEffect(() => {
    // 初回チェック
    checkTokenExpiry();

    // 定期チェック
    const interval = setInterval(checkTokenExpiry, CHECK_INTERVAL);

    // ページ表示時にもチェック
    const handleFocus = () => checkTokenExpiry();
    window.addEventListener('focus', handleFocus);

    // ページ表示/非表示の切り替わり時にもチェック
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        checkTokenExpiry();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [checkTokenExpiry]);
}