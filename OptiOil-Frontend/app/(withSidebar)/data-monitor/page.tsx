/**
 * ファイルパス: app/(withSidebar)/data-monitor/page.tsx
 * データモニターページ - 統一デザイン刷新版
 */

"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  Pencil, 
  ChevronRight, 
  Folder,
  Zap,
  Droplet,
  Save,
  BarChart3
} from "lucide-react";
import { useConfirmModal } from "@/app/(withSidebar)/common/components/ConfirmModal";
import { ToastContainer, ToastItem } from "@/app/(withSidebar)/common/components/Toast";
import { ENV } from '@/lib/env';

interface Category {
  id: number;
  name: string;
  projects?: Project[];
}

interface Project {
  id: number;
  name: string;
  fluidType: 'water_soluble' | 'cutting_oil' | 'grinding_fluid';
}

interface FastDataEntry {
  projectId: string;
  date: string;
  concentration: string;
  ph: string;
}

// 🆕 FluidType の正規化関数を追加
const normalizeFluidType = (fluidType: string): keyof typeof fluidTemplates => {
  // データベースの古い値や不正な値を正規化
  const normalizedMap: Record<string, keyof typeof fluidTemplates> = {
    'water_soluble': 'water_soluble_cutting',
    'water_soluble_cutting': 'water_soluble_cutting', 
    'water_soluble_grinding': 'water_soluble_grinding',
    'cutting_oil': 'water_soluble_cutting',
    'grinding_fluid': 'water_soluble_grinding'
  };
  
  return normalizedMap[fluidType] || 'water_soluble_cutting';
};

// 🆕 デフォルトテンプレート定義（完全版）
const fluidTemplates = {
  water_soluble_cutting: {
    name: "水溶性切削油",
    template: {
      equipmentId: "",
      equipmentName: "新規マシン",
      materialType: "水溶性切削油",
      selectedMaterialId: "",
      selectedMaterialName: "",
      displayRangeMin: 0,
      displayRangeMax: 20,
      phDisplayRangeMin: 6,
      phDisplayRangeMax: 12,
      concentrationAlertMin: 6.0,
      concentrationAlertMax: 9.0,
      phAlertMin: 8.0,
      phAlertMax: 10.0
    },
    color: "bg-[#115e59]",
    iconColor: "text-white"
  },
  water_soluble_grinding: {
    name: "水溶性研削油",
    template: {
      equipmentId: "",
      equipmentName: "新規マシン",
      materialType: "水溶性研削油",
      selectedMaterialId: "",
      selectedMaterialName: "",
      displayRangeMin: 0,
      displayRangeMax: 15,
      phDisplayRangeMin: 6,
      phDisplayRangeMax: 12,
      concentrationAlertMin: 3.0,
      concentrationAlertMax: 8.0,
      phAlertMin: 8.5,
      phAlertMax: 9.5
    },
    color: "bg-amber-500",
    iconColor: "text-amber-600"
  }
};

// 🆕 安全なfluidConfig取得関数
const getFluidConfig = (fluidType: string | undefined) => {
  const normalizedType = normalizeFluidType(fluidType || 'water_soluble_cutting');
  return fluidTemplates[normalizedType];
};

// 🆕 FluidType表示用の安全な関数
const getFluidTypeDisplay = (fluidType: string | undefined) => {
  const config = getFluidConfig(fluidType);
  return {
    name: config.name,
    color: config.color,
    iconColor: config.iconColor
  };
};

const fluidTypeConfig = {
  water_soluble: { label: "水溶性", color: "bg-blue-500 text-white", icon: "💧" },
  cutting_oil: { label: "不水溶性", color: "bg-amber-500 text-white", icon: "🛢️" },
  grinding_fluid: { label: "研削液", color: "bg-[#115e59] text-white", icon: "⚙️" }
};

