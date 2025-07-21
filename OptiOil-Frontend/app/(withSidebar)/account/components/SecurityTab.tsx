// app/(withSidebar)/account/components/SecurityTab.tsx - 管理者FE仕様のMFAモーダル対応版
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Shield, ShieldCheck, Key, Copy, RefreshCw, QrCode, AlertTriangle, Smartphone, Monitor } from "lucide-react";
import { useConfirmModal } from "../../common/components/ConfirmModal";
import { useNotification } from "../../common/hooks/useNotification";
import { ToastContainer } from "../../common/components/Toast";
import { ENV } from '@/lib/env';

interface TwoFactorSetup {
  secret: string;
  qrCode: string;
  backupCodes: string[];
  setupInstructions?: string[];
}

interface UserMFAStatus {
  twoFactorEnabled: boolean;
  backupCodes?: string[];
}

export default function SecurityTab() {
  // パスワード変更関連のstate
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);

  // MFA関連のstate
  const [twoFactorStatus, setTwoFactorStatus] = useState<UserMFAStatus>({
    twoFactorEnabled: false
  });
  const [twoFactorSetup, setTwoFactorSetup] = useState<TwoFactorSetup | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [isSetupDialogOpen, setIsSetupDialogOpen] = useState(false);
  const [isBackupCodesDialogOpen, setIsBackupCodesDialogOpen] = useState(false);
  const [isMFALoading, setIsMFALoading] = useState(false);
  
  // 左側メニュー選択のstate
  const [selectedSection, setSelectedSection] = useState<'password' | 'mfa'>('password');

  const { openConfirm } = useConfirmModal();
  const { toasts, success, error, removeToast } = useNotification();

  // MFA状態を取得
  useEffect(() => {
    fetchMFAStatus();
  }, []);

  const fetchMFAStatus = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${ENV.API_URL}/api/users/mfa/status`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });

      if (res.ok) {
        const data = await res.json();
        setTwoFactorStatus(data);
      }
    } catch (err) {
      console.error("MFA状態取得エラー:", err);
    }
  };

  // パスワード変更処理
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      error("新しいパスワードが一致しません");
      return;
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{11,}$/;
    if (!passwordRegex.test(newPassword)) {
      error("パスワードは11文字以上で、大文字・小文字・数字をすべて含めてください");
      return;
    }

    if (!currentPassword) {
      error("現在のパスワードを入力してください");
      return;
    }

    setIsPasswordLoading(true);

    try {
      const res = await fetch(`${ENV.API_URL}/api/users/change-password`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "パスワード変更に失敗しました");
      }

      success("パスワードを更新しました");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

    } catch (err: any) {
      console.error("パスワード変更エラー:", err);
      error(err.message || "パスワード変更に失敗しました");
    } finally {
      setIsPasswordLoading(false);
    }
  };

  // MFA設定開始
  const handleSetupMFA = async () => {
    setIsMFALoading(true);
    
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${ENV.API_URL}/api/users/mfa/setup`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });

      if (!res.ok) throw new Error("MFA設定の取得に失敗しました");

      const data = await res.json();
      console.log('🔍 [Frontend] MFA設定データ受信:', data);
      
      setTwoFactorSetup(data);
      setIsSetupDialogOpen(true);
      
    } catch (err: any) {
      error(err.message || "MFA設定に失敗しました");
    } finally {
      setIsMFALoading(false);
    }
  };

  // MFA有効化（管理者FEと同じロジック）
  const handleEnableMFA = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!verificationCode) {
      error("認証コードを入力してください。Google Authenticatorアプリに表示されている6桁の数字を入力してください。");
      return;
    }

    if (verificationCode.length !== 6) {
      error("認証コードは6桁の数字で入力してください");
      return;
    }

    setIsMFALoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${ENV.API_URL}/api/users/mfa/enable`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ 
          verificationCode
          // secretは送信しない（サーバー側のDBから取得）
        }),
        credentials: "include",
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "MFA有効化に失敗しました");
      }

      const data = await res.json();
      setTwoFactorStatus({ 
        twoFactorEnabled: true, 
        backupCodes: data.backupCodes 
      });
      
      success("MFAが有効になりました！バックアップコードを安全な場所に保存してください。");
      
      // 状態をリセットして閉じる
      setIsSetupDialogOpen(false);
      setVerificationCode("");
      setTwoFactorSetup(null);

    } catch (err: any) {
      error(err.message || "認証コードが正しくありません");
    } finally {
      setIsMFALoading(false);
    }
  };

  // MFA無効化
  const handleDisableMFA = () => {
    openConfirm({
      type: 'danger',
      title: 'MFA認証を無効化',
      message: 'MFA認証を無効にすると、アカウントのセキュリティレベルが下がります。本当に無効にしますか？',
      confirmText: '無効にする',
      cancelText: 'キャンセル',
      onConfirm: async () => {
        setIsMFALoading(true);
        try {
          const token = localStorage.getItem("token");
          const res = await fetch(`${ENV.API_URL}/api/users/mfa/disable`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            credentials: "include",
          });

          if (!res.ok) throw new Error("MFA無効化に失敗しました");

          setTwoFactorStatus({ twoFactorEnabled: false });
          success("MFA認証を無効にしました");
        } catch (err: any) {
          error(err.message || "MFA無効化に失敗しました");
        } finally {
          setIsMFALoading(false);
        }
      }
    });
  };

  // バックアップコードをクリップボードにコピー
  const copyBackupCodes = () => {
    if (twoFactorStatus.backupCodes) {
      navigator.clipboard.writeText(twoFactorStatus.backupCodes.join('\n'));
      success("バックアップコードをコピーしました");
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8 h-full">
      {/* 左カラム - セキュリティメニュー */}
      <div className="w-full lg:w-1/3">
        <div className="border border-slate-200 rounded-lg bg-slate-50 h-full">
          {/* ヘッダー */}
          <div className="p-4 border-b border-slate-200">
            <h3 className="text-xs font-semibold text-slate-700">セキュリティ設定</h3>
          </div>

          {/* セキュリティメニュー */}
          <div className="overflow-y-auto max-h-96">
            <div
              onClick={() => setSelectedSection('password')}
              className={`
                p-4 border-b border-slate-200 cursor-pointer transition-colors
                ${selectedSection === 'password' 
                  ? 'bg-teal-50 border-l-4 border-l-[#115e59]' 
                  : 'hover:bg-slate-100'
                }
              `}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <Key className="w-5 h-5 text-[#115e59]" />
                    <div>
                      <div className="font-medium text-slate-700 text-xs">パスワード変更</div>
                      <div className="text-xs text-slate-500 mt-1">セキュリティ向上のため定期的な変更を推奨</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div
              onClick={() => setSelectedSection('mfa')}
              className={`
                p-4 border-b border-slate-200 cursor-pointer transition-colors
                ${selectedSection === 'mfa' 
                  ? 'bg-teal-50 border-l-4 border-l-[#115e59]' 
                  : 'hover:bg-slate-100'
                }
              `}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    {twoFactorStatus.twoFactorEnabled ? (
                      <ShieldCheck className="w-5 h-5 text-[#115e59]" />
                    ) : (
                      <Shield className="w-5 h-5 text-slate-400" />
                    )}
                    <div>
                      <div className="font-medium text-slate-700 text-xs">多要素認証（MFA）</div>
                      <div className="text-xs text-slate-500 mt-1">
                        {twoFactorStatus.twoFactorEnabled ? "有効（保護中）" : "無効"}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-1 ml-2">
                  <div className={`w-2 h-2 rounded-full ${twoFactorStatus.twoFactorEnabled ? 'bg-[#115e59]' : 'bg-slate-400'}`}></div>
                  <span className="text-xs text-slate-500">
                    {twoFactorStatus.twoFactorEnabled ? '有効' : '無効'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 右カラム - 設定エリア */}
      <div className="w-full lg:w-2/3">
        {selectedSection === 'password' ? (
          // パスワード変更セクション
          <div className="border border-slate-200 rounded-lg bg-white">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-2">
                <Key className="w-4 h-4" />
                パスワード変更
              </h3>
              <p className="text-xs text-slate-500">
                セキュリティ向上のため、定期的なパスワード変更をお勧めします。
              </p>
            </div>

            <div className="p-6 space-y-6">
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    現在のパスワード<span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="password"
                    className="w-full text-xs"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="現在のパスワードを入力"
                    required
                    disabled={isPasswordLoading}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    新しいパスワード<span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="password"
                    className="w-full text-xs"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="新しいパスワードを入力"
                    required
                    disabled={isPasswordLoading}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    新しいパスワード（確認）<span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="password"
                    className="w-full text-xs"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="新しいパスワードを再入力"
                    required
                    disabled={isPasswordLoading}
                  />
                </div>

                <div className="flex justify-start pt-4">
                  <Button 
                    type="submit" 
                    disabled={isPasswordLoading}
                    className="text-xs bg-[#115e59] hover:bg-[#0f766e] text-white disabled:opacity-50"
                  >
                    {isPasswordLoading ? "更新中..." : "パスワードを変更"}
                  </Button>
                </div>
              </form>

              {/* セキュリティ要件を下部に配置 */}
              <div className="border-t border-slate-200 pt-6">
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <h4 className="text-xs font-medium text-amber-800 mb-2">パスワードのセキュリティ要件</h4>
                  <ul className="text-xs text-amber-700 space-y-1">
                    <li>• 11文字以上の長さ</li>
                    <li>• 大文字（A-Z）を含む</li>
                    <li>• 小文字（a-z）を含む</li>
                    <li>• 数字（0-9）を含む</li>
                    <li>• 辞書に載っている単語や推測しやすい文字列は避けてください</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        ) : (
          // MFA認証セクション
          <div className="border border-slate-200 rounded-lg bg-white">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-2">
                <Shield className="w-4 h-4" />
                多要素認証（MFA）
              </h3>
              <p className="text-xs text-slate-500">
                スマートフォンアプリを使用した追加認証でアカウントのセキュリティを強化します。
              </p>
            </div>

            <div className="p-6">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-6">
                {twoFactorStatus.twoFactorEnabled ? (
                  // MFA有効時
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <ShieldCheck className="w-8 h-8 text-[#115e59]" />
                      <div>
                        <div className="font-medium text-slate-700 text-xs">MFA認証が有効です</div>
                        <div className="text-xs text-slate-500">アカウントは追加認証で保護されています</div>
                      </div>
                    </div>
                    
                    <div className="flex gap-3 pt-4">
                      <Button 
                        onClick={() => setIsBackupCodesDialogOpen(true)}
                        className="text-xs text-slate-600"
                      >
                        <Key className="w-4 h-4 mr-2" />
                        バックアップコード
                      </Button>
                      
                      <Button 
                        onClick={handleDisableMFA}
                        disabled={isMFALoading}
                        className="text-xs border-red-500 text-red-600 hover:bg-red-50"
                      >
                        <AlertTriangle className="w-4 h-4 mr-2" />
                        MFAを無効にする
                      </Button>
                    </div>
                  </div>
                ) : (
                  // MFA無効時
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Shield className="w-8 h-8 text-slate-400" />
                      <div>
                        <div className="font-medium text-slate-700 text-xs">MFA認証が無効です</div>
                        <div className="text-xs text-slate-500">セキュリティ強化のためMFA認証の有効化をお勧めします</div>
                      </div>
                    </div>
                    
                    <Button 
                      onClick={handleSetupMFA}
                      disabled={isMFALoading}
                      className="text-xs bg-[#115e59] hover:bg-[#0f766e] text-white"
                    >
                      <ShieldCheck className="w-4 h-4 mr-2" />
                      {isMFALoading ? "設定中..." : "MFA認証を有効にする"}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* QRコードのみのMFA設定モーダル */}
      {isSetupDialogOpen && twoFactorSetup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">MFA設定</h3>
            
            <div className="space-y-4">
              {/* 手順説明 */}
              <div className="text-sm text-gray-600">
                <p className="mb-4 font-medium">以下の手順でMFA認証を設定してください：</p>
                <ol className="list-decimal list-inside space-y-2 text-sm">
                  <li>Google Authenticator等のアプリでQRコードをスキャン</li>
                  <li>アプリに表示される6桁のコードを入力</li>
                  <li>「有効にする」ボタンを押して完了</li>
                </ol>
              </div>

              {/* QRコード表示 */}
              <div>
                <p className="text-sm text-gray-600 mb-2">
                  認証アプリでこのQRコードをスキャンしてください：
                </p>
                <div className="flex justify-center p-4 bg-gray-50 rounded">
                  <img src={twoFactorSetup.qrCode} alt="MFA QR Code" className="max-w-48" />
                </div>
              </div>

              {/* 認証コード入力フォーム */}
              <form onSubmit={handleEnableMFA}>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    認証アプリの6桁コードを入力してください：
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={verificationCode}
                    onChange={(e) => {
                      const input = e.target.value;
                      // 半角数字のみを抽出（最大6桁）
                      const halfWidthOnly = input.replace(/\D/g, '').slice(0, 6);
                      setVerificationCode(halfWidthOnly);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-center text-lg font-mono"
                    placeholder="000000"
                    required
                  />
                </div>
                
                <div className="flex gap-2 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setIsSetupDialogOpen(false);
                      setVerificationCode("");
                      setTwoFactorSetup(null);
                    }}
                    className="flex-1 py-2 px-4 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  >
                    キャンセル
                  </button>
                  <button
                    type="submit"
                    disabled={isMFALoading || verificationCode.length !== 6}
                    className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isMFALoading ? '確認中...' : '有効にする'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* バックアップコードダイアログ */}
      <Dialog open={isBackupCodesDialogOpen} onOpenChange={setIsBackupCodesDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xs flex items-center gap-2">
              <Key className="w-5 h-5" />
              バックアップコード
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded p-3">
              <p className="text-xs text-amber-800">
                これらのコードは認証アプリが使用できない場合のログインに使用できます。
                安全な場所に保管してください。
              </p>
            </div>

            {twoFactorStatus.backupCodes && (
              <div className="bg-slate-100 rounded p-4">
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  {twoFactorStatus.backupCodes.map((code, index) => (
                    <div key={index} className="bg-white px-2 py-1 rounded text-center">
                      {code}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button 
                
                onClick={copyBackupCodes}
                className="flex-1 text-xs"
              >
                <Copy className="w-4 h-4 mr-2" />
                コピー
              </Button>
              <Button 
                
                onClick={() => setIsBackupCodesDialogOpen(false)}
                className="flex-1 text-xs"
              >
                閉じる
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Toast通知 */}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  );
}