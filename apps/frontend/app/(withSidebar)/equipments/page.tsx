"use client";

import DocumentsTab from "./components/DocumentsTab";
import MaterialsTab from "./components/MaterialsTab";
import EquipmentFormModal from "./components/EquipmentFormModal"; // 🆕 統一モーダル
import { Button } from "../../../components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../../components/ui/tabs";
import Link from "next/link";
import React, { useEffect, useState } from "react";
import { Settings, Plus, Trash2, Search, Filter, ArrowUpDown, Edit } from "lucide-react";
import { ENV } from '@/lib/env';

// 共通コンポーネント導入
import { useNotification } from "@/app/(withSidebar)/common/hooks/useNotification";
import { ToastContainer } from "@/app/(withSidebar)/common/components/Toast";
import { useConfirmModal } from "@/app/(withSidebar)/common/components/ConfirmModal";
import { ProtectedRoute } from "../common/components/ProtectedRoute";

interface Equipment {
  id: number;
  code: string;
  category: string;
  name: string;
  manufacturer: string;
  location: string;
  manager: string;
  createdAt: string;
}

// ソート用の型定義
type SortField = 'code' | 'name' | 'category' | 'manufacturer' | 'location' | 'manager' | 'createdAt';
type SortOrder = 'asc' | 'desc';

