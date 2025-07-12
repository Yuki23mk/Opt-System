// app/password-reset/[token]/page.tsx - パスワードリセット設定ページ
"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, CheckCircle, XCircle, Lock } from "lucide-react";
import Image from "next/image";

export default function PasswordResetTokenPage() {
  const router = useRouter();
  const params = useParams();
  const token = params.token as string;
  
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  // パスワード強度チェック
  const passwordChecks = {
    length: password.length >= 8,
    hasUpper: /[A-Z]/.test(password),
    hasLower: /[a-z]/.test(password),
    hasNumber: /\d/.test(password),
    match: password && confirmPassword && password === confirmPassword
  };

  const isPasswordValid = Object.values(passwordChecks).every(check => check);

  // トークンの有効性チェック（オプション：画面表示時にAPIで確認）
  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("無効なリンクです");
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!password || !confirmPassword) {
      setStatus("error");
      setMessage("パスワードと確認パスワードを入力してください");
      return;
    }

    if (!isPasswordValid) {
      setStatus("error");
      setMessage("パスワードの要件を満たしていません");
      return;
    }

    setStatus("loading");
    setMessage("");

    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL;
      const res = await fetch(`${baseUrl}/api/auth/password-reset-confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          token, 
          password, 
          confirmPassword 
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setStatus("success");
        setMessage(data.message);
      } else {
        setStatus("error");
        setMessage(data.error || "パスワードの更新に失敗しました");
      }
    } catch (error) {
      console.error("パスワードリセットエラー:", error);
      setStatus("error");
      setMessage("通信エラーが発生しました");
    }
  };

  const CheckIcon = ({ isValid }: { isValid: boolean }) => (
    isValid ? 
      <CheckCircle className="w-3 h-3 text-teal-600" /> : 
      <XCircle className="w-3 h-3 text-slate-300" />
  );

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
          />
        </div>

        {/* パスワード設定フォームエリア */}
        <div className="login-form-card">
          {/* 装飾的な背景要素 */}
          <div className="login-form-decoration-1"></div>
          <div className="login-form-decoration-2"></div>
          
          <div className="login-form-content">
            {status === "success" ? (
              // ✅ 更新完了画面
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <div className="w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-7 h-7 text-teal-600" />
                  </div>
                </div>
                
                <div>
                  <h1 className="text-lg font-semibold text-slate-800 mb-2">パスワード更新完了</h1>
                  <p className="text-slate-600 text-sm mb-3">{message}</p>
                </div>

                <button 
                  className="login-button"
                  onClick={() => router.push('/login')}
                >
                  ログイン画面へ
                </button>
              </div>
            ) : (
              // ✅ パスワード設定フォーム
              <form onSubmit={handleSubmit} className="login-form-space">
                <div className="text-center mb-4">
                  <div className="flex justify-center mb-3">
                    <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
                      <Lock className="w-5 h-5 text-slate-600" />
                    </div>
                  </div>
                  <h1 className="text-lg font-semibold text-slate-800 mb-1">新しいパスワード設定</h1>
                  <p className="text-slate-600 text-xs">安全な新しいパスワードを入力してください</p>
                </div>

                {/* エラーメッセージ */}
                {status === "error" && message && (
                  <div className="login-error">
                    <p className="login-error-text">{message}</p>
                  </div>
                )}

                {/* 新しいパスワード */}
                <div className="login-input-group">
                  <label className="login-label">
                    新しいパスワード
                  </label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="login-input pr-9"
                      disabled={status === "loading"}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* パスワード確認 */}
                <div className="login-input-group">
                  <label className="login-label">
                    パスワード確認
                  </label>
                  <div className="relative">
                    <Input
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="login-input pr-9"
                      disabled={status === "loading"}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* パスワード要件チェック */}
                {password && (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                    <p className="text-xs font-medium text-slate-700 mb-2">パスワード要件:</p>
                    <div className="space-y-1 text-xs">
                      <div className="flex items-center gap-1.5">
                        <CheckIcon isValid={passwordChecks.length} />
                        <span className={passwordChecks.length ? "text-teal-700" : "text-slate-500"}>
                          8文字以上
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CheckIcon isValid={passwordChecks.hasUpper} />
                        <span className={passwordChecks.hasUpper ? "text-teal-700" : "text-slate-500"}>
                          大文字を含む
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CheckIcon isValid={passwordChecks.hasLower} />
                        <span className={passwordChecks.hasLower ? "text-teal-700" : "text-slate-500"}>
                          小文字を含む
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CheckIcon isValid={passwordChecks.hasNumber} />
                        <span className={passwordChecks.hasNumber ? "text-teal-700" : "text-slate-500"}>
                          数字を含む
                        </span>
                      </div>
                      {confirmPassword && (
                        <div className="flex items-center gap-1.5">
                          <CheckIcon isValid={passwordChecks.match} />
                          <span className={passwordChecks.match ? "text-teal-700" : "text-red-500"}>
                            パスワードが一致
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 更新ボタン */}
                <button 
                  type="submit" 
                  className="login-button" 
                  disabled={status === "loading" || !isPasswordValid}
                >
                  {status === "loading" ? "更新中..." : "パスワードを更新"}
                </button>

                {/* 戻るリンク */}
                <p className="text-center text-xs">
                  <button 
                    type="button" 
                    className="text-slate-500 hover:text-slate-700 hover:underline" 
                    onClick={() => router.push('/login')}
                  >
                    ログイン画面に戻る
                  </button>
                </p>
              </form>
            )}
          </div>
        </div>
        
        {/* フッター */}
        <div className="login-footer">
          <p>© 2025 Opt. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}