/**
 * ファイルパス: app/(withSidebar)/common/components/PermissionGate.tsx
 * 権限制御コンポーネント
 */

import { ReactNode } from 'react';
import { usePermissions } from '../hooks/usePermissions';

interface PermissionGateProps {
  permission: 'products' | 'orders' | 'equipment' | 'settings'; // ← settings追加
  children: ReactNode;
  fallback?: ReactNode;
  showForMainOnly?: boolean; // メインアカウントのみ表示
}

/**
 * 権限に基づいてコンテンツを表示/非表示するコンポーネント
 */
export function PermissionGate({ 
  permission, 
  children, 
  fallback = null,
  showForMainOnly = false
}: PermissionGateProps) {
  const { canAccessProducts, canAccessOrders, canAccessEquipment, canAccessSettings, isMainAccount, isLoading } = usePermissions();

  // ローディング中は何も表示しない
  if (isLoading) {
    return null;
  }

  // メインアカウント限定の場合
  if (showForMainOnly && !isMainAccount) {
    return <>{fallback}</>;
  }

  // 権限チェック
  let hasPermission = false;
  switch (permission) {
    case 'products':
      hasPermission = canAccessProducts();
      break;
    case 'orders':
      hasPermission = canAccessOrders();
      break;
    case 'equipment':
      hasPermission = canAccessEquipment();
      break;
    case 'settings': // ← 追加
      hasPermission = canAccessSettings();
      break;
    default:
      hasPermission = false;
  }

  return hasPermission ? <>{children}</> : <>{fallback}</>;
}

/**
 * 複数の権限をチェックするコンポーネント（AND条件）
 */
interface MultiPermissionGateProps {
  permissions: Array<'products' | 'orders' | 'equipment' | 'settings'>; // ← settings追加
  children: ReactNode;
  fallback?: ReactNode;
  mode?: 'all' | 'any'; // all: 全ての権限が必要, any: いずれかの権限があればOK
}

export function MultiPermissionGate({ 
  permissions, 
  children, 
  fallback = null,
  mode = 'all'
}: MultiPermissionGateProps) {
  const { canAccessProducts, canAccessOrders, canAccessEquipment, canAccessSettings, isLoading } = usePermissions();

  if (isLoading) {
    return null;
  }

  const checkResults = permissions.map(permission => {
    switch (permission) {
      case 'products':
        return canAccessProducts();
      case 'orders':
        return canAccessOrders();
      case 'equipment':
        return canAccessEquipment();
      case 'settings': // ← 追加
        return canAccessSettings();
      default:
        return false;
    }
  });

  const hasPermission = mode === 'all' 
    ? checkResults.every(result => result)
    : checkResults.some(result => result);

  return hasPermission ? <>{children}</> : <>{fallback}</>;
}

/**
 * メインアカウント専用コンポーネント
 */
interface MainAccountOnlyProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export function MainAccountOnly({ children, fallback = null }: MainAccountOnlyProps) {
  const { isMainAccount, isLoading } = usePermissions();

  if (isLoading) {
    return null;
  }

  return isMainAccount ? <>{children}</> : <>{fallback}</>;
}