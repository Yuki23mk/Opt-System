/**
 * ファイルパス: optioil-admin/app/password-reset-request/page.tsx
 * 管理者パスワードリセット申請画面
 */

"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

// 型定義
interface ResetRequestResponse {
  success?: boolean;
  message?: string;
  error?: string;
}

export default function AdminPasswordResetRequestPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState("");
  
  const router = useRouter();

  // メールアドレスの基本バリデーション
  const isValidEmail = useCallback((email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }, []);

  // API URL取得（環境変数またはデフォルト）
  const getApiUrl = useCallback(() => {
    return process.env.NEXT_PUBLIC_API_URL ;
  }, []);

  // パスワードリセット申請の送信
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) {
      setError("メールアドレスを入力してください");
      return;
    }

    if (!isValidEmail(email.trim())) {
      setError("有効なメールアドレスを入力してください");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const apiUrl = getApiUrl();
      console.log('📧 パスワードリセット申請:', { email: email.trim(), apiUrl });

      const response = await fetch(`${apiUrl}/api/admin/auth/password-reset-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          email: email.trim() 
        }),
      });

      const data: ResetRequestResponse = await response.json();
      console.log('📄 リセット申請レスポンス:', { status: response.status, data });

      if (response.ok) {
        setIsSuccess(true);
        console.log('✅ パスワードリセット申請成功');
      } else {
        setError(data.error || 'パスワードリセット申請に失敗しました');
      }
    } catch (error) {
      console.error('❌ パスワードリセット申請エラー:', error);
      setError('ネットワークエラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  }, [email, isValidEmail, getApiUrl]);

  // 入力ハンドラー
  const handleEmailChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    if (error) setError(""); // エラーをクリア
  }, [error]);

  // ログイン画面に戻る
  const handleBackToLogin = useCallback(() => {
    router.push('/login');
  }, [router]);

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
              メール送信完了
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              パスワードリセット用のメールを送信しました
            </p>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <h3 className="text-lg font-medium text-green-800 mb-2">
              📧 {email} 宛に送信しました
            </h3>
            <div className="text-sm text-green-700 space-y-2">
              <p>• メールに記載されたリンクをクリックしてください</p>
              <p>• リンクの有効期限は <strong>1時間</strong> です</p>
              <p>• メールが届かない場合は、迷惑メールフォルダもご確認ください</p>
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={handleBackToLogin}
              className="w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-[#115e59] hover:bg-[#0f766e] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#115e59]"
            >
              ログイン画面に戻る
            </button>
            
            <button
              onClick={() => {
                setIsSuccess(false);
                setEmail("");
              }}
              className="w-full text-sm text-[#115e59] hover:text-[#0f766e]"
            >
              別のメールアドレスで再申請
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 申請フォーム画面
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="mx-auto h-16 w-16 bg-[#115e59] rounded-full flex items-center justify-center">
            <span className="text-white font-bold text-2xl">🔑</span>
          </div>
          <h2 className="mt-6 text-center text-3xl font-bold text-gray-900">
            パスワードリセット
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            登録されたメールアドレスにリセット用のリンクを送信します
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              メールアドレス
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              value={email}
              onChange={handleEmailChange}
              className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-[#115e59] focus:border-[#115e59] focus:z-10 sm:text-sm"
              placeholder="admin@example.com"
              autoComplete="email"
            />
            <p className="mt-1 text-xs text-gray-500">
              管理者アカウントに登録されたメールアドレスを入力してください
            </p>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading || !email.trim() || !isValidEmail(email.trim())}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-[#115e59] hover:bg-[#0f766e] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#115e59] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  送信中...
                </div>
              ) : (
                '📧 リセットメールを送信'
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

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <span className="text-yellow-400 text-xl">⚠️</span>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">
                ご注意
              </h3>
              <div className="mt-2 text-sm text-yellow-700">
                <ul className="list-disc list-inside space-y-1">
                  <li>リセットリンクの有効期限は1時間です</li>
                  <li>セキュリティのため、存在しないメールアドレスでも成功レスポンスを返します</li>
                  <li>メールが届かない場合は、管理者にお問い合わせください</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}