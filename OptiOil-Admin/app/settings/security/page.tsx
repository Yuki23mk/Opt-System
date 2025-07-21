/**
* ファイルパス: optioil-admin/app/settings/security/page.tsx
* 管理者MFA設定・アカウント管理ページ
*/

"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowLeft, UserPlus, KeyRound, Users } from "lucide-react";
import { ENV } from '@/lib/env';

interface MfaSetupData {
 qrCode: string;
 setupInstructions: string[];
}

interface AdminUser {
  id: number;
  username: string;
  email: string;
  role: string;
  status: string;
  twoFactorEnabled?: boolean;
  createdAt: string;
  lastLogin: string | null;
}

export default function SecuritySettingsPage() {
 const [mfaEnabled, setMfaEnabled] = useState(false);
 const [isLoading, setIsLoading] = useState(false);
 const [error, setError] = useState("");
 const [success, setSuccess] = useState("");
 
 // MFA設定用state
 const [showSetupModal, setShowSetupModal] = useState(false);
 const [setupData, setSetupData] = useState<MfaSetupData | null>(null);
 const [verificationCode, setVerificationCode] = useState("");
 
 // MFA無効化用state
 const [showDisableModal, setShowDisableModal] = useState(false);
 const [disablePassword, setDisablePassword] = useState("");
 const [disableMfaCode, setDisableMfaCode] = useState("");
 const [disableBackupCode, setDisableBackupCode] = useState("");
 const [useDisableBackupCode, setUseDisableBackupCode] = useState(false);
 
 // バックアップコード管理
 const [showBackupCodes, setShowBackupCodes] = useState(false);
 const [backupCodes, setBackupCodes] = useState<string[]>([]);
 const [showRegenerateModal, setShowRegenerateModal] = useState(false);
 const [regenerateMfaCode, setRegenerateMfaCode] = useState("");
 
 // 🆕 管理者アカウント管理機能
 const [showCreateAdminModal, setShowCreateAdminModal] = useState(false);
 const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
 const [showAdminListModal, setShowAdminListModal] = useState(false);
 const [adminList, setAdminList] = useState<AdminUser[]>([]);
 
 // 新規管理者作成用フォーム
 const [newAdmin, setNewAdmin] = useState({
   username: "",
   email: "",
   password: ""
 });
 
 // パスワードリセット用フォーム
 const [resetForm, setResetForm] = useState({
   username: "",
   newPassword: ""
 });
 
 const router = useRouter();
 const API_URL = ENV.API_URL;

 const getAuthToken = () => {
   return localStorage.getItem("adminToken");
 };

 const checkMfaStatus = useCallback(async () => {
   try {
     const token = getAuthToken();
     if (!token) {
       console.log('トークンなし、ログインページにリダイレクト');
       router.push('/auth/login');
       return;
     }

     console.log('MFA状態確認開始...');
     const response = await fetch(`${API_URL}/api/admin/auth/me`, {
       headers: {
         'Authorization': `Bearer ${token}`
       }
     });

     console.log('API レスポンス:', response.status);

     if (response.ok) {
       const data = await response.json();
       console.log('管理者データ:', data);
       setMfaEnabled(data.twoFactorEnabled || false);
       setError(""); // エラーをクリア
     } else {
       const errorData = await response.json().catch(() => ({}));
       console.error('認証確認失敗:', response.status, errorData);
       
       if (response.status === 401) {
         // 認証エラーの場合はログインページにリダイレクト
         localStorage.removeItem("adminToken");
         router.push('/auth/login');
       } else {
         setError(`認証状態の確認に失敗しました（${response.status}）`);
       }
     }
   } catch (error) {
     console.error('❌ MFA状態確認エラー:', error);
     setError('ネットワークエラー: MFA状態の確認に失敗しました');
   }
 }, [API_URL, router]);

 useEffect(() => {
   checkMfaStatus();
 }, [checkMfaStatus]);

 const startMfaSetup = async () => {
   setIsLoading(true);
   setError("");

   try {
     const token = getAuthToken();
     const response = await fetch(`${API_URL}/api/admin/auth/mfa/setup`, {
       method: 'POST',
       headers: {
         'Authorization': `Bearer ${token}`,
         'Content-Type': 'application/json'
       }
     });

     const data = await response.json();

     if (response.ok) {
       setSetupData(data);
       setShowSetupModal(true);
     } else {
       setError(data.error || 'MFA設定の開始に失敗しました');
     }
   } catch (error) {
     console.error('❌ MFA設定開始エラー:', error);
     setError('ネットワークエラーが発生しました');
   } finally {
     setIsLoading(false);
   }
 };

 const completeMfaSetup = async (e: React.FormEvent) => {
   e.preventDefault();
   setIsLoading(true);
   setError("");

   try {
     const token = getAuthToken();
     const response = await fetch(`${API_URL}/api/admin/auth/mfa/verify`, {
       method: 'POST',
       headers: {
         'Authorization': `Bearer ${token}`,
         'Content-Type': 'application/json'
       },
       body: JSON.stringify({ token: verificationCode })
     });

     const data = await response.json();

     if (response.ok) {
       setMfaEnabled(true);
       setShowSetupModal(false);
       setVerificationCode("");
       setSetupData(null);
       setSuccess('MFAが有効になりました！バックアップコードを安全な場所に保存してください。');
       
       // バックアップコードを表示
       setBackupCodes(data.backupCodes);
       setShowBackupCodes(true);
     } else {
       setError(data.error || 'MFA設定の完了に失敗しました');
     }
   } catch (error) {
     console.error('❌ MFA設定完了エラー:', error);
     setError('ネットワークエラーが発生しました');
   } finally {
     setIsLoading(false);
   }
 };

 const disableMfa = async (e: React.FormEvent) => {
   e.preventDefault();
   setIsLoading(true);
   setError("");

   try {
     const token = getAuthToken();
     const requestBody: {
       password: string;
       token?: string;
       backupCode?: string;
     } = { password: disablePassword };
     
     if (useDisableBackupCode) {
       requestBody.backupCode = disableBackupCode;
     } else {
       requestBody.token = disableMfaCode;
     }

     const response = await fetch(`${API_URL}/api/admin/auth/mfa/disable`, {
       method: 'POST',
       headers: {
         'Authorization': `Bearer ${token}`,
         'Content-Type': 'application/json'
       },
       body: JSON.stringify(requestBody)
     });

     const data = await response.json();

     if (response.ok) {
       setMfaEnabled(false);
       setShowDisableModal(false);
       setDisablePassword("");
       setDisableMfaCode("");
       setDisableBackupCode("");
       setUseDisableBackupCode(false);
       setSuccess('MFAを無効にしました');
     } else {
       setError(data.error || 'MFA無効化に失敗しました');
     }
   } catch (error) {
     console.error('❌ MFA無効化エラー:', error);
     setError('ネットワークエラーが発生しました');
   } finally {
     setIsLoading(false);
   }
 };

 const fetchBackupCodes = async () => {
   try {
     const token = getAuthToken();
     const response = await fetch(`${API_URL}/api/admin/auth/mfa/backup-codes`, {
       headers: {
         'Authorization': `Bearer ${token}`
       }
     });

     const data = await response.json();

     if (response.ok) {
       setBackupCodes(data.backupCodes);
       setShowBackupCodes(true);
     } else {
       setError(data.error || 'バックアップコードの取得に失敗しました');
     }
   } catch (error) {
     console.error('❌ バックアップコード取得エラー:', error);
     setError('ネットワークエラーが発生しました');
   }
 };

 const regenerateBackupCodes = async (e: React.FormEvent) => {
   e.preventDefault();
   setIsLoading(true);
   setError("");

   try {
     const token = getAuthToken();
     const response = await fetch(`${API_URL}/api/admin/auth/mfa/backup-codes`, {
       method: 'POST',
       headers: {
         'Authorization': `Bearer ${token}`,
         'Content-Type': 'application/json'
       },
       body: JSON.stringify({ 
         regenerate: true,
         token: regenerateMfaCode 
       })
     });

     const data = await response.json();

     if (response.ok) {
       setBackupCodes(data.backupCodes);
       setShowRegenerateModal(false);
       setRegenerateMfaCode("");
       setShowBackupCodes(true);
       setSuccess('バックアップコードを再生成しました');
     } else {
       setError(data.error || 'バックアップコード再生成に失敗しました');
     }
   } catch (error) {
     console.error('❌ バックアップコード再生成エラー:', error);
     setError('ネットワークエラーが発生しました');
   } finally {
     setIsLoading(false);
   }
 };

 // 🆕 管理者アカウント作成
 const handleCreateAdmin = async (e: React.FormEvent) => {
   e.preventDefault();
   setIsLoading(true);
   setError("");

   try {
     const token = getAuthToken();
     const response = await fetch(`${API_URL}/api/admin/auth/create-admin`, {
       method: 'POST',
       headers: {
         'Authorization': `Bearer ${token}`,
         'Content-Type': 'application/json'
       },
       body: JSON.stringify(newAdmin),
     });

     const data = await response.json();

     if (response.ok) {
       setSuccess(`管理者アカウントを作成しました！\nユーザー名: ${newAdmin.username}`);
       setNewAdmin({ username: "", email: "", password: "" });
       setShowCreateAdminModal(false);
     } else {
       setError(data.error || '管理者作成に失敗しました');
     }
   } catch (error) {
     console.error('❌ 管理者作成エラー:', error);
     setError('ネットワークエラーが発生しました');
   } finally {
     setIsLoading(false);
   }
 };

 // 🆕 パスワードリセット
 const handleResetPassword = async (e: React.FormEvent) => {
   e.preventDefault();
   setIsLoading(true);
   setError("");

   try {
     const token = getAuthToken();
     const response = await fetch(`${API_URL}/api/admin/auth/reset-password`, {
       method: 'POST',
       headers: {
         'Authorization': `Bearer ${token}`,
         'Content-Type': 'application/json'
       },
       body: JSON.stringify(resetForm),
     });

     const data = await response.json();

     if (response.ok) {
       setSuccess(`パスワードをリセットしました！\nユーザー名: ${resetForm.username}`);
       setResetForm({ username: "", newPassword: "" });
       setShowResetPasswordModal(false);
     } else {
       setError(data.error || 'パスワードリセットに失敗しました');
     }
   } catch (error) {
     console.error('❌ パスワードリセットエラー:', error);
     setError('ネットワークエラーが発生しました');
   } finally {
     setIsLoading(false);
   }
 };

 // 🆕 管理者一覧取得
 const fetchAdminList = async () => {
   try {
     const token = getAuthToken();
     const response = await fetch(`${API_URL}/api/admin/auth/list-admins`, {
       headers: {
         'Authorization': `Bearer ${token}`
       }
     });
     const data = await response.json();

     if (response.ok) {
       setAdminList(data.admins);
       setShowAdminListModal(true);
     } else {
       setError(data.error || '管理者一覧の取得に失敗しました');
     }
   } catch (error) {
     console.error('❌ 管理者一覧取得エラー:', error);
     setError('ネットワークエラーが発生しました');
   }
 };

 return (
   <div className="min-h-screen bg-gray-50 py-8">
     <div className="max-w-4xl mx-auto px-4">
       {/* ダッシュボードに戻るボタン */}
       <button
         onClick={() => router.push('/dashboard')}
         className="flex items-center text-gray-600 hover:text-gray-800 mb-6 transition-colors"
       >
         <ArrowLeft className="w-4 h-4 mr-2" />
         ダッシュボードに戻る
       </button>

       <div className="bg-white rounded-lg shadow-sm p-6">
         <h1 className="text-2xl font-bold text-gray-900 mb-6">セキュリティ設定</h1>

         {error && (
           <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
             {error}
           </div>
         )}

         {success && (
           <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
             {success}
           </div>
         )}

         {/* MFA設定セクション（既存機能は変更なし） */}
         <div className="border rounded-lg p-6 mb-6">
           <div className="flex items-center justify-between mb-4">
             <div>
               <h2 className="text-lg font-semibold text-gray-900">多要素認証（MFA）</h2>
               <p className="text-sm text-gray-600">
                 アカウントのセキュリティを強化するために追加の認証を設定します
               </p>
             </div>
             <div className="flex items-center">
               <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                 mfaEnabled 
                   ? 'bg-green-100 text-green-800' 
                   : 'bg-gray-100 text-gray-800'
               }`}>
                 {mfaEnabled ? '🔐 有効' : '🔓 無効'}
               </span>
             </div>
           </div>

           <div className="space-y-4">
             {!mfaEnabled ? (
               <div>
                 <p className="text-sm text-gray-600 mb-4">
                   認証アプリ（Google Authenticator、Authy、1Passwordなど）を使用してアカウントを保護します。
                 </p>
                 <button
                   onClick={startMfaSetup}
                   disabled={isLoading}
                   className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
                 >
                   {isLoading ? '設定中...' : 'MFAを有効にする'}
                 </button>
               </div>
             ) : (
               <div className="space-y-4">
                 <p className="text-sm text-green-600">
                   ✅ MFAが有効になっています。アカウントのセキュリティが強化されました。
                 </p>
                 
                 <div className="flex gap-4">
                   <button
                     onClick={fetchBackupCodes}
                     className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700"
                   >
                     📋 バックアップコードを表示
                   </button>
                   
                   <button
                     onClick={() => setShowRegenerateModal(true)}
                     className="bg-yellow-600 text-white px-4 py-2 rounded-md hover:bg-yellow-700"
                   >
                     🔄 バックアップコードを再生成
                   </button>
                   
                   <button
                     onClick={() => setShowDisableModal(true)}
                     className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
                   >
                     🚫 MFAを無効にする
                   </button>
                 </div>
               </div>
             )}
           </div>
         </div>

         {/* 🆕 管理者アカウント管理セクション */}
         <div className="border rounded-lg p-6">
           <div className="flex items-center justify-between mb-4">
             <div>
               <h2 className="text-lg font-semibold text-gray-900">管理者アカウント管理</h2>
               <p className="text-sm text-gray-600">
                 管理者アカウントの作成、パスワードリセット、一覧表示を行います
               </p>
             </div>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
             <button
               onClick={() => setShowCreateAdminModal(true)}
               className="flex items-center justify-center gap-2 p-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
             >
               <UserPlus className="w-5 h-5 text-blue-600" />
               <span className="text-sm font-medium">新しい管理者を作成</span>
             </button>

             <button
               onClick={() => setShowResetPasswordModal(true)}
               className="flex items-center justify-center gap-2 p-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
             >
               <KeyRound className="w-5 h-5 text-orange-600" />
               <span className="text-sm font-medium">パスワードをリセット</span>
             </button>

             <button
               onClick={fetchAdminList}
               className="flex items-center justify-center gap-2 p-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
             >
               <Users className="w-5 h-5 text-green-600" />
               <span className="text-sm font-medium">管理者一覧を表示</span>
             </button>
           </div>
         </div>
       </div>
     </div>

     {/* MFA設定モーダル（既存のまま） */}
     {showSetupModal && setupData && (
       <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
         <div className="bg-white rounded-lg max-w-md w-full p-6">
           <h3 className="text-lg font-semibold mb-4">MFA設定</h3>
           
           <div className="space-y-4">
             <div>
               <p className="text-sm text-gray-600 mb-2">
                 認証アプリでこのQRコードをスキャンしてください：
               </p>
               <div className="flex justify-center p-4 bg-gray-50 rounded">
                 <Image 
                   src={setupData.qrCode} 
                   alt="MFA QR Code" 
                   width={192}
                   height={192}
                   className="max-w-48" 
                 />
               </div>
             </div>

             <form onSubmit={completeMfaSetup}>
               <div>
                 <label className="block text-sm font-medium text-gray-700 mb-2">
                   認証アプリの6桁コードを入力してください：
                 </label>
                 <input
                   type="text"
                   maxLength={6}
                   value={verificationCode}
                   onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                   className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-center text-lg font-mono"
                   placeholder="000000"
                   required
                 />
               </div>
               
               <div className="flex gap-2 pt-4">
                 <button
                   type="button"
                   onClick={() => {
                     setShowSetupModal(false);
                     setVerificationCode("");
                     setSetupData(null);
                   }}
                   className="flex-1 py-2 px-4 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                 >
                   キャンセル
                 </button>
                 <button
                   type="submit"
                   disabled={isLoading || verificationCode.length !== 6}
                   className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                 >
                   {isLoading ? '確認中...' : '設定完了'}
                 </button>
               </div>
             </form>
           </div>
         </div>
       </div>
     )}

     {/* MFA無効化モーダル（既存のまま） */}
     {showDisableModal && (
       <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
         <div className="bg-white rounded-lg max-w-md w-full p-6">
           <h3 className="text-lg font-semibold mb-4 text-red-600">MFAを無効にする</h3>
           
           <form onSubmit={disableMfa} className="space-y-4">
             <div>
               <label className="block text-sm font-medium text-gray-700">パスワード</label>
               <input
                 type="password"
                 required
                 value={disablePassword}
                 onChange={(e) => setDisablePassword(e.target.value)}
                 className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-red-500 focus:border-red-500"
               />
             </div>

             {!useDisableBackupCode ? (
               <div>
                 <label className="block text-sm font-medium text-gray-700">認証アプリの6桁コード</label>
                 <input
                   type="text"
                   maxLength={6}
                   value={disableMfaCode}
                   onChange={(e) => setDisableMfaCode(e.target.value.replace(/\D/g, ''))}
                   className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-red-500 focus:border-red-500 text-center font-mono"
                   placeholder="000000"
                   required={!useDisableBackupCode}
                 />
               </div>
             ) : (
               <div>
                 <label className="block text-sm font-medium text-gray-700">バックアップコード</label>
                 <input
                   type="text"
                   value={disableBackupCode}
                   onChange={(e) => setDisableBackupCode(e.target.value.toUpperCase())}
                   className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-red-500 focus:border-red-500 text-center font-mono"
                   placeholder="XXXX-XXXX"
                   required={useDisableBackupCode}
                 />
               </div>
             )}

             <button
               type="button"
               onClick={() => setUseDisableBackupCode(!useDisableBackupCode)}
               className="text-sm text-blue-600 hover:text-blue-500"
             >
               {useDisableBackupCode ? '🔒 認証アプリを使用' : '🔑 バックアップコードを使用'}
             </button>
             
             <div className="flex gap-2 pt-4">
               <button
                 type="button"
                 onClick={() => {
                   setShowDisableModal(false);
                   setDisablePassword("");
                   setDisableMfaCode("");
                   setDisableBackupCode("");
                   setUseDisableBackupCode(false);
                 }}
                 className="flex-1 py-2 px-4 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
               >
                 キャンセル
               </button>
               <button
                 type="submit"
                 disabled={isLoading}
                 className="flex-1 py-2 px-4 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
               >
                 {isLoading ? '無効化中...' : 'MFAを無効にする'}
               </button>
             </div>
           </form>
         </div>
       </div>
     )}

     {/* バックアップコード表示モーダル（既存のまま） */}
     {showBackupCodes && (
       <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
         <div className="bg-white rounded-lg max-w-md w-full p-6">
           <h3 className="text-lg font-semibold mb-4">バックアップコード</h3>
           
           <div className="space-y-4">
             <p className="text-sm text-gray-600">
               これらのコードは認証アプリが利用できない場合に使用できます。各コードは一度のみ使用可能です。
             </p>
             
             <div className="bg-gray-50 p-4 rounded space-y-2">
               {backupCodes.map((code, index) => (
                 <div key={index} className="font-mono text-sm text-center">
                   {code}
                 </div>
               ))}
             </div>
             
             <p className="text-xs text-red-600">
               ⚠️ これらのコードを安全な場所に保存してください
             </p>
           </div>
           
           <div className="flex gap-2 pt-4">
             <button
               onClick={() => setShowBackupCodes(false)}
               className="flex-1 py-2 px-4 bg-gray-600 text-white rounded-md hover:bg-gray-700"
             >
               閉じる
             </button>
           </div>
         </div>
       </div>
     )}

     {/* バックアップコード再生成モーダル（既存のまま） */}
     {showRegenerateModal && (
       <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
         <div className="bg-white rounded-lg max-w-md w-full p-6">
           <h3 className="text-lg font-semibold mb-4 text-yellow-600">バックアップコード再生成</h3>
           
           <form onSubmit={regenerateBackupCodes} className="space-y-4">
             <p className="text-sm text-gray-600">
               新しいバックアップコードを生成します。古いコードは無効になります。
             </p>

             <div>
               <label className="block text-sm font-medium text-gray-700">認証アプリの6桁コード</label>
               <input
                 type="text"
                 maxLength={6}
                 value={regenerateMfaCode}
                 onChange={(e) => setRegenerateMfaCode(e.target.value.replace(/\D/g, ''))}
                 className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-yellow-500 focus:border-yellow-500 text-center font-mono"
                 placeholder="000000"
                 required
               />
             </div>
             
             <div className="flex gap-2 pt-4">
               <button
                 type="button"
                 onClick={() => {
                   setShowRegenerateModal(false);
                   setRegenerateMfaCode("");
                 }}
                 className="flex-1 py-2 px-4 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
               >
                 キャンセル
               </button>
               <button
                 type="submit"
                 disabled={isLoading || regenerateMfaCode.length !== 6}
                 className="flex-1 py-2 px-4 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 disabled:opacity-50"
               >
                 {isLoading ? '再生成中...' : '再生成'}
               </button>
             </div>
           </form>
         </div>
       </div>
     )}

     {/* 🆕 管理者作成モーダル */}
     {showCreateAdminModal && (
       <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
         <div className="bg-white rounded-lg max-w-md w-full p-6">
           <h3 className="text-lg font-semibold mb-4">新しい管理者アカウントを作成</h3>
           <form onSubmit={handleCreateAdmin} className="space-y-4">
             <div>
               <label className="block text-sm font-medium text-gray-700">ユーザー名</label>
               <input
                 type="text"
                 required
                 value={newAdmin.username}
                 onChange={(e) => setNewAdmin({...newAdmin, username: e.target.value})}
                 className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
               />
             </div>
             <div>
               <label className="block text-sm font-medium text-gray-700">メールアドレス</label>
               <input
                 type="email"
                 required
                 value={newAdmin.email}
                 onChange={(e) => setNewAdmin({...newAdmin, email: e.target.value})}
                 className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
               />
             </div>
             <div>
               <label className="block text-sm font-medium text-gray-700">パスワード</label>
               <input
                 type="password"
                 required
                 minLength={6}
                 value={newAdmin.password}
                 onChange={(e) => setNewAdmin({...newAdmin, password: e.target.value})}
                 className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
               />
             </div>
             <div className="flex gap-2 pt-4">
               <button
                 type="button"
                 onClick={() => setShowCreateAdminModal(false)}
                 className="flex-1 py-2 px-4 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
               >
                 キャンセル
               </button>
               <button
                 type="submit"
                 disabled={isLoading}
                 className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
               >
                 作成
               </button>
             </div>
           </form>
         </div>
       </div>
     )}

     {/* 🆕 パスワードリセットモーダル */}
     {showResetPasswordModal && (
       <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
         <div className="bg-white rounded-lg max-w-md w-full p-6">
           <h3 className="text-lg font-semibold mb-4">管理者パスワードをリセット</h3>
           <form onSubmit={handleResetPassword} className="space-y-4">
             <div>
               <label className="block text-sm font-medium text-gray-700">ユーザー名</label>
               <input
                 type="text"
                 required
                 value={resetForm.username}
                 onChange={(e) => setResetForm({...resetForm, username: e.target.value})}
                 className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
               />
             </div>
             <div>
               <label className="block text-sm font-medium text-gray-700">新しいパスワード</label>
               <input
                 type="password"
                 required
                 minLength={6}
                 value={resetForm.newPassword}
                 onChange={(e) => setResetForm({...resetForm, newPassword: e.target.value})}
                 className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
               />
             </div>
             <div className="flex gap-2 pt-4">
               <button
                 type="button"
                 onClick={() => setShowResetPasswordModal(false)}
                 className="flex-1 py-2 px-4 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
               >
                 キャンセル
               </button>
               <button
                 type="submit"
                 disabled={isLoading}
                 className="flex-1 py-2 px-4 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
               >
                 リセット
               </button>
             </div>
           </form>
         </div>
       </div>
     )}

     {/* 🆕 管理者一覧モーダル */}
     {showAdminListModal && (
       <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
         <div className="bg-white rounded-lg max-w-4xl w-full max-h-[80vh] overflow-y-auto p-6">
           <div className="flex justify-between items-center mb-4">
             <h3 className="text-lg font-semibold">管理者一覧</h3>
             <button
               onClick={() => setShowAdminListModal(false)}
               className="text-gray-400 hover:text-gray-600"
             >
               ✕
             </button>
           </div>
           <div className="overflow-x-auto">
             <table className="w-full text-sm">
               <thead className="bg-gray-50">
                 <tr>
                   <th className="px-4 py-2 text-left">ID</th>
                   <th className="px-4 py-2 text-left">ユーザー名</th>
                   <th className="px-4 py-2 text-left">メール</th>
                   <th className="px-4 py-2 text-left">権限</th>
                   <th className="px-4 py-2 text-left">ステータス</th>
                   <th className="px-4 py-2 text-left">MFA</th>
                   <th className="px-4 py-2 text-left">最終ログイン</th>
                 </tr>
               </thead>
               <tbody>
                 {adminList.map((admin) => (
                   <tr key={admin.id} className="border-t">
                     <td className="px-4 py-2">{admin.id}</td>
                     <td className="px-4 py-2 font-medium">{admin.username}</td>
                     <td className="px-4 py-2">{admin.email}</td>
                     <td className="px-4 py-2">
                       <span className="px-2 py-1 rounded text-xs bg-blue-100 text-blue-800">
                         管理者
                       </span>
                     </td>
                     <td className="px-4 py-2">
                       <span className={`px-2 py-1 rounded text-xs ${
                         admin.status === 'active' 
                           ? 'bg-green-100 text-green-800' 
                           : 'bg-gray-100 text-gray-800'
                       }`}>
                         {admin.status === 'active' ? 'アクティブ' : '無効'}
                       </span>
                     </td>
                     <td className="px-4 py-2">
                       <span className={`text-xs ${
                         admin.twoFactorEnabled ? 'text-green-600' : 'text-gray-400'
                       }`}>
                         {admin.twoFactorEnabled ? '🔐 有効' : '🔓 無効'}
                       </span>
                     </td>
                     <td className="px-4 py-2">
                       {admin.lastLogin 
                         ? new Date(admin.lastLogin).toLocaleString('ja-JP') 
                         : '未ログイン'
                       }
                     </td>
                   </tr>
                 ))}
               </tbody>
             </table>
           </div>
         </div>
       </div>
     )}
   </div>
 );
}