"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Search, Package, ShoppingCart, Eye, EyeOff, FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

// 正しいパスでインポート
import { useNotification } from "../../common/hooks/useNotification";
import { useConfirmModal } from "../../common/components/ConfirmModal";
import { ToastContainer } from "../../common/components/Toast";
import { useCart } from "../../common/contexts/CartContext";
import { DeletedUserDisplay } from "../../common/components/DeletedUserDisplay";
import { ENV } from '@/lib/env';

// 型定義の最適化
interface ProductMaster {
  id: number;
  code: string;
  name: string;
  manufacturer: string;
  capacity: string;
  unit: string;
  oilType: string;
}

interface CompanyProduct {
  id: number;
  productMaster: ProductMaster;
  price?: number;
  enabled: boolean;
  displayOrder?: number;
}

interface UserTag {
  id: number;
  name: string;
  color: string;
  createdBy: string;
  createdById: number;
  createdAt: string;
}

interface EquipmentMaterial {
  id: number;
  product: {
    id: number;
    code: string;
    name: string;
    manufacturer: string;
    capacity: string;
    unit: string;
    oilType: string;
  };
  companyProduct?: {
    id: number;
    enabled: boolean;
    price?: number;
  };
  usagePriority: number | null;
  defaultQty: number | null;
  unit: string | null;
  addedBy: {
    name: string;
  } | null;
  createdAt: string;
  userTags?: UserTag[];
}

interface ProductDocument {
  id: number;
  filename: string;
  fileUrl: string;
  uploadedBy?: {
    name: string;
    isDeleted?: boolean;
    status?: string;
  };
  createdAt: string;
  size?: number;
  mimeType?: string;
}

// フォーム状態の型定義（追加のみ）
interface MaterialFormState {
  selectedCompanyProductId: string;
  defaultQty: string;
  unit: string;
}

interface MaterialsTabProps {
  equipmentId: number;
}

