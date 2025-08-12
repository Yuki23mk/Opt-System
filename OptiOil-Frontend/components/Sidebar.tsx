/**
 * ファイル: components/Sidebar.tsx
 * 収納機能付きベタ塗りティールデザインサイドバー（リアルタイム承認件数更新対応版）
 */

"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Package, 
  ShoppingCart, 
  Settings, 
  LineChart, 
  Settings2, 
  User,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,  // 🆕 承認アイコン
  AlertCircle    // 🆕 承認待ちアイコン
} from "lucide-react";
import { PermissionGate } from "../app/(withSidebar)/common/components/PermissionGate";
import { ENV } from '@/lib/env';

// ユーザー情報の型定義
interface UserInfo {
  name: string;
  email: string;
  systemRole: string;          // 🆕 承認権限判定用
  permissions: any;            // 🆕 承認権限判定用
}

interface SidebarProps {
  isCollapsed?: boolean;
  onToggle?: () => void;
}

export default function Sidebar({ isCollapsed = false, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState<number>(0); // 🆕 承認待ち件数

  // 🆕 承認権限があるかどうかを判定
  const hasApprovalPermission = () => {
    if (!userInfo) return false;
    
    // メインアカウントは常に承認権限あり
    if (userInfo.systemRole === 'main') return true;
    
    // サブアカウント（child）の場合は permissions.orderApproval.canApprove をチェック
    if (userInfo.systemRole === 'child') {
      return userInfo.permissions?.orderApproval?.canApprove === true;
    }
    
    return false;
  };

  // 🆕 承認待ち件数を取得
  const fetchPendingApprovalsCount = async () => {
    if (!hasApprovalPermission()) return;
    
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const response = await fetch(`${ENV.API_URL}/api/orders/pending-approvals?sortBy=requestedAt&sortOrder=desc`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setPendingApprovalsCount(data.totalCount || 0);
      }
    } catch (error) {
      console.error('承認待ち件数の取得に失敗:', error);
    }
  };

  // ユーザー情報を取得
  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) return;

        // APIからユーザー詳細情報を取得（既存のme_getエンドポイントを使用）
        const API_URL = ENV.API_URL;
        const response = await fetch(`${API_URL}/api/auth/me_get`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          const userData = data.user;
          setUserInfo({
            name: userData.name || 'ユーザー',
            email: userData.email || '',
            systemRole: userData.systemRole || 'child',      // 🔧 修正: デフォルトをchildに
            permissions: userData.permissions || {}         // 🆕 追加
          });
        } else {
          console.error('ユーザー情報取得エラー:', response.status);
          setUserInfo({
            name: 'ユーザー',
            email: '',
            systemRole: 'child',  // 🔧 修正: デフォルトをchildに
            permissions: {}
          });
        }
      } catch (error) {
        console.error('ユーザー情報の取得に失敗:', error);
        setUserInfo({
          name: 'ユーザー',
          email: '',
          systemRole: 'child',  // 🔧 修正: デフォルトをchildに
          permissions: {}
        });
      }
    };

    fetchUserInfo();
  }, []);

  // 🆕 ユーザー情報取得後に承認待ち件数を取得
  useEffect(() => {
    if (userInfo && hasApprovalPermission()) {
      fetchPendingApprovalsCount();
      
      // 5分ごとに承認待ち件数を更新
      const interval = setInterval(fetchPendingApprovalsCount, 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [userInfo]);

  // 🆕 承認処理完了時のリアルタイム更新
  useEffect(() => {
    const handleApprovalCountChanged = () => {
      // 承認処理が完了した際に件数を再取得
      if (hasApprovalPermission()) {
        fetchPendingApprovalsCount();
      }
    };

    // カスタムイベントをリスン
    window.addEventListener('approvalCountChanged', handleApprovalCountChanged);

    return () => {
      window.removeEventListener('approvalCountChanged', handleApprovalCountChanged);
    };
  }, [userInfo]); // userInfoが変更された時に再設定

  // アクティブ状態の判定
  const isActive = (path: string) => pathname === path;

  // ナビゲーション項目のスタイル - ベタ塗り仕様
  const getNavItemClass = (path: string) => {
    const baseClass = `flex items-center transition-colors font-medium ${
      isCollapsed ? 'px-4 py-3 justify-center' : 'px-6 py-3'
    }`;
    
    if (isActive(path)) {
      // 選択中：より濃いティール色でベタ塗り
      return `${baseClass} bg-[#0f766e] text-white`;
    }
    
    // 通常状態：白文字、ホバーで中間色
    return `${baseClass} text-white hover:bg-[#13726b]`;
  };

  return (
    <aside className={`bg-[#115e59] h-screen fixed left-0 top-0 flex flex-col transition-all duration-300 ${
      isCollapsed ? 'w-16' : 'w-64'
    }`}>
      {/* ロゴエリア + 収納ボタン */}
      <div className={`border-b border-[#0f766e] relative ${isCollapsed ? 'p-2' : 'p-4'}`}>
        {isCollapsed ? (
          <div className="flex justify-center">
            <Image
              src="/M-logo-white.png"
              alt="Opt. Logo"
              width={32}
              height={32}
              className="w-8 h-8 object-contain"
            />
          </div>
        ) : (
          <div className="flex justify-center">
            <Image
              src="/opt-logo-white.png"
              alt="Opt. Logo"
              width={120}
              height={40}
              className="h-10 object-contain"
            />
          </div>
        )}
        
        {/* 収納トグルボタン */}
        {onToggle && (
          <button
            onClick={onToggle}
            className="absolute -right-3 top-1/2 transform -translate-y-1/2 bg-[#115e59] border-2 border-[#0f766e] rounded-full p-1 text-white hover:bg-[#0f766e] transition-colors"
            title={isCollapsed ? 'サイドバーを展開' : 'サイドバーを収納'}
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        )}
      </div>
      
      {/* ナビゲーション */}
      <nav className="flex-1 py-4">
        <div className="space-y-1">
          {/* 製品一覧 */}
          <PermissionGate permission="products">
            <Link 
              href="/products" 
              className={getNavItemClass("/products")}
              title={isCollapsed ? '製品一覧' : ''}
            >
              <Package className="w-5 h-5 shrink-0" />
              {!isCollapsed && <span className="ml-3">製品一覧</span>}
            </Link>
          </PermissionGate>
          
          {/* 注文履歴 */}
          <PermissionGate permission="orders">
            <Link 
              href="/orders" 
              className={getNavItemClass("/orders")}
              title={isCollapsed ? '注文履歴' : ''}
            >
              <ShoppingCart className="w-5 h-5 shrink-0" />
              {!isCollapsed && <span className="ml-3">注文履歴</span>}
            </Link>
          </PermissionGate>

          {/* 🆕 承認待ち（承認権限のあるユーザーのみ表示） */}
          {hasApprovalPermission() && (
            <Link 
              href="/approval" 
              className={getNavItemClass("/approval")}
              title={isCollapsed ? '承認待ち' : ''}
            >
              <div className="relative flex items-center">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                {/* 承認待ち件数バッジ（収納時のみ表示） */}
                {pendingApprovalsCount > 0 && isCollapsed && (
                  <div className="absolute -top-1 -right-1 bg-amber-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
                    {pendingApprovalsCount > 9 ? '9+' : pendingApprovalsCount}
                  </div>
                )}
              </div>
              {!isCollapsed && (
                <div className="ml-3 flex items-center justify-between flex-1">
                  <span>承認待ち</span>
                  {pendingApprovalsCount > 0 && (
                    <div className="bg-amber-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                      {pendingApprovalsCount > 9 ? '9+' : pendingApprovalsCount}
                    </div>
                  )}
                </div>
              )}
            </Link>
          )}
          
          {/* 設備情報 */}
          <PermissionGate permission="equipment">
            <Link 
              href="/equipments" 
              className={getNavItemClass("/equipments")}
              title={isCollapsed ? '設備情報' : ''}
            >
              <Settings className="w-5 h-5 shrink-0" />
              {!isCollapsed && <span className="ml-3">設備情報</span>}
            </Link>
          </PermissionGate>
          
          {/* データモニター */}
          <Link 
            href="/data-monitor" 
            className={getNavItemClass("/data-monitor")}
            title={isCollapsed ? 'データモニター' : ''}
          >
            <LineChart className="w-5 h-5 shrink-0" />
            {!isCollapsed && <span className="ml-3">データモニター</span>}
          </Link>
          
          {/* 区切り線 */}
          <div className={`h-px bg-[#0f766e] my-4 ${isCollapsed ? 'mx-2' : 'mx-6'}`}></div>
          
          {/* 環境設定 */}
          <PermissionGate permission="settings">
            <Link 
              href="/settings" 
              className={getNavItemClass("/settings")}
              title={isCollapsed ? '環境設定' : ''}
            >
              <Settings2 className="w-5 h-5 shrink-0" />
              {!isCollapsed && <span className="ml-3">環境設定</span>}
            </Link>
          </PermissionGate>
          
          {/* アカウント */}
          <Link 
            href="/account" 
            className={getNavItemClass("/account")}
            title={isCollapsed ? 'アカウント' : ''}
          >
            <User className="w-5 h-5 shrink-0" />
            {!isCollapsed && <span className="ml-3">アカウント</span>}
          </Link>
        </div>
      </nav>
      
      {/* ユーザー情報 */}
      <div className={`border-t border-[#0f766e] ${isCollapsed ? 'p-2' : 'p-4'}`}>
        {isCollapsed ? (
          <div className="flex justify-center">
            <div className="w-10 h-10 bg-[#0f766e] rounded-full flex items-center justify-center" title={userInfo?.name || 'ユーザー'}>
              <User className="w-5 h-5 text-white" />
            </div>
          </div>
        ) : (
          <div className="flex items-center">
            <div className="w-10 h-10 bg-[#0f766e] rounded-full flex items-center justify-center mr-3 shrink-0">
              <User className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-medium truncate">
                {userInfo?.name || 'ログイン中...'}
              </p>
              <div className="flex items-center space-x-2">
                <p className="text-teal-200 text-xs truncate">
                  {userInfo?.email || ''}
                </p>
                {/* 🆕 承認権限バッジ */}
                {hasApprovalPermission() && (
                  <div className="bg-amber-500 text-white text-xs px-1 rounded" title="承認権限あり">
                    注文承認者
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}