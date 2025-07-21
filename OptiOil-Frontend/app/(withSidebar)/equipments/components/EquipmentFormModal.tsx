/**
 * ファイルパス: app/equipments/components/EquipmentFormModal.tsx
 * 設備フォームモーダル（新規・編集共通）
 */

"use client";

import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Loader2, Settings, Plus } from "lucide-react";

interface Equipment {
  id: number;
  code: string;
  category: string;
  name: string;
  manufacturer: string;
  location: string;
  manager: string;
}

interface EquipmentFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  equipment?: Equipment | null;  // undefined = 新規、Equipment = 編集
  onSuccess: () => void;
  onError: (message: string) => void;
}

export default function EquipmentFormModal({
  isOpen,
  onClose,
  equipment,
  onSuccess,
  onError,
}: EquipmentFormModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    code: "",
    category: "",
    name: "",
    manufacturer: "",
    location: "",
    manager: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isEditMode = !!equipment;

  // フォーム初期化
  useEffect(() => {
    if (isOpen) {
      if (equipment) {
        // 編集モード
        setFormData({
          code: equipment.code || "",
          category: equipment.category || "",
          name: equipment.name || "",
          manufacturer: equipment.manufacturer || "",
          location: equipment.location || "",
          manager: equipment.manager || "",
        });
      } else {
        // 新規モード
        setFormData({
          code: "",
          category: "",
          name: "",
          manufacturer: "",
          location: "",
          manager: "",
        });
      }
      setErrors({});
    }
  }, [isOpen, equipment]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // エラーをクリア
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ""
      }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.code.trim()) {
      newErrors.code = "設備コードは必須です";
    }
    if (!formData.category.trim()) {
      newErrors.category = "設備種類は必須です";
    }
    if (!formData.name.trim()) {
      newErrors.name = "設備名は必須です";
    }
    if (!formData.manufacturer.trim()) {
      newErrors.manufacturer = "メーカーは必須です";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      const token = localStorage.getItem("token");
      const baseUrl = process.env.NEXT_PUBLIC_API_URL;
      
      let url: string;
      let method: string;
      
      if (isEditMode) {
        // 編集の場合
        url = `${baseUrl}/api/equipments/${equipment.id}`;
        method = "PUT";
      } else {
        // 新規の場合
        url = `${baseUrl}/api/equipments`;
        method = "POST";
      }
      
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        onSuccess();
        onClose();
      } else {
        const errorData = await res.json();
        if (res.status === 409) {
          // 重複エラー
          onError(`同じコード「${formData.code}」の設備が既に存在します`);
        } else {
          throw new Error(errorData.message || `${isEditMode ? '更新' : '登録'}に失敗しました`);
        }
      }
    } catch (error: any) {
      console.error(`設備${isEditMode ? '更新' : '登録'}エラー:`, error);
      onError(error.message || `設備情報の${isEditMode ? '更新' : '登録'}に失敗しました`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      onClose();
    }
  };

  return (
    <Dialog 
      open={isOpen} 
      onOpenChange={(open) => {
        if (!open && !isLoading) {
          onClose();
        }
      }}
    >
      <DialogContent 
        className="max-w-2xl border border-slate-200 rounded-lg p-0 overflow-hidden max-h-[90vh] overflow-y-auto"
        onInteractOutside={isLoading ? (e) => e.preventDefault() : undefined}
        onEscapeKeyDown={isLoading ? (e) => e.preventDefault() : undefined}
      >
        {/* ヘッダー */}
        <div className="bg-[#115e59] border-b px-6 py-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="text-white flex-shrink-0">
                {isEditMode ? (
                  <Settings className="w-6 h-6" />
                ) : (
                  <Plus className="w-6 h-6" />
                )}
              </div>
              <div className="text-white">
                <span className="text-lg font-semibold">
                  {isEditMode ? '設備編集' : '新規設備登録'}
                </span>
                <p className="text-sm text-teal-100 mt-1">
                  {isEditMode 
                    ? `${equipment?.name} の情報を編集` 
                    : '新しい設備を登録します'
                  }
                </p>
              </div>
            </DialogTitle>
          </DialogHeader>
          
          {!isLoading && (
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 text-white opacity-70 hover:opacity-100 transition-opacity p-1 hover:bg-white hover:bg-opacity-10 rounded"
              title="閉じる"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* フォーム */}
        <form onSubmit={handleSubmit} className="px-6 py-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 設備コード */}
            <div className="space-y-2">
              <Label htmlFor="modal-code" className="text-sm font-semibold text-slate-700">
                設備コード <span className="text-red-500">*</span>
              </Label>
              <Input
                id="modal-code"
                value={formData.code}
                onChange={(e) => handleInputChange('code', e.target.value)}
                placeholder="例: MC001"
                disabled={isLoading}
                className={`focus:border-[#115e59] focus:ring-[#115e59] ${
                  errors.code ? 'border-red-300 focus:border-red-500' : ''
                }`}
              />
              {errors.code && (
                <p className="text-sm text-red-600">{errors.code}</p>
              )}
            </div>

            {/* 設備種類 */}
            <div className="space-y-2">
              <Label htmlFor="modal-category" className="text-sm font-semibold text-slate-700">
                設備種類 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="modal-category"
                value={formData.category}
                onChange={(e) => handleInputChange('category', e.target.value)}
                placeholder="例: マシニングセンタ"
                disabled={isLoading}
                className={`focus:border-[#115e59] focus:ring-[#115e59] ${
                  errors.category ? 'border-red-300 focus:border-red-500' : ''
                }`}
              />
              {errors.category && (
                <p className="text-sm text-red-600">{errors.category}</p>
              )}
            </div>

            {/* 設備名 */}
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="modal-name" className="text-sm font-semibold text-slate-700">
                設備名 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="modal-name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="例: 立型マシニングセンタ XL4000"
                disabled={isLoading}
                className={`focus:border-[#115e59] focus:ring-[#115e59] ${
                  errors.name ? 'border-red-300 focus:border-red-500' : ''
                }`}
              />
              {errors.name && (
                <p className="text-sm text-red-600">{errors.name}</p>
              )}
            </div>

            {/* メーカー */}
            <div className="space-y-2">
              <Label htmlFor="modal-manufacturer" className="text-sm font-semibold text-slate-700">
                メーカー <span className="text-red-500">*</span>
              </Label>
              <Input
                id="modal-manufacturer"
                value={formData.manufacturer}
                onChange={(e) => handleInputChange('manufacturer', e.target.value)}
                placeholder="例: 株式会社東亜重工"
                disabled={isLoading}
                className={`focus:border-[#115e59] focus:ring-[#115e59] ${
                  errors.manufacturer ? 'border-red-300 focus:border-red-500' : ''
                }`}
              />
              {errors.manufacturer && (
                <p className="text-sm text-red-600">{errors.manufacturer}</p>
              )}
            </div>

            {/* 配置場所 */}
            <div className="space-y-2">
              <Label htmlFor="modal-location" className="text-sm font-semibold text-slate-700">
                配置場所
              </Label>
              <Input
                id="modal-location"
                value={formData.location}
                onChange={(e) => handleInputChange('location', e.target.value)}
                placeholder="例: 第一工場"
                disabled={isLoading}
                className="focus:border-[#115e59] focus:ring-[#115e59]"
              />
            </div>

            {/* 担当者 */}
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="modal-manager" className="text-sm font-semibold text-slate-700">
                担当者
              </Label>
              <Input
                id="modal-manager"
                value={formData.manager}
                onChange={(e) => handleInputChange('manager', e.target.value)}
                placeholder="例: 田中太郎"
                disabled={isLoading}
                className="focus:border-[#115e59] focus:ring-[#115e59]"
              />
            </div>
          </div>

          {/* ボタン */}
          <div className="flex justify-end space-x-4 pt-6 mt-6 border-t border-slate-200">
            <Button
              type="button"
              
              onClick={handleClose}
              disabled={isLoading}
              className="px-6 border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              キャンセル
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="bg-[#115e59] hover:bg-[#0f766e] text-white px-6"
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="animate-spin h-4 w-4" />
                  <span>{isEditMode ? '更新中...' : '登録中...'}</span>
                </div>
              ) : (
                isEditMode ? '更新する' : '登録する'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}