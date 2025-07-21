/**
 * ファイルパス: optioil-admin/app/(auth)/login/page.tsx
 * セキュリティ強化版管理者ログインページ（根本修正版）
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ENV, checkEnvConfig } from '@/lib/env';

// 型定義
interface LoginResponse {
  requiresMultiFactor?: boolean;
  adminId?: number;
  token?: string;
  error?: string;
}

interface MfaResponse {
  token?: string;
  warning?: string;
  alert?: string;
  error?: string;
}

interface SetupStatusResponse {
  isFirstTimeSetup: boolean;
  error?: string;
}

interface CreateAdminResponse {
  success?: boolean;
  error?: string;
}

export default function AdminLoginPage() {
  const [step, setStep] = useState<'login' | 'mfa'>('login');
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [backupCode, setBackupCode] = useState("");
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [adminId, setAdminId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  
  // 初回セットアップ用のみ
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isFirstTimeSetup, setIsFirstTimeSetup] = useState<boolean | null>(null);
  
  // APIベースURL取得用
  const [apiUrl, setApiUrl] = useState('');
  
  // 初回セットアップ用フォーム
  const [newAdmin, setNewAdmin] = useState({
    username: "",
    email: "",
    password: ""
  });

  const router = useRouter();

  // ✅ 修正: useCallbackで関数をメモ化し、依存関係を明確化
  const checkFirstTimeSetupWithUrl = useCallback(async (targetApiUrl: string) => {
    try {
      const response = await fetch(`${targetApiUrl}/api/admin/auth/setup-status`);
      const data: SetupStatusResponse = await response.json();
      
      if (response.ok) {
        setIsFirstTimeSetup(data.isFirstTimeSetup);
      } else {
        console.error('セットアップ状態確認エラー:', data.error);
        setIsFirstTimeSetup(false);
      }
    } catch (error: unknown) {
      console.error('初回セットアップチェックエラー:', error);
      setIsFirstTimeSetup(false);
    }
  }, []); // 依存関係なし（パラメータで渡されるため）

  // ✅ 修正: getApiUrlをuseCallbackでメモ化
  const getApiUrl = useCallback(() => {
    return apiUrl || 'http://localhost:3001';
  }, [apiUrl]);

  // ✅ 修正: useEffectの依存関係を適切に設定
  useEffect(() => {
    const initializeApp = async () => {
      try {
        checkEnvConfig();
        const url = ENV.API_URL;
        setApiUrl(url);
        
        // API URL設定後にセットアップ状態確認
        await checkFirstTimeSetupWithUrl(url);
      } catch (error) {
        console.error('環境変数読み込みエラー:', error);
        const fallbackUrl = 'http://localhost:3001';
        setApiUrl(fallbackUrl);
        await checkFirstTimeSetupWithUrl(fallbackUrl);
      }
    };
    
    initializeApp();
  }, [checkFirstTimeSetupWithUrl]); // ✅ 依存関係に追加

  // ✅ 修正: handleLoginをuseCallbackでメモ化
  const handleLogin = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const currentApiUrl = getApiUrl();
      console.log('🔐 管理者ログイン試行:', { username, apiUrl: currentApiUrl });

      const response = await fetch(`${currentApiUrl}/api/admin/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data: LoginResponse = await response.json();
      console.log('📄 ログインレスポンス:', { status: response.status, data });

      if (response.ok) {
        if (data.requiresMultiFactor) {
          setAdminId(data.adminId || null);
          setStep('mfa');
          console.log('🔐 MFA認証ステップへ移行');
        } else {
          localStorage.setItem("adminToken", data.token || '');
          console.log('✅ 管理者トークン保存完了');
          router.push('/dashboard');
        }
      } else {
        setError(data.error || 'ログインに失敗しました');
      }
    } catch (error) {
      console.error('❌ ログインエラー:', error);
      setError('ネットワークエラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  }, [username, password, getApiUrl, router]); // ✅ 依存関係を明確化

  // ✅ 修正: handleMfaVerificationをuseCallbackでメモ化
  const handleMfaVerification = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const currentApiUrl = getApiUrl();
      console.log('🔐 MFA認証試行:', { adminId, useBackupCode });

      const requestBody: Record<string, unknown> = { adminId };
      
      if (useBackupCode) {
        requestBody.backupCode = backupCode;
      } else {
        requestBody.token = mfaCode;
      }

      const response = await fetch(`${currentApiUrl}/api/admin/auth/mfa/login-verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const data: MfaResponse = await response.json();
      console.log('📄 MFA認証レスポンス:', { status: response.status, data });

      if (response.ok) {
        localStorage.setItem("adminToken", data.token || '');
        console.log('✅ MFA認証成功・トークン保存完了');
        
        if (data.warning) {
          alert(`⚠️ ${data.warning}`);
        }
        if (data.alert) {
          alert(`🚨 ${data.alert}`);
        }
        
        router.push('/dashboard');
      } else {
        setError(data.error || 'MFA認証に失敗しました');
      }
    } catch (error) {
      console.error('❌ MFA認証エラー:', error);
      setError('ネットワークエラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  }, [adminId, useBackupCode, backupCode, mfaCode, getApiUrl, router]); // ✅ 依存関係を明確化

  // ✅ 修正: handleBackToLoginをuseCallbackでメモ化
  const handleBackToLogin = useCallback(() => {
    setStep('login');
    setMfaCode("");
    setBackupCode("");
    setUseBackupCode(false);
    setAdminId(null);
    setError("");
  }, []); // 依存関係なし（状態の更新のみ）

  // ✅ 修正: handleCreateFirstAdminをuseCallbackでメモ化
  const handleCreateFirstAdmin = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const currentApiUrl = getApiUrl();
      console.log('👤 初回管理者作成試行:', { 
        username: newAdmin.username, 
        apiUrl: currentApiUrl
      });

      const response = await fetch(`${currentApiUrl}/api/admin/auth/create-admin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newAdmin),
      });

      const data: CreateAdminResponse = await response.json();
      console.log('📄 管理者作成レスポンス:', { status: response.status, data });

      if (response.ok) {
        alert(`初回管理者アカウントを作成しました！\nユーザー名: ${newAdmin.username}\nパスワード: ${newAdmin.password}`);
        setNewAdmin({ username: "", email: "", password: "" });
        setShowCreateModal(false);
        setIsFirstTimeSetup(false);
        // セットアップ状態を再確認
        const currentUrl = getApiUrl();
        await checkFirstTimeSetupWithUrl(currentUrl);
      } else {
        setError(data.error || '管理者作成に失敗しました');
      }
    } catch (error) {
      console.error('❌ 管理者作成エラー:', error);
      setError('ネットワークエラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  }, [newAdmin, getApiUrl, checkFirstTimeSetupWithUrl]); // ✅ 依存関係を明確化

  // ✅ 修正: 入力ハンドラーをuseCallbackでメモ化
  const handleUsernameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setUsername(e.target.value);
  }, []);

  const handlePasswordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
  }, []);

  const handleMfaCodeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setMfaCode(e.target.value.replace(/\D/g, ''));
  }, []);

  const handleBackupCodeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setBackupCode(e.target.value.toUpperCase());
  }, []);

  const toggleBackupCode = useCallback(() => {
    setUseBackupCode(!useBackupCode);
  }, [useBackupCode]);

  const handleNewAdminChange = useCallback((field: keyof typeof newAdmin) => 
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setNewAdmin(prev => ({
        ...prev,
        [field]: e.target.value
      }));
    }, []
  );

  const closeCreateModal = useCallback(() => {
    setShowCreateModal(false);
  }, []);

  const openCreateModal = useCallback(() => {
    setShowCreateModal(true);
  }, []);

  // MFA認証画面
  if (step === 'mfa') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full space-y-8">
          <div>
            <div className="mx-auto h-12 w-12 bg-[#115e59] rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">🔐</span>
            </div>
            <h2 className="mt-6 text-center text-3xl font-bold text-gray-900">
              MFA認証
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              {username} でログイン中
            </p>
          </div>

          <form className="mt-8 space-y-6" onSubmit={handleMfaVerification}>
            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            <div className="space-y-4">
              {!useBackupCode ? (
                <div>
                  <label htmlFor="mfaCode" className="block text-sm font-medium text-gray-700">
                    認証アプリの6桁コード
                  </label>
                  <input
                    id="mfaCode"
                    name="mfaCode"
                    type="text"
                    required
                    maxLength={6}
                    value={mfaCode}
                    onChange={handleMfaCodeChange}
                    className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-[#115e59] focus:border-[#115e59] focus:z-10 sm:text-sm text-center text-lg font-mono"
                    placeholder="000000"
                    autoComplete="one-time-code"
                  />
                </div>
              ) : (
                <div>
                  <label htmlFor="backupCode" className="block text-sm font-medium text-gray-700">
                    バックアップコード
                  </label>
                  <input
                    id="backupCode"
                    name="backupCode"
                    type="text"
                    required
                    value={backupCode}
                    onChange={handleBackupCodeChange}
                    className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-[#115e59] focus:border-[#115e59] focus:z-10 sm:text-sm text-center font-mono"
                    placeholder="XXXX-XXXX"
                  />
                </div>
              )}
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading || (!useBackupCode && mfaCode.length !== 6) || (useBackupCode && !backupCode)}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-[#115e59] hover:bg-[#0f766e] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#115e59] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    認証中...
                  </div>
                ) : (
                  'ログイン'
                )}
              </button>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={toggleBackupCode}
                className="w-full text-sm text-[#115e59] hover:text-[#0f766e]"
              >
                {useBackupCode ? '🔒 認証アプリを使用' : '🔑 バックアップコードを使用'}
              </button>
              
              <button
                type="button"
                onClick={handleBackToLogin}
                className="w-full text-sm text-gray-600 hover:text-gray-500"
              >
                ← ログイン画面に戻る
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // 通常のログイン画面
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="mx-auto h-16 w-16 bg-[#115e59] rounded-full flex items-center justify-center">
            <span className="text-white font-bold text-2xl">O</span>
          </div>
          <h2 className="mt-6 text-center text-3xl font-bold text-gray-900">
            Opt. 管理者ログイン
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            管理者アカウントでログインしてください
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                ユーザー名
              </label>
              <input
                id="username"
                name="username"
                type="text"
                required
                value={username}
                onChange={handleUsernameChange}
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-[#115e59] focus:border-[#115e59] focus:z-10 sm:text-sm"
                placeholder="管理者ユーザー名"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                パスワード
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                value={password}
                onChange={handlePasswordChange}
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-[#115e59] focus:border-[#115e59] focus:z-10 sm:text-sm"
                placeholder="パスワード"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-[#115e59] hover:bg-[#0f766e] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#115e59] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  処理中...
                </div>
              ) : (
                'ログイン'
              )}
            </button>
          </div>

          {/* 管理者ログインページに追加 */}
          <a href="/password-reset-request">
            パスワードを忘れた場合
          </a>

          {/* 🔒 セキュリティ強化: 初回セットアップ時のみ表示 */}
          <div className="space-y-2">
            {isFirstTimeSetup && (
              <button
                type="button"
                onClick={openCreateModal}
                className="w-full flex justify-center py-2 px-4 border border-green-300 text-sm font-medium rounded-md text-green-700 bg-green-50 hover:bg-green-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                👤 初回管理者アカウントを作成 ⭐
              </button>
            )}
          </div>
       </form>
      </div>

      {/* 初回管理者作成モーダル（初回セットアップ時のみ） */}
      {showCreateModal && isFirstTimeSetup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">
              初回管理者アカウントを作成
            </h3>
            <form onSubmit={handleCreateFirstAdmin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">ユーザー名</label>
                <input
                  type="text"
                  required
                  value={newAdmin.username}
                  onChange={handleNewAdminChange('username')}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-[#115e59] focus:border-[#115e59]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">メールアドレス</label>
                <input
                  type="email"
                  required
                  value={newAdmin.email}
                  onChange={handleNewAdminChange('email')}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-[#115e59] focus:border-[#115e59]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">パスワード</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newAdmin.password}
                  onChange={handleNewAdminChange('password')}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-[#115e59] focus:border-[#115e59]"
                />
              </div>
              <div className="flex gap-2 pt-4">
                <button
                  type="button"
                  onClick={closeCreateModal}
                  className="flex-1 py-2 px-4 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 py-2 px-4 bg-[#115e59] text-white rounded-md hover:bg-[#0f766e] disabled:opacity-50"
                >
                  作成
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}