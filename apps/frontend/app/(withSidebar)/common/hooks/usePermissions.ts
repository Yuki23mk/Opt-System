/**
 * ファイルパス: app/(withSidebar)/common/hooks/usePermissions.ts
 * サブアカウント権限管理フック（JWT期限切れ対応版）
 */

import { useState, useEffect } from 'react';
import { ENV } from '@/lib/env';

export interface UserPermissions {
  products: boolean;
  orders: boolean;
  equipment: boolean;
  settings: boolean;
}

export interface UserProfile {
  id: number;
  email: string;
  name: string;
  systemRole: string;
  permissions?: UserPermissions;
  companyId: number;
  department?: string;
  position?: string;
  phone?: string;
}

interface UsePermissionsReturn {
  user: UserProfile | null;
  permissions: UserPermissions;
  isMainAccount: boolean;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  
  // 権限チェック関数
  canAccessProducts: () => boolean;
  canAccessOrders: () => boolean;
  canAccessEquipment: () => boolean;
  canAccessSettings: () => boolean;
}

// ★★★ デフォルト権限をtrueに戻す
const DEFAULT_PERMISSIONS: UserPermissions = {
  products: true,
  orders: true,
  equipment: true,
  settings: true,
};

export function usePermissions(): UsePermissionsReturn {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUserProfile = async () => {
    try {
      setIsLoading(true);
      setError(null);

      let token: string | null = localStorage.getItem("token");
      
      // トークン取得のリトライ
      let retries = 5;
      while (!token && retries > 0) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        token = localStorage.getItem("token");
        retries--;
      }

      if (!token) {
        throw new Error("認証トークンが見つかりません");
      }

      const res = await fetch(`${ENV.API_URL}/api/auth/me_get`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
      });

      // 🔥 JWT期限切れ対応
      if (res.status === 401) {
        console.log("🔑 [AUTH] トークン期限切れ - ログインページへリダイレクト");
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        
        // ログインページへリダイレクト
        const FRONTEND_URL = ENV.FRONTEND_URL;
        window.location.href = `${FRONTEND_URL}/login?expired=true`;
        return;
      }

      if (!res.ok) {
        throw new Error(`ユーザー情報の取得に失敗しました (${res.status})`);
      }

      const data = await res.json();
      const userData = data.user ?? data;

      // ★★★ デバッグログ（必要に応じて削除）
      console.log("📥 [API] 取得したユーザーデータ:", userData);
      console.log("🔑 [AUTH] systemRole:", userData.systemRole);
      console.log("🛡️ [PERM] 生のpermissions:", userData.permissions);

      // permissions が JSON 文字列の場合はパース
      let permissions: UserPermissions = DEFAULT_PERMISSIONS;
      if (userData.permissions !== null && userData.permissions !== undefined) {
        try {
          permissions = typeof userData.permissions === 'string' 
            ? JSON.parse(userData.permissions) 
            : userData.permissions;
          
          console.log("✅ [PERM] パース後のpermissions:", permissions);
        } catch (e) {
          console.warn("⚠️ [PERM] 権限情報のパースに失敗:", e);
          permissions = DEFAULT_PERMISSIONS;
        }
      } else {
        console.log("ℹ️ [PERM] permissions未設定 - デフォルト権限を使用");
        permissions = DEFAULT_PERMISSIONS;
      }

      const userProfile: UserProfile = {
        id: userData.id,
        email: userData.email,
        name: userData.name,
        systemRole: userData.systemRole || 'user',
        permissions,
        companyId: userData.companyId,
        department: userData.department,
        position: userData.position,
        phone: userData.phone,
      };

      console.log("👤 [USER] 最終的なuserProfile:", userProfile);

      setUser(userProfile);

    } catch (err: any) {
      console.error("❌ [ERROR] ユーザー情報取得エラー:", err);
      
      // 🔥 ネットワークエラーの場合はリトライを提案
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        setError("ネットワークエラーが発生しました。インターネット接続を確認してください。");
      } else if (err.message.includes('401')) {
        // 401エラーの場合は既にリダイレクト処理済み
        setError("認証が必要です。ログインページに移動します。");
      } else {
        setError(err.message || "ユーザー情報の取得に失敗しました");
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUserProfile();
  }, []);

  // 権限チェック関数
  const canAccessProducts = () => {
    if (!user) return false;
    
    // ★★★ メインアカウント判定を修正
    if (user.systemRole === 'main') return true;
    
    const result = user.permissions?.products ?? DEFAULT_PERMISSIONS.products;
    console.log(`🔍 [CHECK] canAccessProducts (${user.systemRole}):`, result);
    return result;
  };

  const canAccessOrders = () => {
    if (!user) return false;
    if (user.systemRole === 'main') return true;
    
    const result = user.permissions?.orders ?? DEFAULT_PERMISSIONS.orders;
    console.log(`🔍 [CHECK] canAccessOrders (${user.systemRole}):`, result);
    return result;
  };

  const canAccessEquipment = () => {
    if (!user) return false;
    if (user.systemRole === 'main') return true;
    
    const result = user.permissions?.equipment ?? DEFAULT_PERMISSIONS.equipment;
    console.log(`🔍 [CHECK] canAccessEquipment (${user.systemRole}):`, result);
    return result;
  };

  const canAccessSettings = () => {
    if (!user) return false;
    if (user.systemRole === 'main') return true;
    
    const result = user.permissions?.settings ?? DEFAULT_PERMISSIONS.settings;
    console.log(`🔍 [CHECK] canAccessSettings (${user.systemRole}):`, result);
    return result;
  };

  const permissions = user?.permissions ?? DEFAULT_PERMISSIONS;
  const isMainAccount = user?.systemRole === 'main';

  return {
    user,
    permissions,
    isMainAccount,
    isLoading,
    error,
    refetch: fetchUserProfile,
    canAccessProducts,
    canAccessOrders,
    canAccessEquipment,
    canAccessSettings,
  };
}