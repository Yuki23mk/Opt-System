/**
 * ファイルパス: optioil-admin/app/password-reset/[token]/page.tsx
 * 管理者パスワードリセット実行画面（トークンベース）
 */

"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

// 型定義
interface ResetExecuteResponse {
  success?: boolean;
  message?: string;
  error?: string;
}

interface TokenValidationResponse {
  valid?: boolean;
  error?: string;
  adminEmail?: string;
}

export default function AdminPasswordResetExecutePage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isValidatingToken, setIsValidatingToken] = useState(true);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState("");
  const [tokenValid, setTokenValid] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");

  // パスワード強度チェック
  const getPasswordStrength = useCallback((password: string) => {
    const checks = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /\d/.test(password),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
    };

    const score = Object.values(checks).filter(Boolean).length;
    
    return {
      score,
      checks,
      level: score <= 2 ? 'weak' : score <= 4 ? 'medium' : 'strong',
    };
  }, []);

  // API URL取得
  const getApiUrl = useCallback(() => {
    return process.env.NEXT_PUBLIC_API_URL ;
  }, []);

  // トークンの有効性確認
  const validateToken = useCallback(async () => {
    if (!token) {
      setError("無効なリセットリンクです");
      setIsValidatingToken(false);
      return;
    }

    try {
      const apiUrl = getApiUrl();
      console.log('🔍 トークン検証:', { token: token.substring(0, 10) + '...', apiUrl });

      const response = await fetch(`${apiUrl}/api/admin/auth/password-reset-execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          token,
          validateOnly: true // 検証のみのフラグ
        }),
      });

      const data: TokenValidationResponse = await response.json();
      console.log('📄 トークン検証レスポンス:', { status: response.status, data });

      if (response.ok && data.valid) {
        setTokenValid(true);
        setAdminEmail(data.adminEmail || '');
        console.log('✅ トークン有効');
      } else {
        setError(data.error || 'リセットリンクが無効または期限切れです');
      }
    } catch (error) {
      console.error('❌ トークン検証エラー:', error);
      setError('ネットワークエラーが発生しました');
    } finally {
      setIsValidatingToken(false);
    }
  }, [token, getApiUrl]);

  // 初回読み込み時のトークン検証
  useEffect(() => {
    validateToken();
  }, [validateToken]);

  // パスワードリセット実行
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password || !confirmPassword) {
      setError("全ての項目を入力してください");
      return;
    }

    if (password !== confirmPassword) {
      setError("パスワードが一致しません");
      return;
    }

    const strength = getPasswordStrength(password);
    if (strength.score < 3) {
      setError("パスワードがあまりに弱すぎます。より強力なパスワードを設定してください");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const apiUrl = getApiUrl();
      console.log('🔐 パスワードリセット実行:', { 
        token: token.substring(0, 10) + '...', 
        apiUrl 
      });

      const response = await fetch(`${apiUrl}/api/admin/auth/password-reset-execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          token,
          newPassword: password
        }),
      });

      const data: ResetExecuteResponse = await response.json();
      console.log('📄 パスワードリセットレスポンス:', { status: response.status, data });

      if (response.ok) {
        setIsSuccess(true);
        console.log('✅ パスワードリセット成功');
      } else {
        setError(data.error || 'パスワードリセットに失敗しました');
      }
    } catch (error) {
      console.error('❌ パスワードリセットエラー:', error);
      setError('ネットワークエラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  }, [password, confirmPassword, token, getPasswordStrength, getApiUrl]);

  // 入力ハンドラー
  const handlePasswordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    if (error) setError("");
  }, [error]);

  const handleConfirmPasswordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setConfirmPassword(e.target.value);
    if (error) setError("");
  }, [error]);

  // ログイン画面に戻る
  const handleBackToLogin = useCallback(() => {
    router.push('/login');
  }, [router]);

  const passwordStrength = getPasswordStrength(password);

  // トークン検証中
  if (isValidatingToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full space-y-8 text-center">
          <div className="mx-auto h-16 w-16 bg-[#115e59] rounded-full flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
          </div>
          <h2 className="text-2xl font-bold text-gray-900">
            リセットリンクを確認中...
          </h2>
        </div>
      </div>
    );
  }

  // トークン無効
  if (!tokenValid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="mx-auto h-16 w-16 bg-red-100 rounded-full flex items-center justify-center">
              <span className="text-red-600 text-2xl">❌</span>
            </div>
            <h2 className="mt-6 text-center text-3xl font-bold text-gray-900">
              無効なリンク
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              リセットリンクが無効または期限切れです
            </p>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="text-sm text-red-700">
              <p className="font-medium mb-2">考えられる原因:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>リンクの有効期限（1時間）が切れている</li>
                <li>すでに使用済みのリンクです</li>
                <li>URLが正しくコピーされていない</li>
              </ul>
            </div>
          </div>

          <div className="space-y-3">
            <Link
              href="/password-reset-request"
              className="w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-[#115e59] hover:bg-[#0f766e] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#115e59]"
            >
              新しいリセットリンクを申請
            </Link>
            
            <button
              onClick={handleBackToLogin}
              className="w-full text-sm text-[#115e59] hover:text-[#0f766e]"
            >
              ログイン画面に戻る
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 成功画面
  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="mx-auto h-16 w-16 bg-green-100 rounded-full flex items-center justify-center">
              <span className="text-green-600 text-2xl">✅</span>
            </div>
            <h2 className="mt-6 text-center text-3xl font-bold text-gray-900">
              パスワード変更完了
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              新しいパスワードが設定されました
            </p>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <h3 className="text-lg font-medium text-green-800 mb-2">
              🔐 パスワードが正常に更新されました
            </h3>
            <div className="text-sm text-green-700 space-y-2">
              <p>• 新しいパスワードでログインできます</p>
              <p>• セキュリティのため、他のデバイスからは再ログインが必要です</p>
              <p>• 定期的なパスワード変更をお勧めします</p>
            </div>
          </div>

          <button
            onClick={handleBackToLogin}
            className="w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-[#115e59] hover:bg-[#0f766e] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#115e59]"
          >
            ログイン画面に移動
          </button>
        </div>
      </div>
    );
  }

  // パスワード設定フォーム
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="mx-auto h-16 w-16 bg-[#115e59] rounded-full flex items-center justify-center">
            <span className="text-white font-bold text-2xl">🔐</span>
          </div>
          <h2 className="mt-6 text-center text-3xl font-bold text-gray-900">
            新しいパスワード設定
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {adminEmail && `${adminEmail} の`}新しいパスワードを設定してください
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                新しいパスワード
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                value={password}
                onChange={handlePasswordChange}
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-[#115e59] focus:border-[#115e59] focus:z-10 sm:text-sm"
                placeholder="新しいパスワード"
              />
              
              {/* パスワード強度インジケーター */}
              {password && (
                <div className="mt-2">
                  <div className="text-xs text-gray-600 mb-1">パスワード強度:</div>
                  <div className="flex space-x-1 mb-2">
                    <div className={`h-1 w-1/3 rounded ${passwordStrength.level === 'weak' ? 'bg-red-400' : passwordStrength.level === 'medium' ? 'bg-yellow-400' : 'bg-green-400'}`}></div>
                    <div className={`h-1 w-1/3 rounded ${passwordStrength.level === 'medium' || passwordStrength.level === 'strong' ? 'bg-yellow-400' : 'bg-gray-200'}`}></div>
                    <div className={`h-1 w-1/3 rounded ${passwordStrength.level === 'strong' ? 'bg-green-400' : 'bg-gray-200'}`}></div>
                  </div>
                  <div className="text-xs space-y-1">
                    <div className={passwordStrength.checks.length ? 'text-green-600' : 'text-gray-400'}>
                      ✓ 8文字以上
                    </div>
                    <div className={passwordStrength.checks.uppercase ? 'text-green-600' : 'text-gray-400'}>
                      ✓ 大文字を含む
                    </div>
                    <div className={passwordStrength.checks.lowercase ? 'text-green-600' : 'text-gray-400'}>
                      ✓ 小文字を含む
                    </div>
                    <div className={passwordStrength.checks.number ? 'text-green-600' : 'text-gray-400'}>
                      ✓ 数字を含む
                    </div>
                    <div className={passwordStrength.checks.special ? 'text-green-600' : 'text-gray-400'}>
                      ✓ 特殊文字を含む
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                パスワード確認
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                value={confirmPassword}
                onChange={handleConfirmPasswordChange}
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-[#115e59] focus:border-[#115e59] focus:z-10 sm:text-sm"
                placeholder="パスワードを再入力"
              />
              {confirmPassword && password !== confirmPassword && (
                <p className="mt-1 text-xs text-red-600">
                  パスワードが一致しません
                </p>
              )}
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading || !password || !confirmPassword || password !== confirmPassword || passwordStrength.score < 3}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-[#115e59] hover:bg-[#0f766e] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#115e59] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  更新中...
                </div>
              ) : (
                '🔐 パスワードを更新'
              )}
            </button>
          </div>

          <div className="text-center">
            <Link
              href="/login"
              className="text-sm text-[#115e59] hover:text-[#0f766e] font-medium"
            >
              ← ログイン画面に戻る
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}