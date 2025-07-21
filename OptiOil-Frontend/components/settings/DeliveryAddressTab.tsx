"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Edit2, Trash2, MapPin } from "lucide-react";
import { useConfirmModal } from "../../app/(withSidebar)/common/components/ConfirmModal";
import { ENV } from '@/lib/env';

// 既存Toast実装をインポート
import { ToastContainer, ToastItem } from "@/app/(withSidebar)/common/components/Toast";

interface DeliveryAddress {
  id: number;
  name: string;
  company?: string;
  zipCode: string;
  prefecture: string;
  city: string;
  address1: string;
  address2?: string;
  phone?: string;
  isDefault: boolean;
  createdAt: string;
}

interface AddressFormData {
  name: string;
  company: string;
  zipCode: string;
  prefecture: string;
  city: string;
  address1: string;
  address2: string;
  phone: string;
  isDefault: boolean;
}

export default function DeliveryAddressTab() {
  const [addresses, setAddresses] = useState<DeliveryAddress[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<DeliveryAddress | null>(null);
  const [formData, setFormData] = useState<AddressFormData>({
    name: "",
    company: "",
    zipCode: "",
    prefecture: "",
    city: "",
    address1: "",
    address2: "",
    phone: "",
    isDefault: false,
  });

  // 共通ConfirmModalフック
  const { openConfirm } = useConfirmModal();

  // Toast管理用state（製品一覧ページと同じ実装）
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // Toast関数（製品一覧ページと同じ実装）
  const showToast = (type: ToastItem['type'], message: string, title?: string) => {
    const newToast: ToastItem = {
      id: Date.now(),
      type,
      message,
      title,
      duration: 5000
    };
    setToasts(prev => [...prev, newToast]);
    
    // 個別に自動削除タイマーを設定
    setTimeout(() => {
      removeToast(newToast.id);
    }, newToast.duration || 5000);
  };

  const removeToast = (id: string | number) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  const API_URL = ENV.API_URL;

  // 配送先一覧取得
  useEffect(() => {
    fetchAddresses();
  }, []);

  const fetchAddresses = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem("token");
      if (!token) return;

      const response = await fetch(`${API_URL}/api/delivery-addresses`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setAddresses(data);
      } else {
        throw new Error('配送先の取得に失敗しました');
      }
    } catch (error) {
      console.error('配送先取得エラー:', error);
      showToast('error', '配送先の取得に失敗しました', 'エラー');
    } finally {
      setIsLoading(false);
    }
  };

  // フォームデータの更新
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  // 新規追加・編集の処理
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.zipCode.trim() || !formData.prefecture.trim() || !formData.city.trim() || !formData.address1.trim()) {
      showToast('error', '必須項目を入力してください', 'エラー');
      return;
    }

    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const method = editingAddress ? 'PUT' : 'POST';
      const url = editingAddress 
        ? `${API_URL}/api/delivery-addresses/${editingAddress.id}`
        : `${API_URL}/api/delivery-addresses`;

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        showToast('success', editingAddress ? '配送先を更新しました' : '配送先を追加しました', '成功');
        await fetchAddresses();
        handleCloseDialog();
      } else {
        throw new Error('保存に失敗しました');
      }
    } catch (error) {
      console.error('保存エラー:', error);
      showToast('error', '保存に失敗しました', 'エラー');
    }
  };

  // 削除処理（共通モーダル対応）
  const handleDeleteAddress = async (id: number) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const response = await fetch(`${API_URL}/api/delivery-addresses/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        showToast('success', '配送先を削除しました', '成功');
        await fetchAddresses();
      } else {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || '削除に失敗しました';
        showToast('error', errorMessage, 'エラー');
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error('削除エラー:', error);
      // エラーメッセージが既に表示されている場合は重複を避ける
      if (error.message !== '削除に失敗しました') {
        showToast('error', '削除に失敗しました', 'エラー');
      }
      throw error; // エラーを再スローしてConfirmModalに伝える
    }
  };

  // 削除確認モーダルを表示
  const confirmDeleteAddress = (address: DeliveryAddress) => {
    openConfirm({
      type: 'danger',
      title: '配送先を削除',
      message: `「${address.name}」を削除しますか？\n\nこの操作は取り消すことができません。`,
      confirmText: '削除する',
      cancelText: 'キャンセル',
      onConfirm: () => handleDeleteAddress(address.id)
    });
  };

  // ダイアログを開く
  const handleOpenDialog = (address?: DeliveryAddress) => {
    if (address) {
      setEditingAddress(address);
      setFormData({
        name: address.name,
        company: address.company || "",
        zipCode: address.zipCode,
        prefecture: address.prefecture,
        city: address.city,
        address1: address.address1,
        address2: address.address2 || "",
        phone: address.phone || "",
        isDefault: address.isDefault,
      });
    } else {
      setEditingAddress(null);
      setFormData({
        name: "",
        company: "",
        zipCode: "",
        prefecture: "",
        city: "",
        address1: "",
        address2: "",
        phone: "",
        isDefault: false,
      });
    }
    setIsDialogOpen(true);
  };

  // ダイアログを閉じる
  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingAddress(null);
  };

  // デフォルト設定の切り替え
  const handleSetDefault = async (id: number) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const response = await fetch(`${API_URL}/api/delivery-addresses/${id}/set-default`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        showToast('success', 'デフォルト配送先を設定しました', '成功');
        await fetchAddresses();
      } else {
        throw new Error('設定に失敗しました');
      }
    } catch (error) {
      console.error('デフォルト設定エラー:', error);
      showToast('error', '設定に失敗しました', 'エラー');
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
            <span className="ml-2">読み込み中...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div>
      {/* Toast通知 */}
      <ToastContainer 
        toasts={toasts} 
        onClose={removeToast} 
        position="top-right" 
      />
      
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                配送先一覧
              </CardTitle>
              <CardDescription>
                商品の配送先住所を管理します。
              </CardDescription>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => handleOpenDialog()}>
                  <Plus className="h-4 w-4 mr-2" />
                  新規追加
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>
                    {editingAddress ? '配送先を編集' : '新しい配送先を追加'}
                  </DialogTitle>
                  <DialogDescription>
                    配送先の情報を入力してください。
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="name">宛先名 *</Label>
                      <Input
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        placeholder="山田太郎"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="company">会社名</Label>
                      <Input
                        id="company"
                        name="company"
                        value={formData.company}
                        onChange={handleInputChange}
                        placeholder="株式会社サンプル"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="zipCode">郵便番号 *</Label>
                      <Input
                        id="zipCode"
                        name="zipCode"
                        value={formData.zipCode}
                        onChange={handleInputChange}
                        placeholder="123-4567"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="prefecture">都道府県 *</Label>
                      <Input
                        id="prefecture"
                        name="prefecture"
                        value={formData.prefecture}
                        onChange={handleInputChange}
                        placeholder="東京都"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="city">市区町村 *</Label>
                      <Input
                        id="city"
                        name="city"
                        value={formData.city}
                        onChange={handleInputChange}
                        placeholder="渋谷区"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="address1">住所1 *</Label>
                    <Input
                      id="address1"
                      name="address1"
                      value={formData.address1}
                      onChange={handleInputChange}
                      placeholder="道玄坂1-2-3"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="address2">住所2（建物名・部屋番号など）</Label>
                    <Input
                      id="address2"
                      name="address2"
                      value={formData.address2}
                      onChange={handleInputChange}
                      placeholder="サンプルビル4F"
                    />
                  </div>

                  <div>
                    <Label htmlFor="phone">電話番号</Label>
                    <Input
                      id="phone"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      placeholder="03-1234-5678"
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="isDefault"
                      name="isDefault"
                      checked={formData.isDefault}
                      onChange={handleInputChange}
                      className="rounded"
                    />
                    <Label htmlFor="isDefault">デフォルトの配送先に設定</Label>
                  </div>

                  <div className="flex justify-end space-x-2 pt-4">
                    <Button type="button"  onClick={handleCloseDialog}>
                      キャンセル
                    </Button>
                    <Button type="submit">
                      {editingAddress ? '更新' : '追加'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {addresses.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <MapPin className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p className="text-lg mb-2">配送先が登録されていません</p>
              <p className="text-sm">「新規追加」ボタンから配送先を追加してください</p>
            </div>
          ) : (
            <div className="space-y-4">
              {addresses.map((address) => (
                <div
                  key={address.id}
                  className={`border rounded-lg p-4 ${
                    address.isDefault ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold">{address.name}</h3>
                        {address.isDefault && (
                          <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded">
                            デフォルト
                          </span>
                        )}
                      </div>
                      {address.company && (
                        <p className="text-gray-600 mb-1">{address.company}</p>
                      )}
                      <p className="text-gray-700">
                        〒{address.zipCode} {address.prefecture}{address.city}
                      </p>
                      <p className="text-gray-700">{address.address1}</p>
                      {address.address2 && (
                        <p className="text-gray-700">{address.address2}</p>
                      )}
                      {address.phone && (
                        <p className="text-gray-600 mt-1">TEL: {address.phone}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {!address.isDefault && (
                        <Button
                          
                          size="sm"
                          onClick={() => handleSetDefault(address.id)}
                        >
                          デフォルトに設定
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenDialog(address)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => confirmDeleteAddress(address)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}