export default function EquipmentPage() {
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // ソート状態
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // モーダル状態（新規・編集共通）
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<Equipment | null>(null);

  // 共通通知システム
  const notification = useNotification();
  const { openConfirm, setLoading } = useConfirmModal();
  // 環境変数
  const API_URL = ENV.API_URL;
  const FRONTEND_URL = ENV.FRONTEND_URL;

  const fetchEquipments = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/api/equipments`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json)) {
          setEquipments(json);
        }
      } else {
        console.error("設備取得失敗", await res.text());
        notification.error('設備データの取得に失敗しました');
      }
    } catch (error) {
      console.error('設備取得エラー:', error);
      notification.error('設備データの取得に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEquipments();
  }, []);

  // 新規モーダルを開く
  const handleNew = () => {
    setEditingEquipment(null);
    setFormModalOpen(true);
  };

  // 編集モーダルを開く
  const handleEdit = (equipment: Equipment) => {
    setEditingEquipment(equipment);
    setFormModalOpen(true);
  };

  // 成功時の処理（新規・編集共通）
  const handleFormSuccess = () => {
    const isEditMode = !!editingEquipment;
    notification.success(
      isEditMode ? '設備情報を更新しました' : '設備を登録しました'
    );
    fetchEquipments(); // データを再取得
  };

  // エラー時の処理（新規・編集共通）
  const handleFormError = (message: string) => {
    notification.error(message);
  };

  // ソート機能
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // ソートアイコンの表示
  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-4 h-4 text-slate-400" />;
    }
    return (
      <ArrowUpDown 
        className={`w-4 h-4 ${sortOrder === 'asc' ? 'text-[#115e59] rotate-180' : 'text-[#115e59]'}`} 
      />
    );
  };

  // フィルタリング＆ソート処理
  const filteredAndSortedEquipments = equipments
    .filter(equipment => {
      const matchesSearch = equipment.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           equipment.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           equipment.manufacturer.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
    })
    .sort((a, b) => {
      let aValue: string | number = a[sortField];
      let bValue: string | number = b[sortField];
      
      // 日付の場合は数値比較
      if (sortField === 'createdAt') {
        aValue = new Date(aValue as string).getTime();
        bValue = new Date(bValue as string).getTime();
      } else {
        // 文字列の場合は大文字小文字を無視して比較
        aValue = (aValue as string).toLowerCase();
        bValue = (bValue as string).toLowerCase();
      }
      
      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

  // 削除機能（統一確認モーダル使用）
  const handleDelete = async (equipment: Equipment) => {
    openConfirm({
      title: '設備の削除',
      message: `設備「${equipment.name}」を削除しますか？\n関連する資材や書類も一緒に削除されます。\nこの操作は取り消せません。`,
      confirmText: '削除する',
      cancelText: 'キャンセル',
      type: 'danger',
      onConfirm: async () => {
        try {
          setLoading(true);
          const token = localStorage.getItem("token");

          const res = await fetch(`${ENV.API_URL}/api/equipments/${equipment.id}`, {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          if (res.ok) {
            setEquipments((prev) => prev.filter((item) => item.id !== equipment.id));
            notification.success(`設備「${equipment.name}」を削除しました`);
          } else {
            const errorData = await res.json();
            throw new Error(errorData.message || '削除に失敗しました');
          }
        } catch (error: any) {
          console.error('設備削除エラー:', error);
          notification.error(error.message || '設備の削除に失敗しました');
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const toggleTab = (id: number) => {
    setSelectedId((prev) => (prev === id ? null : id));
  };

  return (
    <ProtectedRoute permission="equipment">
      <div className="fade-in">
        {/* ===== 統一ページヘッダー ===== */}
        <div className="page-header">
          <h1 className="page-title text-slate-900 font-bold">
            <Settings className="page-title-icon" />
            設備情報
          </h1>
          <div className="page-actions">
            <button 
              onClick={handleNew}
              className="bg-[#115e59] hover:bg-[#0f766e] text-white px-4 py-2 rounded-md font-medium text-sm flex items-center gap-2 transition-colors"
            >
              <Plus className="w-4 h-4" />
              新規設備
            </button>
          </div>
        </div>

        {/* ===== 検索エリア ===== */}
        {equipments.length > 0 && (
          <div className="mb-4">
            <div className="relative w-80">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="設備名、コード、メーカーで検索..."
                className="w-full pl-10 pr-4 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-[#115e59] focus:ring-1 focus:ring-[#115e59] bg-white"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* ===== メインコンテンツ ===== */}
        {isLoading ? (
          <div className="card-container text-center py-8">
            <div className="loading-spinner mx-auto mb-2"></div>
            <p className="text-slate-500 font-medium">読み込み中...</p>
          </div>
        ) : equipments.length === 0 ? (
          <div className="card-container text-center py-12">
            <div className="text-slate-600">
              <Settings className="w-16 h-16 mx-auto mb-4 text-slate-300" />
              <p className="text-lg mb-2 font-semibold">設備が登録されていません</p>
              <p className="text-sm font-medium mb-6">新規設備を追加してください</p>
              {/* 設備が0件の場合は上のヘッダーのボタンのみで十分なので、こちらのボタンは削除 */}
            </div>
          </div>
        ) : (
          <div className="table-container">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead 
                    className="bg-[#115e59] text-white px-3 py-2 text-xs font-semibold cursor-pointer hover:bg-[#0f766e] transition-colors"
                    onClick={() => handleSort('code')}
                  >
                    <div className="flex items-center justify-between">
                      No.
                      {getSortIcon('code')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="bg-[#115e59] text-white px-3 py-2 text-xs font-semibold cursor-pointer hover:bg-[#0f766e] transition-colors"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center justify-between">
                      設備名
                      {getSortIcon('name')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="bg-[#115e59] text-white px-3 py-2 text-xs font-semibold cursor-pointer hover:bg-[#0f766e] transition-colors"
                    onClick={() => handleSort('category')}
                  >
                    <div className="flex items-center justify-between">
                      設備種類
                      {getSortIcon('category')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="bg-[#115e59] text-white px-3 py-2 text-xs font-semibold cursor-pointer hover:bg-[#0f766e] transition-colors"
                    onClick={() => handleSort('manufacturer')}
                  >
                    <div className="flex items-center justify-between">
                      メーカー
                      {getSortIcon('manufacturer')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="bg-[#115e59] text-white px-3 py-2 text-xs font-semibold cursor-pointer hover:bg-[#0f766e] transition-colors"
                    onClick={() => handleSort('location')}
                  >
                    <div className="flex items-center justify-between">
                      配置
                      {getSortIcon('location')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="bg-[#115e59] text-white px-3 py-2 text-xs font-semibold cursor-pointer hover:bg-[#0f766e] transition-colors"
                    onClick={() => handleSort('manager')}
                  >
                    <div className="flex items-center justify-between">
                      担当者
                      {getSortIcon('manager')}
                    </div>
                  </TableHead>
                  <TableHead className="bg-[#115e59] text-white px-3 py-2 text-xs font-semibold text-center w-[120px]">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedEquipments.map((item) => (
                  <React.Fragment key={item.id}>
                    <TableRow
                      onClick={() => toggleTab(item.id)}
                      className="cursor-pointer hover:bg-slate-50 transition-colors"
                    >
                      <TableCell className="px-3 py-2 text-xs text-slate-900 font-medium border-b border-slate-100">{item.code}</TableCell>
                      <TableCell className="px-3 py-2 text-xs font-semibold text-slate-900 border-b border-slate-100">{item.name}</TableCell>
                      <TableCell className="px-3 py-2 text-xs text-slate-700 border-b border-slate-100">{item.category}</TableCell>
                      <TableCell className="px-3 py-2 text-xs text-slate-700 border-b border-slate-100">{item.manufacturer}</TableCell>
                      <TableCell className="px-3 py-2 text-xs text-slate-700 border-b border-slate-100">{item.location}</TableCell>
                      <TableCell className="px-3 py-2 text-xs text-slate-700 border-b border-slate-100">{item.manager}</TableCell>
                      <TableCell className="px-3 py-2 text-center border-b border-slate-100">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(item);
                            }}
                            className="text-[#115e59] hover:text-[#0f766e] transition-colors p-1"
                            title={`設備「${item.name}」を編集`}
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(item);
                            }}
                            className="text-red-500 hover:text-red-700 transition-colors p-1"
                            title={`設備「${item.name}」を削除`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {selectedId === item.id && (
                      <TableRow>
                        <TableCell colSpan={7} className="p-4 bg-slate-50">
                          <Tabs defaultValue="documents">
                            <TabsList className="mb-4">
                              <TabsTrigger value="documents" className="text-xs font-medium">関連資料</TabsTrigger>
                              <TabsTrigger value="materials" className="text-xs font-medium">使用資材</TabsTrigger>
                            </TabsList>
                            <TabsContent value="documents" className="mt-0">
                              <DocumentsTab equipmentId={item.id} />
                            </TabsContent>
                            <TabsContent value="materials" className="mt-0">
                              <MaterialsTab equipmentId={item.id} />
                            </TabsContent>
                          </Tabs>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
            
            {/* 検索結果が空の場合 */}
            {filteredAndSortedEquipments.length === 0 && equipments.length > 0 && (
              <div className="text-center py-8 text-slate-500">
                <Search className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p className="font-medium">検索条件に一致する設備が見つかりません</p>
                <p className="text-xs mt-1">検索条件を変更してお試しください</p>
              </div>
            )}
          </div>
        )}

        {/* 共通通知システム */}
        <ToastContainer 
          toasts={notification.toasts} 
          onClose={notification.removeToast} 
          position="top-right"
        />

        {/* 新規・編集共通モーダル */}
        <EquipmentFormModal
          isOpen={formModalOpen}
          onClose={() => {
            setFormModalOpen(false);
            setEditingEquipment(null);
          }}
          equipment={editingEquipment}
          onSuccess={handleFormSuccess}
          onError={handleFormError}
        />
      </div>
    </ProtectedRoute>
  );
}