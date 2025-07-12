/**
 * ファイルパス: app/(withSidebar)/common/components/ProtectedRoute.tsx
 * ページアクセス制御コンポーネント
 */

import { ReactNode } from 'react';
import { usePermissions } from '../hooks/usePermissions';
import { AlertTriangle, Lock, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

interface ProtectedRouteProps {
  permission: 'products' | 'orders' | 'equipment' | 'settings'; // ← settings追加
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
}

/**
 * ページレベルでの権限制御コンポーネント
 */
export function ProtectedRoute({ 
  permission, 
  children,
  fallbackTitle,
  fallbackMessage
}: ProtectedRouteProps) {
  const { canAccessProducts, canAccessOrders, canAccessEquipment, canAccessSettings, isLoading, user } = usePermissions();
  const router = useRouter();

  // ローディング中の表示
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500 mx-auto mb-4"></div>
          <p className="text-slate-500">権限を確認しています...</p>
        </div>
      </div>
    );
  }

  // 権限チェック
  let hasPermission = false;
  let pageName = '';
  
  switch (permission) {
    case 'products':
      hasPermission = canAccessProducts();
      pageName = '製品一覧';
      break;
    case 'orders':
      hasPermission = canAccessOrders();
      pageName = '注文履歴';
      break;
    case 'equipment':
      hasPermission = canAccessEquipment();
      pageName = '設備情報';
      break;
    case 'settings': // ← 追加
      hasPermission = canAccessSettings();
      pageName = '環境設定';
      break;
    default:
      hasPermission = false;
      pageName = 'このページ';
  }

  // 権限がある場合は通常表示
  if (hasPermission) {
    return <>{children}</>;
  }

  // アクセス拒否画面
  return (
    <div className="flex items-center justify-center min-h-[500px] px-4">
      <div className="max-w-md w-full text-center">
        {/* アイコン */}
        <div className="w-20 h-20 bg-amber-100 rounded-full mx-auto mb-6 flex items-center justify-center">
          <Lock className="w-10 h-10 text-amber-600" />
        </div>

        {/* タイトル */}
        <h2 className="text-2xl font-bold text-slate-800 mb-3">
          {fallbackTitle || 'アクセス権限がありません'}
        </h2>

        {/* メッセージ */}
        <div className="text-slate-600 mb-6 space-y-2">
          <p>
            {fallbackMessage || `${pageName}にアクセスする権限がありません。`}
          </p>
          <p className="text-sm">
            管理者に権限の付与を依頼してください。
          </p>
        </div>

        {/* ユーザー情報 */}
        <div className="bg-slate-50 rounded-lg p-4 mb-6 text-left">
          <div className="text-sm text-slate-500 mb-2">現在のアカウント</div>
          <div className="font-medium text-slate-700">{user?.name}</div>
          <div className="text-sm text-slate-500">{user?.email}</div>
          <div className="text-xs text-slate-400 mt-1">
            {user?.systemRole === 'main' ? 'メインアカウント' : 'サブアカウント'}
          </div>
        </div>

        {/* 権限状況 */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span className="font-medium text-amber-800">権限状況</span>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>製品一覧:</span>
              <span className={canAccessProducts() ? 'text-teal-600' : 'text-red-600'}>
                {canAccessProducts() ? '✓' : '✗'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>注文履歴:</span>
              <span className={canAccessOrders() ? 'text-teal-600' : 'text-red-600'}>
                {canAccessOrders() ? '✓' : '✗'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>設備情報:</span>
              <span className={canAccessEquipment() ? 'text-teal-600' : 'text-red-600'}>
                {canAccessEquipment() ? '✓' : '✗'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>環境設定:</span>
              <span className={canAccessSettings() ? 'text-teal-600' : 'text-red-600'}>
                {canAccessSettings() ? '✓' : '✗'}
              </span>
            </div>
          </div>
        </div>

        {/* 戻るボタン */}
        <Button
          onClick={() => router.back()}
          
          className="w-full"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          前のページに戻る
        </Button>
      </div>
    </div>
  );
}