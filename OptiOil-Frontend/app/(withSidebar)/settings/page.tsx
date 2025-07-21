/**
 * ファイルパス: app/(withSidebar)/settings/page.tsx
 * 環境設定ページ - 統一デザイン刷新版 - Suspense境界修正
 */

"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import DeliveryAddressTab from "@/components/settings/DeliveryAddressTab";
import { ProtectedRoute } from "../common/components/ProtectedRoute";
import { Settings } from "lucide-react";

// 🔧 useSearchParams()を使用する部分のみを分離
function SettingsContent() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState("delivery");

  // URLパラメータからタブを設定
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && ["delivery", "security", "notifications"].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  return (
    <>
      {/* ===== 統一ページヘッダー ===== */}
      <div className="page-header">
        <div>
          <h1 className="page-title text-slate-900 font-bold">
            <Settings className="page-title-icon" />
            環境設定
          </h1>
        </div>
      </div>

      {/* ===== メインコンテンツ ===== */}
      {/* タブを削除して直接配送先管理を表示 */}
      <DeliveryAddressTab /> 
    </>
  );
}

// 🔧 ローディング用コンポーネント
function SettingsLoading() {
  return (
    <>
      {/* ===== 統一ページヘッダー ===== */}
      <div className="page-header">
        <div>
          <h1 className="page-title text-slate-900 font-bold">
            <Settings className="page-title-icon" />
            環境設定
          </h1>
        </div>
      </div>

      {/* ローディング状態 */}
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-700"></div>
      </div>
    </>
  );
}

// 🔧 メインコンポーネント - Suspense境界を追加
export default function SettingsPage() {
  return (
    <ProtectedRoute permission="products">
      <div className="fade-in">
        <Suspense fallback={<SettingsLoading />}>
          <SettingsContent />
        </Suspense>
      </div>
    </ProtectedRoute>
  );
}