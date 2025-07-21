// app/password-reset/page.tsx - パスワードリセット申請ページ（ログイン時）
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Mail, CheckCircle } from "lucide-react";
import Image from "next/image";

export default function PasswordResetPage() {
  const router = useRouter();
  
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      setStatus("error");
      setMessage("メールアドレスを入力してください");
      return;
    }

    // メールアドレス形式チェック
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setStatus("error");
      setMessage("正しいメールアドレスを入力してください");
      return;
    }

    setStatus("loading");
    setMessage("");

    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL;
      const res = await fetch(`${baseUrl}/api/auth/password-reset-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (res.ok) {
        setStatus("success");
        setMessage(data.message);
      } else {
        setStatus("error");
        setMessage(data.error || "送信に失敗しました");
      }
    } catch (error) {
      console.error("パスワードリセット申請エラー:", error);
      setStatus("error");
      setMessage("通信エラーが発生しました");
    }
  };

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

        {/* パスワードリセットフォームエリア */}
        <div className="login-form-card">
          {/* 装飾的な背景要素 */}
          <div className="login-form-decoration-1"></div>
          <div className="login-form-decoration-2"></div>
          
          <div className="login-form-content">
            {status === "success" ? (
              // ✅ 送信完了画面
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <div className="w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-7 h-7 text-teal-600" />
                  </div>
                </div>
                
                <div>
                  <h1 className="text-lg font-semibold text-slate-800 mb-2">送信完了</h1>
                  <p className="text-slate-600 text-sm mb-3">{message}</p>
                  <p className="text-xs text-slate-500">
                    メールが届かない場合は、迷惑メールフォルダもご確認ください。
                  </p>
                </div>

                <div className="space-y-2">
                  <button 
                    className="login-button"
                    onClick={() => router.push('/login')}
                  >
                    ログイン画面に戻る
                  </button>
                  
                  <button 
                    className="login-button-secondary"
                    onClick={() => {
                      setStatus("idle");
                      setEmail("");
                      setMessage("");
                    }}
                  >
                    別のメールアドレスで再送信
                  </button>
                </div>
              </div>
            ) : (
              // ✅ 申請フォーム
              <form onSubmit={handleSubmit} className="login-form-space">
                <div>
                  <div className="flex items-center mb-4">
                    <button
                      type="button"
                      onClick={() => router.push('/login')}
                      className="mr-3 p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div>
                      <h1 className="text-lg font-semibold text-slate-800">パスワードリセット</h1>
                      <p className="text-slate-600 text-xs">登録されているメールアドレスを入力してください</p>
                    </div>
                  </div>
                </div>

                {/* エラーメッセージ */}
                {status === "error" && message && (
                  <div className="login-error">
                    <p className="login-error-text">{message}</p>
                  </div>
                )}

                {/* メールアドレス入力 */}
                <div className="login-input-group">
                  <label className="login-label">
                    メールアドレス
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="例：user@example.com"
                      className="login-input pl-9"
                      disabled={status === "loading"}
                    />
                  </div>
                </div>

                {/* 送信ボタン */}
                <button 
                  type="submit" 
                  className="login-button" 
                  disabled={status === "loading"}
                >
                  {status === "loading" ? "送信中..." : "リセットメールを送信"}
                </button>

                {/* 説明文 */}
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <p className="text-xs text-slate-600">
                    <strong>ご注意:</strong><br />
                    • メールアドレスが登録されている場合、パスワードリセット用のリンクをお送りします<br />
                    • リンクの有効期限は30分間です<br />
                    • メールが届かない場合は、迷惑メールフォルダもご確認ください
                  </p>
                </div>
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