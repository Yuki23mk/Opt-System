/**
 * ファイルパス: app/mfa-login/page.tsx
 * MFAログインページ - 修正版（既存機能完全保持 + 改善）
 */

"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Shield, ArrowLeft, Key } from "lucide-react";
import Image from "next/image";
import { ENV } from "@/lib/env";

// MFAコンポーネントを分離してSuspense境界を適用
function MFALoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [mfaCode, setMfaCode] = useState("");
  const [backupCode, setBackupCode] = useState("");
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [tempToken, setTempToken] = useState<string | null>(null);

  useEffect(() => {
    // URLパラメータから一時トークンを取得
    const token = searchParams.get("tempToken");
    if (!token) {
      // 一時トークンがない場合はログインページにリダイレクト
      router.push("/login");
      return;
    }
    setTempToken(token);
  }, [searchParams, router]);

  const handleMFAVerify = async () => {
    setError("");
    
    if (!tempToken) {
      setError("セッションが無効です。ログインし直してください。");
      return;
    }

    if (!useBackupCode && (!mfaCode || mfaCode.length !== 6)) {
      setError("6桁の認証コードを入力してください");
      return;
    }

    if (useBackupCode && !backupCode.trim()) {
      setError("バックアップコードを入力してください");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${ENV.API_URL}/api/users/mfa/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tempToken,
          mfaCode: useBackupCode ? undefined : mfaCode,
          backupCode: useBackupCode ? backupCode.trim() : undefined,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        // 正式なトークンを保存
        localStorage.setItem("token", data.token);
        document.cookie = `token=${data.token}; path=/; SameSite=Lax`;

        // バックアップコードを使用した場合の警告
        if (data.usedBackupCode) {
          // ここでトーストやアラートを表示することもできます
          console.log("バックアップコードが使用されました");
        }

        // メインページにリダイレクト
        router.push("/products");
      } else {
        setError(data.message || "認証に失敗しました");
      }
    } catch (err) {
      console.error("MFA認証エラー:", err);
      setError("通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLogin = () => {
    router.push("/login");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleMFAVerify();
    }
  };

  if (!tempToken) {
    return (
      <div 
        className="min-h-screen bg-cover bg-center bg-no-repeat flex items-center justify-center"
        style={{ backgroundImage: "url('/dark-teal-background-upscale.png')" }}
      >
        <div className="text-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-500 mx-auto mb-3"></div>
          <p className="text-white text-sm">認証情報を確認しています...</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen bg-cover bg-center bg-no-repeat flex items-center justify-center"
      style={{ backgroundImage: "url('/dark-teal-background-upscale.png')" }}
    >
      <div className="login-container">
        {/* Opt. ロゴ */}
        <div className="login-logo">
          <Image 
            src="/opt-logo-white.png" 
            alt="Opt. Logo" 
            width={180} 
            height={72} 
            className="object-contain"
            priority
          />
        </div>

        {/* MFA認証フォームエリア */}
        <div className="login-form-card">
          {/* 装飾的な背景要素 */}
          <div className="login-form-decoration-1"></div>
          <div className="login-form-decoration-2"></div>
          
          <div className="login-form-content">
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                handleMFAVerify();
              }}
              className="login-form-space"
            >
              {/* ヘッダー */}
              <div className="text-center">
                <div className="w-12 h-12 bg-teal-100 rounded-full mx-auto mb-3 flex items-center justify-center">
                  <Shield className="w-6 h-6 text-teal-600" aria-hidden="true" />
                </div>
                <h1 className="text-lg font-semibold text-slate-800 mb-1">多要素認証</h1>
                <p className="text-slate-600 text-xs">
                  認証アプリに表示される6桁のコードを入力してください
                </p>
              </div>

              {/* エラーメッセージ */}
              {error && (
                <div className="login-error" role="alert" aria-live="polite">
                  <p className="login-error-text">{error}</p>
                </div>
              )}

              {/* MFAコード入力 */}
              {!useBackupCode ? (
                <div className="space-y-3">
                  <div className="login-input-group">
                    <label htmlFor="mfa-code" className="login-label">
                      認証コード
                    </label>
                    <Input
                      id="mfa-code"
                      type="text"
                      value={mfaCode}
                      onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      onKeyPress={handleKeyPress}
                      placeholder="123456"
                      className="login-input text-center text-lg tracking-widest font-mono"
                      maxLength={6}
                      disabled={loading}
                      aria-describedby="mfa-code-help"
                      aria-label="6桁の認証コード"
                      autoComplete="one-time-code"
                    />
                    <p id="mfa-code-help" className="text-xs text-slate-500 mt-1">
                      Google Authenticator等のアプリに表示されるコード
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || mfaCode.length !== 6}
                    className="login-button"
                    aria-describedby={loading ? "loading-message" : undefined}
                  >
                    {loading ? "認証中..." : "ログイン"}
                    {loading && <span id="loading-message" className="sr-only">認証処理中です</span>}
                  </button>
                </div>
              ) : (
                /* バックアップコード入力 */
                <div className="space-y-3">
                  <div className="login-input-group">
                    <label htmlFor="backup-code" className="login-label flex items-center gap-1.5">
                      <Key className="w-3 h-3" aria-hidden="true" />
                      バックアップコード
                    </label>
                    <Input
                      id="backup-code"
                      type="text"
                      value={backupCode}
                      onChange={(e) => setBackupCode(e.target.value.toUpperCase())}
                      onKeyPress={handleKeyPress}
                      placeholder="XXXXXXXX"
                      className="login-input text-center text-lg tracking-wider font-mono"
                      disabled={loading}
                      aria-describedby="backup-code-help"
                      aria-label="8文字のバックアップコード"
                      autoComplete="one-time-code"
                    />
                    <p id="backup-code-help" className="text-xs text-slate-500 mt-1">
                      8文字の英数字コード（保存済みのバックアップコード）
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !backupCode.trim()}
                    className="login-button"
                    aria-describedby={loading ? "loading-message" : undefined}
                  >
                    {loading ? "認証中..." : "バックアップコードでログイン"}
                  </button>
                </div>
              )}

              {/* 切り替えオプション */}
              <div className="text-center space-y-2">
                <Button
                  type="button"
                  variant="link"
                  onClick={() => setUseBackupCode(!useBackupCode)}
                  disabled={loading}
                  className="text-xs text-slate-600 hover:text-slate-800"
                  aria-label={useBackupCode 
                    ? "認証アプリのコードを使用する" 
                    : "バックアップコードを使用する"
                  }
                >
                  {useBackupCode 
                    ? "認証アプリのコードを使用" 
                    : "バックアップコードを使用"
                  }
                </Button>

                <div className="border-t border-slate-200 pt-2">
                  <button
                    type="button"
                    onClick={handleBackToLogin}
                    disabled={loading}
                    className="login-button-secondary flex items-center justify-center gap-1"
                    aria-label="ログインページに戻る"
                  >
                    <ArrowLeft className="w-3 h-3" aria-hidden="true" />
                    ログインページに戻る
                  </button>
                </div>
              </div>

              {/* セキュリティ注意事項 */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3" role="region" aria-labelledby="security-info">
                <h4 id="security-info" className="text-xs font-medium text-slate-800 mb-1">セキュリティについて</h4>
                <ul className="text-xs text-slate-600 space-y-0.5">
                  <li>• 認証コードは30秒ごとに変更されます</li>
                  <li>• バックアップコードは一度しか使用できません</li>
                  <li>• 認証アプリを紛失した場合は管理者にお問い合わせください</li>
                </ul>
              </div>
            </form>
          </div>
        </div>
        
        {/* フッター */}
        <div className="login-footer">
          <p>© 2025 有限会社丸一機料商会 All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}

// ローディングコンポーネント
function MFALoginLoading() {
  return (
    <div 
      className="min-h-screen bg-cover bg-center bg-no-repeat flex items-center justify-center"
      style={{ backgroundImage: "url('/dark-teal-background-upscale.png')" }}
    >
      <div className="text-center">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-500 mx-auto mb-3"></div>
        <p className="text-white text-sm">ページを読み込んでいます...</p>
      </div>
    </div>
  );
}

// メインコンポーネント（Suspense境界適用）
export default function MFALoginPage() {
  return (
    <Suspense fallback={<MFALoginLoading />}>
      <MFALoginContent />
    </Suspense>
  );
}