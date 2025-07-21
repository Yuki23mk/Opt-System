//サイドバー、カート、ナビゲーション付きレイアウト - 収納機能対応版
"use client";

import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import { Menu, X } from "lucide-react";
import { CartProvider } from "@/app/(withSidebar)/common/contexts/CartContext";
import GlobalCartButton from "@/app/(withSidebar)/common/components/GlobalCartButton";
import { ConfirmModalProvider } from "./common/components/ConfirmModal";
import { useSessionTimeout } from "./common/hooks/useSessionTimeout"; // 🆕 追加

export default function WithSidebarLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false); // モバイル用
  const [isCollapsed, setIsCollapsed] = useState(false); // PC用収納状態

  // 🆕 セッションタイムアウトチェックを有効化
  useSessionTimeout();

  return (
    <CartProvider>
      <ConfirmModalProvider>
        <div className="flex h-screen w-full overflow-hidden text-sm relative">
          {/* モバイル用メニューボタン */}
          <button
            onClick={() => setOpen(!open)}
            className="sm:hidden absolute top-4 left-4 z-50 bg-[#115e59] text-white p-2 rounded-lg hover:bg-[#0f766e] transition-colors shadow-lg"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* モバイル用サイドバー */}
          {open && (
            <div
              className="sm:hidden fixed inset-0 z-40 bg-black bg-opacity-50"
              onClick={() => setOpen(false)}
            >
              <div
                className="bg-[#115e59] w-64 h-full relative"
                onClick={(e) => e.stopPropagation()}
              >
                {/* モバイル用閉じるボタン */}
                <button
                  onClick={() => setOpen(false)}
                  className="absolute top-4 right-4 text-white hover:bg-[#0f766e] p-2 rounded-lg transition-colors z-10"
                >
                  <X className="w-5 h-5" />
                </button>
                <Sidebar />
              </div>
            </div>
          )}

          {/* PC用サイドバー - 収納機能付き */}
          <aside className={`hidden sm:block shrink-0 transition-all duration-300 ${isCollapsed ? 'w-16' : 'w-64'}`}>
            <Sidebar 
              isCollapsed={isCollapsed} 
              onToggle={() => setIsCollapsed(!isCollapsed)} 
            />
          </aside>

          {/* メインエリア - サイドバー幅に応じて調整 */}
          <main className={`flex-1 overflow-auto min-w-0 bg-white transition-all duration-300 ${isCollapsed ? 'sm:ml-0' : 'sm:ml-0'}`}>
            {/* 統一コンテンツコンテナ */}
            <div className="flex flex-col items-center min-h-full">
              <div className="page-container relative">
                {/* カートボタン：統一位置管理 */}
                <div className="absolute top-6 right-6 z-30">
                  <div className="min-w-[120px]">
                    <GlobalCartButton />
                  </div>
                </div>
                
                {/* ページコンテンツ：統一パディングクラス適用 */}
                <div className="page-content sm:pl-6">
                  {children}
                </div>
              </div>
            </div>
          </main>
        </div>
      </ConfirmModalProvider>
    </CartProvider>
  );
}