export default function DataMonitorCategoryPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showFastEntryModal, setShowFastEntryModal] = useState(false);
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editName, setEditName] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [fastEntry, setFastEntry] = useState<FastDataEntry>({
    projectId: "",
    date: new Date().toISOString().split('T')[0],
    concentration: "",
    ph: ""
  });
  const [saving, setSaving] = useState(false);

  const router = useRouter();
  const { openConfirm } = useConfirmModal();

  // Toast管理
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info', title?: string) => {
    const newToast: ToastItem = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      message,
      title,
      duration: 3000
    };
    setToasts(prev => [...prev, newToast]);

    setTimeout(() => {
      removeToast(newToast.id);
    }, 3000);
  };

  const removeToast = (id: string | number) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  // データ取得
  useEffect(() => {
    fetchCategories();
    fetchAllProjects();
  }, []);

  const fetchCategories = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        addToast("認証トークンが見つかりません", 'error');
        return;
      }

      const response = await fetch(`${ENV.API_URL}/api/data-monitor/category`, {
        headers: { 
          Authorization: `Bearer ${token}`,
          "X-Requested-With": "XMLHttpRequest",
          "Cache-Control": "no-cache"
        },
      });

      if (response.ok) {
        const data = await response.json();
        setCategories(data);
      } else {
        addToast("カテゴリの取得に失敗しました", 'error');
      }
    } catch (error) {
      addToast("ネットワークエラーが発生しました", 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllProjects = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      // 全カテゴリのプロジェクトを取得
      const response = await fetch(`${ENV.API_URL}/api/data-monitor/project`, {
        headers: { 
          Authorization: `Bearer ${token}`,
          "X-Requested-With": "XMLHttpRequest",
          "Cache-Control": "no-cache"
        },
      });

      if (response.ok) {
        const data = await response.json();
        setAllProjects(data);
      }
    } catch (error) {
      console.error("プロジェクト取得エラー:", error);
    }
  };

  const openAddCategoryModal = () => {
    setNewCategoryName("");
    setShowAddCategoryModal(true);
  };

  const addCategory = async () => {
    if (!newCategoryName?.trim()) {
      addToast("カテゴリ名を入力してください", 'warning');
      return;
    }

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        addToast("認証トークンが見つかりません", 'error');
        return;
      }

      const res = await fetch(`${ENV.API_URL}/api/data-monitor/category`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "X-Requested-With": "XMLHttpRequest",
        },
        body: JSON.stringify({ name: newCategoryName.trim() }),
      });

      if (res.ok) {
        const newCat = await res.json();
        setCategories((prev) => [...prev, newCat]);
        addToast(`「${newCat.name}」を作成しました`, 'success');
        setShowAddCategoryModal(false);
        setNewCategoryName("");
      } else {
        const errorData = await res.json();
        addToast(`カテゴリ作成失敗: ${errorData.error}`, 'error');
      }
    } catch (error) {
      addToast("カテゴリの作成に失敗しました", 'error');
    }
  };

  const openEditModal = (cat: Category) => {
    setEditingCategory(cat);
    setEditName(cat.name);
    setShowEditModal(true);
  };

  const saveCategory = async () => {
    if (!editingCategory || !editName.trim()) {
      addToast("カテゴリ名を入力してください", 'warning');
      return;
    }

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        addToast("認証トークンが見つかりません", 'error');
        return;
      }

      const res = await fetch(`${ENV.API_URL}/api/data-monitor/category`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "X-Requested-With": "XMLHttpRequest",
        },
        body: JSON.stringify({ id: editingCategory.id, name: editName.trim() }),
      });

      if (res.ok) {
        const updated = await res.json();
        setCategories((prev) =>
          prev.map((c) => (c.id === editingCategory.id ? { ...c, name: updated.name } : c))
        );
        setShowEditModal(false);
        addToast(`「${updated.name}」に更新しました`, 'success');
      } else {
        const errorData = await res.json();
        addToast(`更新失敗: ${errorData.error}`, 'error');
      }
    } catch (error) {
      addToast("カテゴリの更新に失敗しました", 'error');
    }
  };

  const confirmDeleteCategory = (cat: Category) => {
    openConfirm({
      title: 'カテゴリ削除',
      message: `「${cat.name}」を削除しますか？\n※ 関連するプロジェクトと測定データもすべて削除されます`,
      type: 'danger',
      confirmText: '削除実行',
      onConfirm: () => deleteCategory(cat.id)
    });
  };

  const deleteCategory = async (id: number) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        addToast("認証トークンが見つかりません", 'error');
        return;
      }

      const res = await fetch(`${ENV.API_URL}/api/data-monitor/category?id=${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Requested-With": "XMLHttpRequest",
        },
      });

      if (res.ok) {
        setCategories((prev) => prev.filter((c) => c.id !== id));
        addToast("カテゴリを削除しました", 'success');
        setShowEditModal(false); // ✅ 削除後にモーダルを閉じる
      } else {
        const errorData = await res.json();
        addToast(`削除失敗: ${errorData.error}`, 'error');
      }
    } catch (error) {
      addToast("カテゴリの削除に失敗しました", 'error');
    }
  };

  const handleNavigate = (categoryId: number) => {
    router.push(`/data-monitor/${categoryId}`);
  };

  // 高速データ入力機能
  const handleFastDataSave = async () => {
    if (!fastEntry.projectId || !fastEntry.concentration || !fastEntry.ph) {
      addToast("プロジェクト、濃度、pHを入力してください", 'warning');
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        addToast("認証トークンが見つかりません", 'error');
        return;
      }

      const values = {
        concentration: parseFloat(fastEntry.concentration),
        ph: parseFloat(fastEntry.ph)
      };

      const res = await fetch(`${ENV.API_URL}/api/data-monitor/measurement`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "X-Requested-With": "XMLHttpRequest",
        },
        body: JSON.stringify({
          projectId: parseInt(fastEntry.projectId),
          date: fastEntry.date,
          values: values
        }),
      });

      if (res.ok) {
        addToast("データを保存しました", 'success');
        setShowFastEntryModal(false);
        // フォームリセット
        setFastEntry({
          projectId: "",
          date: new Date().toISOString().split('T')[0],
          concentration: "",
          ph: ""
        });
      } else {
        const errorData = await res.json();
        addToast(`保存失敗: ${errorData.error}`, 'error');
      }
    } catch (error) {
      addToast("データの保存に失敗しました", 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fade-in">
        {/* ===== 統一ページヘッダー ===== */}
        <div className="page-header">
          <div>
            <h1 className="page-title text-slate-900 font-bold">
              <BarChart3 className="page-title-icon" />
              データモニター
            </h1>
          </div>
          <div className="page-actions">
            {/* 高速データ入力ボタン */}
            <Button 
              onClick={() => setShowFastEntryModal(true)}
              className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-md font-medium text-xs flex items-center gap-2 transition-colors"
              disabled={allProjects.length === 0}
            >
              <Zap className="w-4 h-4" />
              データ追加
            </Button>
            {/* 新しいカテゴリボタン */}
            <Button 
              className="bg-[#115e59] hover:bg-[#0f766e] text-white px-4 py-2 rounded-md font-medium text-xs flex items-center gap-2 transition-colors" 
              onClick={openAddCategoryModal}
            >
              <Plus className="w-4 h-4" />
              新しいカテゴリ
            </Button>
          </div>
        </div>

        {/* ===== メインコンテンツ ===== */}
        {loading ? (
          <div className="card-container text-center py-8">
            <div className="loading-spinner mx-auto mb-2"></div>
            <p className="text-slate-500 font-medium">読み込み中...</p>
          </div>
        ) : categories.length === 0 ? (
          <div className="card-container text-center py-12">
            <div className="text-slate-600">
              <Folder className="w-16 h-16 mx-auto mb-4 text-slate-300" />
              <p className="text-lg mb-2 font-semibold">カテゴリがありません</p>
              <p className="text-sm font-medium mb-6">最初のカテゴリを作成して、データモニタリングを開始しましょう。</p>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {categories.map((cat) => {
              const projectCount = cat.projects?.length || 0;
              const projectTypes = cat.projects ? [...new Set(cat.projects.map(p => p.fluidType))] : [];
              
              return (
                <Card 
                  key={cat.id} 
                  className="group hover:shadow-md transition-all duration-200 cursor-pointer border-slate-200 hover:border-[#115e59] bg-white"
                  onClick={() => handleNavigate(cat.id)}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        {/* カテゴリ名 */}
                        <h3 className="text-sm font-semibold text-slate-800 mb-2 truncate group-hover:text-[#115e59] transition-colors">
                          {cat.name}
                        </h3>
                        
                        {/* プロジェクト数 */}
                        <div className="flex items-center gap-2 mb-3">
                          <Badge variant="outline" className="text-slate-600 border-slate-300 text-xs px-2 py-1">
                            {projectCount}件のプロジェクト
                          </Badge>
                        </div>
                        
                        {/* 液体タイプ表示 */}
                        {projectTypes.length > 0 && (
                          <div className="flex gap-1 flex-wrap">
                            {projectTypes.map(type => {
                              const fluidDisplay = getFluidTypeDisplay(type);
                              return (
                                <div 
                                  key={type}
                                  className={`
                                    inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs
                                    ${fluidDisplay.color} text-white
                                  `}
                                >
                                  <Droplet className={`w-3 h-3 ${fluidDisplay.iconColor}`} />
                                  <span>{fluidDisplay.name}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      
                      {/* アクションボタン */}
                      <div className="flex items-center gap-2 ml-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditModal(cat);
                          }}
                          className="text-slate-500 hover:text-slate-700 hover:bg-slate-100 p-2"
                          title="編集"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        
                        <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-[#115e59] transition-colors" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* カテゴリ追加モーダル */}
        <Dialog open={showAddCategoryModal} onOpenChange={setShowAddCategoryModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-slate-800">新しいカテゴリ</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1 text-slate-700">カテゴリ名*</label>
                <Input
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="カテゴリ名を入力"
                  maxLength={100}
                  autoFocus
                  className="text-xs border-slate-200 focus:border-[#115e59] focus:ring-1 focus:ring-[#115e59]"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      addCategory();
                    }
                  }}
                />
              </div>
            </div>
            <DialogFooter>
              <Button  onClick={() => setShowAddCategoryModal(false)} className="text-xs px-3 py-1.5 border-slate-300 text-slate-700 hover:bg-slate-50">
                キャンセル
              </Button>
              <Button onClick={addCategory} className="bg-[#115e59] hover:bg-[#0f766e] text-white text-xs px-3 py-1.5">
                <Plus className="w-4 h-4 mr-2" />
                作成
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 編集モーダル */}
        <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-slate-800">カテゴリ編集</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1 text-slate-700">カテゴリ名</label>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="カテゴリ名を入力"
                  maxLength={100}
                  autoFocus
                  className="text-xs border-slate-200 focus:border-[#115e59] focus:ring-1 focus:ring-[#115e59]"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      saveCategory();
                    }
                  }}
                />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button
                
                onClick={() => {
                  if (editingCategory) {
                    confirmDeleteCategory(editingCategory);
                  }
                }}
                className="text-red-600 border-red-300 hover:bg-red-50 text-xs px-3 py-1.5"
              >
                削除
              </Button>
              <div className="flex gap-2">
                <Button  onClick={() => setShowEditModal(false)} className="text-xs px-3 py-1.5 border-slate-300 text-slate-700 hover:bg-slate-50">
                  キャンセル
                </Button>
                <Button onClick={saveCategory} className="bg-[#115e59] hover:bg-[#0f766e] text-white text-xs px-3 py-1.5">
                  <Save className="w-4 h-4 mr-2" />
                  保存
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 高速データ入力モーダル */}
        <Dialog open={showFastEntryModal} onOpenChange={setShowFastEntryModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-slate-800">
                <Zap className="w-5 h-5 text-amber-600" />
                データ追加
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1 text-slate-700">プロジェクト*</label>
                <Select
                  value={fastEntry.projectId}
                  onValueChange={(value) => setFastEntry(prev => ({...prev, projectId: value}))}
                >
                  <SelectTrigger className="text-xs border-slate-200 focus:border-[#115e59] focus:ring-1 focus:ring-[#115e59]">
                    <SelectValue placeholder="プロジェクトを選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {allProjects.map(project => {
                      const fluidDisplay = getFluidTypeDisplay(project.fluidType);
                      return (
                        <SelectItem key={project.id} value={project.id.toString()}>
                          <div className="flex items-center gap-2">
                            <Droplet className={`w-4 h-4 ${fluidDisplay.iconColor}`} />
                            <span className="text-xs">{project.name}</span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1 text-slate-700">測定日*</label>
                <Input
                  type="date"
                  value={fastEntry.date}
                  onChange={(e) => setFastEntry(prev => ({...prev, date: e.target.value}))}
                  className="text-xs border-slate-200 focus:border-[#115e59] focus:ring-1 focus:ring-[#115e59]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1 text-slate-700">濃度(%)*</label>
                  <Input
                    type="number"
                    step="0.1"
                    value={fastEntry.concentration}
                    onChange={(e) => setFastEntry(prev => ({...prev, concentration: e.target.value}))}
                    placeholder="0.0"
                    className="text-xs border-slate-200 focus:border-[#115e59] focus:ring-1 focus:ring-[#115e59]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1 text-slate-700">pH*</label>
                  <Input
                    type="number"
                    step="0.1"
                    value={fastEntry.ph}
                    onChange={(e) => setFastEntry(prev => ({...prev, ph: e.target.value}))}
                    placeholder="0.0"
                    className="text-xs border-slate-200 focus:border-[#115e59] focus:ring-1 focus:ring-[#115e59]"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button  onClick={() => setShowFastEntryModal(false)} disabled={saving} className="text-xs px-3 py-1.5 border-slate-300 text-slate-700 hover:bg-slate-50">
                キャンセル
              </Button>
              <Button 
                onClick={handleFastDataSave} 
                className="bg-amber-500 hover:bg-amber-600 text-white text-xs px-3 py-1.5"
                disabled={saving}
              >
                {saving ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>保存中...</span>
                  </div>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    保存
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Toast通知 */}
        <ToastContainer 
          toasts={toasts}
          onClose={removeToast}
          position="top-right"
        />
      </div>
    );
  }