export default function MaterialsTab({ equipmentId }: MaterialsTabProps) {
  // 基本状態
  const [materials, setMaterials] = useState<EquipmentMaterial[]>([]);
  const [availableProducts, setAvailableProducts] = useState<CompanyProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showDisabledProducts, setShowDisabledProducts] = useState(false);

  // ダイアログ状態（追加のみ）
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  // ドキュメント機能状態
  const [isDocumentModalOpen, setIsDocumentModalOpen] = useState(false);
  const [selectedMaterialForDoc, setSelectedMaterialForDoc] = useState<EquipmentMaterial | null>(null);
  const [productDocuments, setProductDocuments] = useState<ProductDocument[]>([]);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);

  // フォーム状態（追加のみ）
  const [addForm, setAddForm] = useState<MaterialFormState>({
    selectedCompanyProductId: "",
    defaultQty: "",
    unit: "",
  });

  // 通知とモーダル（グローバル使用）
  const notification = useNotification();
  const { openConfirm } = useConfirmModal();

  // グローバルカート使用
  const { addToCart: addToGlobalCart } = useCart();

  // 環境変数
  const API_URL = ENV.API_URL;

  // データ取得
  const fetchMaterials = async () => {
    try {
      const token = localStorage.getItem("token");
      const apiUrl = `${API_URL}/api/equipments/${equipmentId}/materials`;
      
      console.log('📋 使用資材取得開始:', apiUrl);
      
      const res = await fetch(apiUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (res.ok) {
        const data = await res.json();
        console.log('✅ 使用資材取得成功:', data.length, '件');
        setMaterials(data);
        } else {
        const errorText = await res.text();
        console.error('❌ 使用資材取得エラー:', errorText);
        try {
          const errorData = JSON.parse(errorText);
          notification.error(errorData.message || "資材の取得に失敗しました");
        } catch {
          notification.error("資材の取得に失敗しました");
        }
      }
    } catch (error) {
      console.error('❌ fetchMaterials エラー:', error);
      notification.error("サーバーに接続できませんでした");
    }
  };

  const fetchAvailableProducts = async () => {
    try {
      const token = localStorage.getItem("token");
      const apiUrl = `${API_URL}/api/company-products?includeDisabled=true`;
      
      console.log('📋 利用可能製品取得開始:', apiUrl);
      
      const res = await fetch(apiUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (res.ok) {
        const data = await res.json();
        console.log('✅ 利用可能製品取得成功:', data.length, '件');
        console.log('📋 取得データサンプル:', data.slice(0, 2));
        setAvailableProducts(data);
      } else {
        const errorText = await res.text();
        console.error('❌ 利用可能製品取得エラー:', errorText);
        notification.error("製品一覧の取得に失敗しました");
      }
    } catch (error) {
      console.error('❌ fetchAvailableProducts エラー:', error);
      notification.error("製品一覧の取得に失敗しました");
    }
  };

  useEffect(() => {
    if (equipmentId) {
      fetchMaterials();
      fetchAvailableProducts();
    }
  }, [equipmentId]);

  // フォーム管理（追加のみ）
  const resetAddForm = useCallback(() => {
    setAddForm({
      selectedCompanyProductId: "",
      defaultQty: "",
      unit: "",
    });
  }, []);

  // 資材追加
  const handleAddMaterial = useCallback(async () => {
    if (!addForm.selectedCompanyProductId) {
      notification.warning("資材を選択してください");
      return;
    }

    setLoading(true);

    try {
      const token = localStorage.getItem("token");
      const requestBody = {
        companyProductId: parseInt(addForm.selectedCompanyProductId),
      };

      console.log('📋 資材追加リクエスト:', requestBody);

      const res = await fetch(`${API_URL}/api/equipments/${equipmentId}/materials`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (res.ok) {
        await fetchMaterials();
        setIsAddDialogOpen(false);
        resetAddForm();
        notification.success("資材を追加しました！");
      } else {
        const errorText = await res.text();
        console.error('❌ 資材追加エラー:', errorText);
        try {
          const errorData = JSON.parse(errorText);
          notification.error(errorData.message || "追加に失敗しました");
        } catch {
          notification.error("追加に失敗しました");
        }
      }
    } catch (error) {
      console.error('❌ handleAddMaterial エラー:', error);
      notification.error("サーバーに接続できませんでした");
    } finally {
      setLoading(false);
    }
  }, [addForm, equipmentId, notification, resetAddForm]);

  // 資材削除
  const handleDeleteMaterial = useCallback((materialId: number, materialName: string) => {
    openConfirm({
      title: '資材の削除',
      message: `「${materialName}」を削除しますか？\nこの操作は取り消すことができません。`,
      confirmText: '削除する',
      cancelText: 'キャンセル',
      type: 'danger',
      onConfirm: async () => {
        try {
          const token = localStorage.getItem("token");
          if (!token) {
            notification.error('認証トークンが見つかりません');
            return;
          }

          const res = await fetch(`${API_URL}/api/equipments/${equipmentId}/materials/${materialId}`, {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });

          if (!res.ok) {
            throw new Error('削除に失敗しました');
          }

          await fetchMaterials();
          notification.success(`「${materialName}」を削除しました`);

        } catch (error: any) {
          notification.error(error.message || '削除に失敗しました');
          throw error;
        }
      }
    });
  }, [openConfirm, equipmentId, notification]);

// グローバルカートに追加する関数（1個固定版）
const handleAddToCart = useCallback(async (material: EquipmentMaterial) => {
  if (material.companyProduct && !material.companyProduct.enabled) {
    notification.warning("使用中止のため注文できません");
    return;
  }

  if (!material.companyProduct?.id) {
    notification.error("商品情報に問題があります");
    return;
  }

  try {
    // 常に1個だけ追加
    const productForCart = {
      id: material.product.id,
      companyProductId: material.companyProduct.id,
      code: material.product.code,
      name: material.product.name,
      manufacturer: material.product.manufacturer,
      capacity: material.product.capacity,
      unit: material.product.unit,
      oilType: material.product.oilType,
      price: material.companyProduct.price || 0,
      enabled: material.companyProduct.enabled
    };

    await addToGlobalCart(productForCart, 1); // 固定で1個
    notification.success(`「${material.product.name}」をカートに追加しました（数量: 1）`);
  } catch (error: any) {
    console.error('カート追加エラー:', error);
    notification.error(error.message || "カートへの追加に失敗しました");
  }
}, [addToGlobalCart, notification]);

  // ドキュメント関連
  const fetchProductDocuments = useCallback(async (productMasterId: number) => {
    try {
      setIsLoadingDocuments(true);
      const token = localStorage.getItem("token");
      if (!token) {
        notification.error('認証トークンが見つかりません');
        return;
      }

      const response = await fetch(`${API_URL}/api/product-documents?productMasterId=${productMasterId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('ドキュメントの取得に失敗しました');
      }

      const documents = await response.json();
      setProductDocuments(documents);

    } catch (error: any) {
      notification.error(error.message || 'ドキュメントの取得に失敗しました');
      setProductDocuments([]);
    } finally {
      setIsLoadingDocuments(false);
    }
  }, [notification]);

  const openDocumentModal = useCallback(async (material: EquipmentMaterial) => {
    setSelectedMaterialForDoc(material);
    setIsDocumentModalOpen(true);
    await fetchProductDocuments(material.product.id);
  }, [fetchProductDocuments]);

  const closeDocumentModal = useCallback(() => {
    setIsDocumentModalOpen(false);
    setSelectedMaterialForDoc(null);
    setProductDocuments([]);
  }, []);

  // 製品選択時の自動入力処理
  const handleProductSelection = useCallback((companyProductId: string) => {
    const selectedProduct = availableProducts.find(p => p.id.toString() === companyProductId);
    if (selectedProduct) {
      const capacityNumber = parseInt(selectedProduct.productMaster.capacity.replace(/[^0-9]/g, ''));
      setAddForm(prev => ({
        ...prev,
        selectedCompanyProductId: companyProductId,
        defaultQty: !isNaN(capacityNumber) ? capacityNumber.toString() : "",
        unit: selectedProduct.productMaster.unit,
      }));
    } else {
      setAddForm(prev => ({ ...prev, selectedCompanyProductId: companyProductId }));
    }
  }, [availableProducts]);

  // フィルタリング
  const filteredMaterials = materials.filter(material =>
    material.product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    material.product.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    material.product.manufacturer.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredAvailableProducts = availableProducts.filter(product => {
    if (!showDisabledProducts && !product.enabled) {
      return false;
    }
    return true;
  });

  const displayedMaterials = filteredMaterials.filter(material => {
    if (!showDisabledProducts && material.companyProduct && !material.companyProduct.enabled) {
      return false;
    }
    return true;
  });

  const formatCapacityWithUnit = (capacity: string, unit: string) => {
    if (/[a-zA-Z]/.test(capacity)) {
      return capacity;
    }
    return `${capacity}${unit}`;
  };

  console.log('🔍 デバッグ情報:', {
    availableProductsCount: availableProducts.length,
    showDisabledProducts,
    filteredAvailableProductsCount: filteredAvailableProducts.length,
    materialsCount: materials.length,
    displayedMaterialsCount: displayedMaterials.length,
  });

  return (
    <>
      {/* 統合通知システム */}
      <ToastContainer 
        toasts={notification.toasts} 
        onClose={notification.removeToast} 
        position={notification.position as any} 
      />
      
      <div className="space-y-4">
        {/* 検索とアクションバー */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="資材を検索..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 text-xs border-slate-200 focus:border-[#115e59] focus:ring-1 focus:ring-[#115e59]"
              />
            </div>
            
            <Button
              onClick={() => setShowDisabledProducts(!showDisabledProducts)}
              variant="outline"
              size="sm"
              className={`text-xs ${showDisabledProducts 
               ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100' 
               : 'bg-white text-slate-600 hover:bg-slate-50 border-slate-300'
              }`}
            >
              {showDisabledProducts ? (
                <>
                  <EyeOff className="h-3 w-3 mr-1" />
                  使用中止を隠す
                </>
              ) : (
                <>
                  <Eye className="h-3 w-3 mr-1" />
                  使用中止も表示
                </>
              )}
            </Button>
          </div>
          
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#115e59] hover:bg-[#0f766e] text-white text-xs px-3 py-1.5 flex items-center gap-2">
                <Plus className="h-4 w-4" />
                資材を追加
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>新しい資材を追加</DialogTitle>
                <DialogDescription>
                  この設備で使用する資材を追加してください。
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="product">資材</Label>
                    <Button
                      type="button"
                      onClick={() => setShowDisabledProducts(!showDisabledProducts)}
                      variant="outline"
                      size="sm"
                      className="text-xs h-7"
                    >
                      {showDisabledProducts ? (
                        <>
                          <EyeOff className="h-3 w-3 mr-1" />
                          使用中止を隠す
                        </>
                      ) : (
                        <>
                          <Eye className="h-3 w-3 mr-1" />
                          使用中止も表示
                        </>
                      )}
                    </Button>
                  </div>
                  <Select value={addForm.selectedCompanyProductId} onValueChange={handleProductSelection}>
                  <SelectTrigger className="text-xs border-slate-200 focus:border-[#115e59] focus:ring-1 focus:ring-[#115e59]">
                    <SelectValue placeholder="資材を選択してください" />
                  </SelectTrigger>
                    <SelectContent>
                      {filteredAvailableProducts.length === 0 ? (
                        <SelectItem value="no-products" disabled>
                          {availableProducts.length === 0 ? '製品を読み込み中...' : '利用可能な製品がありません'}
                        </SelectItem>
                      ) : (
                        filteredAvailableProducts.map((companyProduct) => (
                          <SelectItem key={companyProduct.id} value={companyProduct.id.toString()}>
                            <div className="flex items-center justify-between w-full">
                              <span>
                                {companyProduct.productMaster.name} ({companyProduct.productMaster.code})
                              </span>
                              {!companyProduct.enabled && (
                                <span className="ml-2 text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded">
                                  使用中止
                                </span>
                              )}
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500">
                    利用可能製品: {filteredAvailableProducts.length}件 
                    {!showDisabledProducts && ` (使用中止除く)`}
                  </p>
                </div>
              </div>
            <DialogFooter>
              <Button  onClick={() => setIsAddDialogOpen(false)} className="text-xs px-3 py-1.5 border-slate-300 text-slate-700 hover:bg-slate-50">
                キャンセル
              </Button>
              <Button onClick={handleAddMaterial} disabled={loading} className="bg-[#115e59] hover:bg-[#0f766e] text-white text-xs px-3 py-1.5">
                {loading ? "追加中..." : "追加"}
              </Button>
            </DialogFooter>            
          </DialogContent>
          </Dialog>
        </div>

        {/* 製品一覧風の資材表示 */}
        <div className="space-y-2">
          {/* 統計情報 - フォントサイズを text-xs に統一 */}
          <div className="flex justify-between items-center text-xs text-gray-600">
            <div>
              {displayedMaterials.length} / {materials.length} 資材を表示
              {showDisabledProducts && (
                <span className="ml-2 text-xs text-amber-600">(使用中止製品含む)</span>
              )}
            </div>
            <div className="flex gap-4 text-xs">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-teal-500 rounded-full"></span>
                使用中: {materials.filter(m => m.companyProduct?.enabled === true).length}
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
                使用中止: {materials.filter(m => m.companyProduct?.enabled === false).length}
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-yellow-400 rounded-full"></span>
                情報なし: {materials.filter(m => !m.companyProduct).length}
              </span>
            </div>
          </div>
          
          {/* 製品一覧風のテーブル */}
          <div className="w-full bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-xs">
              <thead>
              <tr className="bg-[#115e59] text-white">
                <th className="px-3 py-2 text-left font-semibold text-xs">No.</th>
                <th className="px-3 py-2 text-left font-semibold text-xs">製品名</th>
                <th className="px-3 py-2 text-left font-semibold text-xs">メーカー</th>
                <th className="px-3 py-2 text-center font-semibold text-xs">容量</th>
                <th className="px-3 py-2 text-center font-semibold text-xs">油種</th>
                <th className="px-3 py-2 text-center font-semibold text-xs">タグ</th>
                <th className="px-3 py-2 text-center font-semibold text-xs">利用状況</th>
                <th className="px-3 py-2 text-center font-semibold text-xs">操作</th>
              </tr>
              </thead>
              <tbody>
                {displayedMaterials.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-gray-500 text-xs">
                      {searchTerm ? "検索結果が見つかりません" : 
                       !showDisabledProducts ? "表示中の資材がありません（使用中止製品を表示するには上のボタンを押してください）" :
                       "使用資材が登録されていません"}
                    </td>
                  </tr>
                ) : (
                  displayedMaterials.map((material, index) => {
                    const isDisabled = !material.companyProduct || !material.companyProduct.enabled;
                    
                    return (
                      <tr 
                        key={material.id} 
                        className={`
                          border-b border-slate-100 hover:bg-slate-50/50 transition-colors
                          ${isDisabled ? 'bg-slate-50 opacity-70' : ''}
                        `}
                      >
                        <td className="p-2 text-slate-600 text-xs">{index + 1}</td>
                        <td className="p-2">
                          <div className="flex items-center gap-2">
                            <div>
                              <div className="font-medium text-slate-800 text-xs">
                                {material.product.name}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="p-2 text-slate-600 text-xs">{material.product.manufacturer}</td>
                        <td className="p-2 text-center text-slate-600 text-xs">
                          {formatCapacityWithUnit(material.product.capacity, material.product.unit)}
                        </td>
                        <td className="p-2 text-center text-slate-600 text-xs">
                          {material.product.oilType}
                        </td>
                        <td className="p-2">
                          <div className="flex flex-wrap gap-1 justify-center max-w-xs">
                            {material.userTags?.map((tag) => (
                              <div
                                key={tag.id}
                                className={`
                                  text-xs px-2 py-1 rounded-full font-medium
                                  ${tag.color === 'blue' ? 'bg-blue-500 text-white' :
                                    tag.color === 'green' ? 'bg-green-500 text-white' :
                                    tag.color === 'yellow' ? 'bg-yellow-500 text-white' :
                                    tag.color === 'red' ? 'bg-red-500 text-white' :
                                    tag.color === 'purple' ? 'bg-purple-500 text-white' :
                                    tag.color === 'pink' ? 'bg-pink-500 text-white' :
                                    tag.color === 'indigo' ? 'bg-indigo-500 text-white' :
                                    tag.color === 'orange' ? 'bg-orange-500 text-white' :
                                    tag.color === 'teal' ? 'bg-teal-500 text-white' :
                                    'bg-slate-500 text-white'}
                                `}
                                title={`作成者: ${tag.createdBy}`}
                              >
                                {tag.name}
                              </div>
                            )) || (
                              <span className="text-xs text-slate-400">タグなし</span>
                            )}
                          </div>
                        </td>
                        <td className="p-2 text-center">
                          {material.companyProduct ? (
                            <button
                              className={`
                                flex items-center gap-2 px-2 py-1 rounded-full text-xs font-medium transition-colors mx-auto
                                ${material.companyProduct.enabled 
                                  ? 'bg-[#115e59] text-white' 
                                  : 'bg-gray-500 text-white'
                                }
                              `}
                              title={`利用状況: ${material.companyProduct.enabled ? '使用中' : '使用中止'}`}
                            >
                              <span>{material.companyProduct.enabled ? '使用中' : '使用中止'}</span>
                            </button>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-500 text-white">
                              製品情報なし
                            </span>
                          )}
                        </td>
                        <td className="p-2">
                          <div className="flex justify-center gap-2">
                            <button
                              className="text-slate-500 hover:text-slate-700 transition-colors p-1"
                              title="ドキュメント"
                              onClick={() => openDocumentModal(material)}
                            >
                              <FileText className="w-4 h-4" />
                            </button>
                            
                            <button
                              onClick={() => handleAddToCart(material)}
                              disabled={isDisabled}
                              className={`
                                transition-colors p-1
                                ${isDisabled
                                  ? 'text-slate-300 cursor-not-allowed' 
                                  : 'text-slate-500 hover:text-slate-700'
                                }
                              `}
                              title={
                                isDisabled ? '使用中止のため注文できません' : 'カートに追加'
                              }
                            >
                              <ShoppingCart className="w-4 h-4" />
                            </button>
                            
                            <button
                            className="text-red-500 hover:text-red-700 transition-colors p-1"
                            onClick={() => handleDeleteMaterial(material.id, material.product.name)}
                            title="削除"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
            
            {displayedMaterials.length === 0 && (
              <div className="text-center py-12 text-slate-500">
                <div className="w-12 h-12 mx-auto mb-4 text-slate-300">
                  <Package className="w-12 h-12" />
                </div>
                <p className="text-xs mb-2">
                  {!showDisabledProducts ? '表示中の資材がありません' : '条件に合う資材がありません'}
                </p>
                <p className="text-xs">
                  {!showDisabledProducts && '使用中止製品も含めて検索してみてください'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ドキュメントモーダル */}
        <Dialog open={isDocumentModalOpen} onOpenChange={closeDocumentModal}>
          <DialogContent className="border border-slate-200 rounded-lg p-6 max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xs font-semibold text-slate-800 flex items-center gap-2">
                <FileText className="w-5 h-5" />
                関連資料
              </DialogTitle>
            </DialogHeader>
            
            {selectedMaterialForDoc && (
              <div className="space-y-6">
                <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg">
                  製品: <span className="font-medium text-slate-800">{selectedMaterialForDoc.product.name}</span> ({selectedMaterialForDoc.product.code})
                  <br />
                  メーカー: <span className="font-medium text-slate-800">{selectedMaterialForDoc.product.manufacturer}</span>
                </div>
                
                <div className="space-y-3">
                  <h3 className="font-semibold text-slate-800 text-xs">登録済みドキュメント</h3>
                  
                  {isLoadingDocuments ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-700 mx-auto mb-4"></div>
                      <p className="text-slate-600 text-xs">読み込み中...</p>
                    </div>
                  ) : productDocuments.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                      <FileText className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                      <p className="text-xs mb-2">関連資料がありません</p>
                    </div>
                  ) : (
                    <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-[#115e59] text-white">
                            <th className="p-2 text-left font-semibold text-xs">ファイル名</th>
                            <th className="p-2 text-left font-semibold text-xs">アップロード者</th>
                            <th className="p-2 text-left font-semibold text-xs">アップロード日</th>
                            <th className="p-2 text-center font-semibold text-xs">サイズ</th>
                            <th className="p-2 text-center font-semibold text-xs">操作</th>
                          </tr>
                        </thead>
                        <tbody>
                          {productDocuments.map((doc) => (
                            <tr key={doc.id} className="border-b border-slate-100 hover:bg-teal-50/30 transition-colors">
                              <td className="p-2">
                                <div className="flex items-center gap-3">
                                  <FileText className="w-4 h-4 text-slate-500" />
                                  <div>
                                    <p className="font-medium text-slate-800 text-xs">{doc.filename}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="p-2 text-slate-600 text-xs">
                                <DeletedUserDisplay 
                                  name={doc.uploadedBy?.name || "－"}
                                  isDeleted={doc.uploadedBy?.status === 'deleted' || false}
                                  showIcon={false}
                                  size="sm"
                                />
                              </td>
                              <td className="p-2 text-slate-600 text-xs">
                                {doc.createdAt ? 
                                  new Date(doc.createdAt).toLocaleDateString("ja-JP") : 
                                  "-"
                                }
                              </td>
                              <td className="p-2 text-center text-xs text-slate-500">
                                {doc.size ? `${Math.round(doc.size / 1024)} KB` : "-"}
                              </td>
                              <td className="p-2">
                                <div className="flex items-center justify-center gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-6 h-6 p-0 hover:bg-slate-50 hover:border-slate-300 text-xs"
                                    onClick={() => {
                                      const token = localStorage.getItem("token");
                                      window.open(`${doc.fileUrl}?token=${token}`, '_blank');
                                    }}
                                    title="表示"
                                  >
                                    <Eye className="h-3 w-3 text-slate-600" />
                                  </Button>
                                  <Button
                                    
                                    size="sm"
                                    className="w-6 h-6 p-0 hover:bg-slate-50 hover:border-slate-300 text-xs"
                                    onClick={() => {
                                      const link = document.createElement('a');
                                      link.href = doc.fileUrl;
                                      link.download = doc.filename;
                                      document.body.appendChild(link);
                                      link.click();
                                      document.body.removeChild(link);
                                    }}
                                    title="ダウンロード"
                                  >
                                    <svg className="h-3 w-3 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                
                <div className="flex justify-end pt-4 border-t">
                  <Button 
                    variant="outline"
                    onClick={closeDocumentModal}
                    className="border-slate-300 hover:border-slate-400 hover:bg-slate-50 shadow-sm text-xs"
                  >
                    閉じる
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}