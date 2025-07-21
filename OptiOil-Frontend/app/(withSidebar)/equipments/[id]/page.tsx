/**
 * ファイルパス: app/equipments/[id]/page.tsx
 * 設備詳細ページ - 統一デザイン刷新版
 */

"use client";

import { useParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DocumentsTab from "../components/DocumentsTab";
import MaterialsTab from "../components/MaterialsTab";
import { Settings } from "lucide-react";

// 🎯 正しいパスで統一モーダル管理
import { useConfirmModal } from "../../common/components/ConfirmModal";

export default function EquipmentDetailPage() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  if (!id || isNaN(Number(id))) {
    return (
      <div className="fade-in">
        <div className="card-container text-center py-12">
          <div className="text-slate-600">
            <Settings className="w-16 h-16 mx-auto mb-4 text-slate-300" />
            <p className="text-lg mb-2 font-semibold text-red-600">エラー</p>
            <p className="text-sm font-medium">無効な設備IDです</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in">
      {/* ===== 統一ページヘッダー ===== */}
      <div className="page-header">
        <div>
          <h1 className="page-title text-slate-900 font-bold">
            <Settings className="page-title-icon" />
            設備詳細
          </h1>
          <p className="text-xs text-slate-600 mt-1">設備の関連資料と使用資材を管理できます。</p>
        </div>
      </div>

      {/* ===== メインコンテンツ ===== */}
      <Tabs defaultValue="documents" className="w-full">
        <TabsList className="mb-4 bg-slate-100 p-1">
          <TabsTrigger 
            value="documents" 
            className="data-[state=active]:bg-[#115e59] data-[state=active]:text-white data-[state=active]:shadow-sm text-xs px-3 py-2"
          >
            関連資料
          </TabsTrigger>
          <TabsTrigger 
            value="materials" 
            className="data-[state=active]:bg-[#115e59] data-[state=active]:text-white data-[state=active]:shadow-sm text-xs px-3 py-2"
          >
            使用資材
          </TabsTrigger>
        </TabsList>

        <TabsContent value="documents" className="mt-0">
          <DocumentsTab equipmentId={Number(id)} />
        </TabsContent>

        <TabsContent value="materials" className="mt-0">
          <MaterialsTab equipmentId={Number(id)} />
        </TabsContent>
      </Tabs>
    </div>
  );
}