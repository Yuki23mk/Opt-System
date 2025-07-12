// OptiOil-Frontend/app/login/page.tsx - 同意情報送信対応版
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { CheckCircle, Mail, Clock, ArrowLeft } from "lucide-react";
import { ENV } from '@/lib/env';

export default function LoginPage() {
  const router = useRouter();

  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [registerStatus, setRegisterStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [registerMessage, setRegisterMessage] = useState("");
  const [registeredEmail, setRegisteredEmail] = useState(""); // 登録したメールアドレスを保存
  const [formErrors, setFormErrors] = useState<{[key: string]: string}>({}); // フォームエラー

  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [registerForm, setRegisterForm] = useState({
    name: "",
    company: "",
    department: "",
    position: "",
    email: "",
    password: "",
    phone: "",
    agreeToTerms: false,
  });

  const handleLogin = async () => {
    setError("");
    const { email, password } = loginForm;

    if (!email || !password) {
      setError("メールアドレスとパスワードを入力してください");
      return;
    }

    setLoading(true);
    
    try {
      const baseUrl = ENV.API_URL;
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      
      if (res.ok) {
        // ✅ MFA要求チェック
        if (data.requiresMFA) {
          // MFA認証ページにリダイレクト（一時トークンをパラメータで渡す）
          router.push(`/mfa-login?tempToken=${encodeURIComponent(data.tempToken)}`);
          return;
        }

        // ✅ 従来通りのログイン（MFA無効ユーザー）
        const token = data.token;
        localStorage.setItem("token", token);
        document.cookie = `token=${token}; path=/; SameSite=Lax`;
        router.push("/products");
        
      } else {
        setError(data.error || "ログインに失敗しました");
      }
    } catch (err) {
      console.error("ログインエラー:", err);
      setError("通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === 'checkbox' ? checked : value;
    setRegisterForm({ ...registerForm, [name]: newValue });
    
    // リアルタイムバリデーション
    const newErrors = { ...formErrors };
    
    if (name === 'email') {
      if (value && !value.includes('@')) {
        newErrors.email = 'メールアドレスの形式が正しくありません（@が必要です）';
      } else {
        delete newErrors.email;
      }
    }
    
    if (name === 'password') {
      if (value) {
        const hasMinLength = value.length >= 8;
        const hasUpperCase = /[A-Z]/.test(value);
        const hasAlphaNumeric = /^[a-zA-Z0-9]+$/.test(value);
        
        if (!hasMinLength) {
          newErrors.password = 'パスワードは8文字以上である必要があります';
        } else if (!hasUpperCase) {
          newErrors.password = 'パスワードには大文字を1文字以上含める必要があります';
        } else if (!hasAlphaNumeric) {
          newErrors.password = 'パスワードは半角英数字のみ使用してください';
        } else {
          delete newErrors.password;
        }
      } else {
        delete newErrors.password;
      }
    }
    
    if (name === 'agreeToTerms') {
      if (!checked) {
        newErrors.agreeToTerms = '利用規約およびプライバシーポリシーへの同意が必要です';
      } else {
        delete newErrors.agreeToTerms;
      }
    }
    
    setFormErrors(newErrors);
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterStatus("loading");
    setRegisterMessage("");

    const { name, company, email, password } = registerForm;
    
    // 基本的な必須項目チェック
    if (!name || !company || !email || !password) {
      setRegisterStatus("error");
      setRegisterMessage("氏名・会社名・メール・パスワードは必須です");
      return;
    }

    // 利用規約同意チェック
    if (!registerForm.agreeToTerms) {
      setRegisterStatus("error");
      setRegisterMessage("利用規約およびプライバシーポリシーへの同意が必要です");
      return;
    }

    // 詳細バリデーション
    const validationErrors: {[key: string]: string} = {};
    
    // メールアドレスバリデーション
    if (!email.includes('@')) {
      validationErrors.email = 'メールアドレスの形式が正しくありません（@が必要です）';
    }
    
    // パスワードバリデーション
    const hasMinLength = password.length >= 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasAlphaNumeric = /^[a-zA-Z0-9]+$/.test(password);
    
    if (!hasMinLength) {
      validationErrors.password = 'パスワードは8文字以上である必要があります';
    } else if (!hasUpperCase) {
      validationErrors.password = 'パスワードには大文字を1文字以上含める必要があります';
    } else if (!hasAlphaNumeric) {
      validationErrors.password = 'パスワードは半角英数字のみ使用してください';
    }
    
    // 利用規約同意バリデーション
    if (!registerForm.agreeToTerms) {
      validationErrors.agreeToTerms = '利用規約およびプライバシーポリシーへの同意が必要です';
    }
    
    // バリデーションエラーがある場合は送信を止める
    if (Object.keys(validationErrors).length > 0) {
      setFormErrors(validationErrors);
      setRegisterStatus("error");
      setRegisterMessage("入力内容に不備があります。エラーメッセージをご確認ください。");
      return;
    }

    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL;
      const res = await fetch(`${baseUrl}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // 🆕 agreeToTermsをAPIに送信
        body: JSON.stringify({
          ...registerForm,
          agreeToTerms: registerForm.agreeToTerms
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setRegisterStatus("success");
        setRegisteredEmail(email); // 登録したメールアドレスを保存
        setRegisterMessage("登録申請を受け付けました。承認までお待ちください。");
        setFormErrors({}); // エラーをクリア
        setRegisterForm({
          name: "",
          company: "",
          department: "",
          position: "",
          email: "",
          password: "",
          phone: "",
          agreeToTerms: false,
        });
      } else {
        setRegisterStatus("error");
        setRegisterMessage(data.error || "登録に失敗しました");
      }
    } catch {
      setRegisterStatus("error");
      setRegisterMessage("通信エラーが発生しました");
    }
  };

  const handleBackToLogin = () => {
    setIsRegistering(false);
    setRegisterStatus("idle");
    setRegisterMessage("");
    setRegisteredEmail("");
    setFormErrors({}); // エラーをクリア
  };

  return (
    <div 
      className="min-h-screen bg-cover bg-center bg-no-repeat flex items-center justify-center login-page-small"
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

        {/* ログイン・登録フォームエリア */}
        <div className="login-form-card">
          {/* 装飾的な背景要素 */}
          <div className="login-form-decoration-1"></div>
          <div className="login-form-decoration-2"></div>
        
          <div className="login-form-content">
            {isRegistering ? (
              registerStatus === "success" ? (
                // ✅ エンハンスされた完了画面
                <div className="space-y-4 text-center">
                  {/* 成功アイコン */}
                  <div className="flex justify-center">
                    <div className="w-12 h-12 bg-gradient-to-br from-teal-100 to-teal-50 rounded-full flex items-center justify-center shadow-lg">
                      <CheckCircle className="w-7 h-7 text-teal-600" />
                    </div>
                  </div>

                  {/* メインメッセージ */}
                  <div>
                    <h2 className="text-lg font-bold text-slate-800 mb-1">
                      登録申請完了
                    </h2>
                    <p className="text-slate-600 text-sm leading-relaxed">
                      ご登録いただき、ありがとうございます。<br />
                      申請内容を確認いたします。
                    </p>
                  </div>

                  {/* ステップ説明 */}
                  <div className="bg-gradient-to-br from-slate-50 to-white border border-slate-200/60 rounded-lg p-3 space-y-2 shadow-sm">
                    <div className="flex items-start gap-2">
                      <Clock className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                      <div className="text-left">
                        <p className="font-medium text-slate-800 text-xs">管理者による承認待ち</p>
                        <p className="text-xs text-slate-600 mt-0.5">
                          通常1〜2営業日以内にご連絡いたします
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <Mail className="w-4 h-4 text-teal-600 mt-0.5 flex-shrink-0" />
                      <div className="text-left">
                        <p className="font-medium text-slate-800 text-xs">メール通知について</p>
                        <p className="text-xs text-slate-600 mt-0.5">
                          <span className="font-medium text-teal-700">{registeredEmail}</span><br />
                          こちらのアドレスに承認結果をお送りします
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* 注意事項 */}
                  <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200/60 rounded-lg p-2 shadow-sm">
                    <p className="text-xs text-amber-800">
                      <strong>ご注意:</strong> 迷惑メールフォルダも併せてご確認ください。
                      承認後、すぐにOpt.をご利用いただけます。
                    </p>
                  </div>

                  {/* アクションボタン */}
                  <div className="space-y-2">
                    <button 
                      onClick={handleBackToLogin}
                      className="login-button flex items-center justify-center gap-2"
                    >
                      <ArrowLeft className="w-3 h-3" />
                      ログイン画面に戻る
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleRegisterSubmit} className="space-y-3">
                  <div className="text-center mb-4">
                    <h2 className="text-lg font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">新規登録申請</h2>
                    <div className="w-8 h-0.5 bg-gradient-to-r from-teal-500 to-teal-600 rounded-full mx-auto mt-1"></div>
                  </div>
                  
                  {registerMessage && (
                    <div className={`rounded-lg p-2 text-xs shadow-sm ${
                      registerStatus === "error" 
                        ? "login-error" 
                        : "bg-gradient-to-r from-teal-50 to-cyan-50 border border-teal-200/60 text-teal-700"
                    }`}>
                      <p className={registerStatus === "error" ? "login-error-text" : ""}>{registerMessage}</p>
                    </div>
                  )}

                  {[
                    { label: "氏名 *", name: "name" },
                    { label: "会社名 *", name: "company" },
                    { label: "部署", name: "department" },
                    { label: "役職", name: "position" },
                    { label: "メールアドレス *", name: "email" },
                    { label: "ログインパスワード *", name: "password", type: "password" },
                    { label: "電話番号", name: "phone" },
                  ].map(({ label, name, type }) => (
                    <div key={name} className="login-input-group">
                      <label className="text-xs font-medium text-slate-700">{label}</label>
                      <Input
                        name={name}
                        type={type || "text"}
                        value={
                          typeof registerForm[name as keyof typeof registerForm] === "boolean"
                            ? ""
                            : String(registerForm[name as keyof typeof registerForm] || "")
                        }
                        onChange={handleRegisterChange}
                        className={`login-input text-sm
                          ${formErrors[name] 
                            ? 'border-red-300 focus:border-red-500 focus:ring-1 focus:ring-red-200' 
                            : ''
                          }`}
                      />
                      {/* フィールド別エラーメッセージ */}
                      {formErrors[name] && (
                        <p className="text-xs text-red-500 flex items-center gap-1 mt-0.5">
                          <span className="w-1 h-1 bg-red-500 rounded-full"></span>
                          {formErrors[name]}
                        </p>
                      )}
                      {/* パスワード要件の説明（エラーがない場合のみ表示） */}
                      {name === "password" && !formErrors[name] && (
                        <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                          <span className="w-1 h-1 bg-slate-400 rounded-full"></span>
                          半角英数字8文字以上・大文字1文字以上必須
                        </p>
                      )}
                    </div>
                  ))}

                  {/* 利用規約・プライバシーポリシー同意チェックボックス */}
                  <div className="login-input-group">
                    <label className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        name="agreeToTerms"
                        checked={registerForm.agreeToTerms || false}
                        onChange={handleRegisterChange}
                        className="mt-0.5 w-3 h-3 border border-slate-300 rounded focus:ring-1 focus:ring-teal-500 focus:border-teal-500 accent-teal-600"
                      />
                      <span className="leading-relaxed">
                        <a 
                          href="/legal/terms"
                          className="text-teal-600 hover:text-teal-700 hover:underline"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          利用規約
                        </a>
                        および
                        <a 
                          href="/legal/privacy"
                          className="text-teal-600 hover:text-teal-700 hover:underline"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          プライバシーポリシー
                        </a>
                        に同意して登録申請を行います
                      </span>
                    </label>
                    {formErrors.agreeToTerms && (
                      <p className="text-xs text-red-500 flex items-center gap-1 mt-0.5">
                        <span className="w-1 h-1 bg-red-500 rounded-full"></span>
                        {formErrors.agreeToTerms}
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    className="login-button mt-4"
                    disabled={registerStatus === "loading"}
                  >
                    {registerStatus === "loading" ? (
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        送信中...
                      </div>
                    ) : (
                      "利用規約に同意して登録申請する"
                    )}
                  </button>

                  <div className="text-center mt-3">
                    <button 
                      type="button" 
                      className="text-teal-600 hover:text-teal-700 text-xs font-medium hover:underline transition-all duration-200" 
                      onClick={() => {
                        setIsRegistering(false);
                        setFormErrors({});
                      }}
                    >
                      ← ログインに戻る
                    </button>
                  </div>
                </form>
              )
            ) : (
              <form
                className="login-form-space"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleLogin();
                }}
              >
                {/* エラーメッセージ */}
                {error && (
                  <div className="login-error">
                    <p className="login-error-text">{error}</p>
                  </div>
                )}

                <div className="login-input-group">
                  <label className="login-label">メールアドレス</label>
                  <Input
                    name="email"
                    type="email"
                    value={loginForm.email}
                    onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                    className="login-input"
                    disabled={loading}
                    placeholder="your@email.com"
                  />
                </div>

                <div className="login-input-group">
                  <label className="login-label">パスワード</label>
                  <Input
                    name="password"
                    type="password"
                    value={loginForm.password}
                    onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                    className="login-input"
                    disabled={loading}
                    placeholder="パスワードを入力"
                  />
                  <button
                    type="button"
                    className="text-xs text-slate-500 hover:text-teal-600 transition-colors duration-200 font-medium mt-1"
                    onClick={() => router.push('/password-reset')}
                  >
                    パスワードを忘れた方はこちら →
                  </button>
                </div>

                <button 
                  type="submit" 
                  className="login-button"
                  disabled={loading}
                >
                  {loading ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      ログイン中...
                    </div>
                  ) : (
                    "ログイン"
                  )}
                </button>

                <div className="text-center">
                  <button 
                    type="button"
                    className="login-button-secondary"
                    onClick={() => setIsRegistering(true)} 
                    disabled={loading}
                  >
                    初めてご利用される方はこちらから
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* フッター */}
        <div className="login-footer">
          <p>© 2025 （有）丸一機料商会 All rights reserved.</p>
          <p>
            <a 
              href="/legal/terms"
              className="text-teal-600 hover:text-teal-700"
              target="_blank"
              rel="noopener noreferrer"
            >
              利用規約
            </a> | {" "}
            <a 
              href="/legal/privacy"
              className="text-teal-600 hover:text-teal-700"
              target="_blank"
              rel="noopener noreferrer"
            >
              プライバシーポリシー
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}