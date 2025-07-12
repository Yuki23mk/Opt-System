/**
 * ファイルパス: app/(withSidebar)/products/page.tsx
 * 商品一覧表示（統一スタイル刷新版）
 */

"use client";

// サブアカウントの表示制御用
import { ProtectedRoute } from "../common/components/ProtectedRoute";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Package, Search, Eye, EyeOff, ToggleLeft, ToggleRight, FileText, X, ShoppingCart, Plus } from "lucide-react";

// 共通通知システム + 確認モーダル + グローバルカート
import { ToastContainer, ToastItem } from "@/app/(withSidebar)/common/components/Toast";
import { useConfirmModal } from "@/app/(withSidebar)/common/components/ConfirmModal";
import { useCart } from "@/app/(withSidebar)/common/contexts/CartContext";
import { DeletedUserDisplay } from "@/app/(withSidebar)/common/components/DeletedUserDisplay";

import { ENV } from '@/lib/env';

// 型定義（スキーマ対応版）
interface UserTag {
  id: number;
  name: string;
  color: string;
  createdBy: string;
  createdById: number;
  createdAt: string;
}

interface Product {
  id: number; // AdminProductMaster.id
  code: string;
  name: string;
  manufacturer: string;
  capacity: string;
  unit: string;
  packaging: string;
  oilType: string;
  tags: string;
  displayOrder: number;
  price: number;
  userTags: UserTag[];
  enabled?: boolean; // CompanyProduct.enabled
  companyProductId: number; // CompanyProduct.id
  quotationExpiryDate?: string; // 見積期限
}

interface UserInfo {
  id: number;
  systemRole: string;
  name: string;
}

export default function ProductListPage() {
  // 基本的なstate
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [showDisabledProducts, setShowDisabledProducts] = useState(false);
  
  // グローバルカート
  const { addToCart } = useCart();
  
  // 共有確認モーダル
  const { openConfirm, setLoading } = useConfirmModal();

  // Toast管理用state
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // Toast関数
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

  // 期限切れチェック関数
  const isQuotationExpired = (product: Product): boolean => {
    if (!product.quotationExpiryDate) return false;
    
    const expiryDate = new Date(product.quotationExpiryDate);
    const today = new Date();
    
    // 時間をリセットして日付のみで比較
    expiryDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    
    // 期限日の翌日から期限切れとする（期限日当日は有効）
    return expiryDate < today;
  };

  // 期限切れまでの日数を計算
  const getDaysUntilExpiry = (product: Product): number | null => {
    if (!product.quotationExpiryDate) return null;
    
    const expiryDate = new Date(product.quotationExpiryDate);
    const today = new Date();
    
    // 時間をリセットして日付のみで比較
    expiryDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    
    const timeDiff = expiryDate.getTime() - today.getTime();
    return Math.ceil(timeDiff / (1000 * 3600 * 24));
  };

  // タグ関連のstate
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [selectedProductForTag, setSelectedProductForTag] = useState<Product | null>(null);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("blue");
  const [isEditingTag, setIsEditingTag] = useState(false);
  const [editingTagId, setEditingTagId] = useState<number | null>(null);

  // ドキュメント関連のstate
  const [isDocumentModalOpen, setIsDocumentModalOpen] = useState(false);
  const [selectedProductForDoc, setSelectedProductForDoc] = useState<Product | null>(null);
  const [productDocuments, setProductDocuments] = useState<any[]>([]);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  
  // アップロード成功時のstate
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string>('');

  // 環境変数
  const API_URL = ENV.API_URL;
  const FRONTEND_URL = ENV.FRONTEND_URL;

  // タグモーダルを閉じる
  const closeTagModal = () => {
    setIsTagModalOpen(false);
    setSelectedProductForTag(null);
    setIsEditingTag(false);
    setEditingTagId(null);
    setNewTagName("");
    setNewTagColor("blue");
  };

  // ドキュメントモーダルを閉じる
  const closeDocumentModal = () => {
    setIsDocumentModalOpen(false);
    setSelectedProductForDoc(null);
    setProductDocuments([]);
    setShowUploadForm(false);
    setIsDragOver(false);
  };

  // アップロードフォームを閉じる
  const closeUploadForm = () => {
    setShowUploadForm(false);
    setUploadSuccess(false);
    setUploadedFileName('');
  };

  // 別のファイル選択
  const selectAnotherFile = () => {
    setUploadSuccess(false);
    setUploadedFileName('');
  };

  // 製品有効/無効状態を切り替える関数
  const toggleProductEnabled = async (companyProductId: number, currentEnabled: boolean) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        showToast('error', '認証トークンが見つかりません');
        return;
      }

      const response = await fetch(`${API_URL}/api/company-products/${companyProductId}/toggle`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          enabled: !currentEnabled
        })
      });

      if (response.ok) {
        // ローカル状態を更新
        setProducts(prev => prev.map(p => 
          p.companyProductId === companyProductId 
            ? { ...p, enabled: !currentEnabled }
            : p
        ));
        
        showToast('success', `製品を${!currentEnabled ? '使用中' : '使用中止'}にしました`, '状態更新完了');
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || '製品状態の更新に失敗しました');
      }
    } catch (error: any) {
      console.error('製品状態切り替えエラー:', error);
      showToast('error', error.message || '製品状態の更新に失敗しました', 'エラーが発生しました');
    }
  };

  // タグ追加関数
  const addUserTag = async () => {
    if (!selectedProductForTag || !newTagName.trim()) {
      showToast('error', 'タグ名を入力してください');
      return;
    }

    if (newTagName.trim().length > 20) {
      showToast('error', 'タグ名は20文字以内で入力してください');
      return;
    }

    // 重複チェック（ローカル）
    const existingTag = selectedProductForTag.userTags?.find(
      tag => tag.name.toLowerCase() === newTagName.trim().toLowerCase()
    );
    
    if (existingTag) {
      showToast('error', '同じ名前のタグが既に存在します');
      return;
    }

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        showToast('error', '認証トークンが見つかりません');
        return;
      }

      const response = await fetch(`${API_URL}/api/products/${selectedProductForTag.id}/tags`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newTagName.trim(),
          color: newTagColor,
          productMasterId: selectedProductForTag.id // スキーマ対応
        })
      });

      if (response.ok) {
        const newTag = await response.json();
        
        // ローカル状態を更新
        setProducts(prev => prev.map(p => 
          p.id === selectedProductForTag.id 
            ? { 
                ...p, 
                userTags: [...(p.userTags || []), {
                  id: newTag.id,
                  name: newTag.name,
                  color: newTag.color,
                  createdBy: newTag.createdBy,
                  createdById: newTag.createdById,
                  createdAt: newTag.createdAt
                }]
              }
            : p
        ));
        
        showToast('success', 'タグを追加しました');
        closeTagModal();
      } else {
        let errorMessage = 'タグの追加に失敗しました';
        
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch (parseError) {
          try {
            const errorText = await response.text();
            if (errorText.includes('constraint')) {
              errorMessage = '同じ名前のタグが既に存在します';
            }
          } catch (textError) {
            console.error('エラーレスポンス読み取り失敗:', textError);
          }
        }
        
        throw new Error(errorMessage);
      }
    } catch (error: any) {
      console.error('タグ追加エラー:', error);
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        showToast('error', 'ネットワークエラーが発生しました。接続を確認してください。');
      } else {
        showToast('error', error.message || 'タグの追加に失敗しました');
      }
    }
  };

  // タグ編集関数
  const editUserTag = async () => {
    if (!selectedProductForTag || !newTagName.trim() || !editingTagId) {
      showToast('error', 'タグ名を入力してください');
      return;
    }

    if (newTagName.trim().length > 20) {
      showToast('error', 'タグ名は20文字以内で入力してください');
      return;
    }

    // 重複チェック（編集中のタグ以外で同じ名前があるか）
    const existingTag = selectedProductForTag.userTags?.find(
      tag => tag.id !== editingTagId && tag.name.toLowerCase() === newTagName.trim().toLowerCase()
    );
    
    if (existingTag) {
      showToast('error', '同じ名前のタグが既に存在します');
      return;
    }

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        showToast('error', '認証トークンが見つかりません');
        return;
      }

      const response = await fetch(`${API_URL}/api/products/${selectedProductForTag.id}/tags/${editingTagId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newTagName.trim(),
          color: newTagColor
        })
      });

      if (response.ok) {
        const updatedTag = await response.json();
        
        // ローカル状態を更新
        setProducts(prev => prev.map(p => 
          p.id === selectedProductForTag.id 
            ? { 
                ...p, 
                userTags: p.userTags?.map(tag => 
                  tag.id === editingTagId
                    ? {
                        id: updatedTag.id,
                        name: updatedTag.name,
                        color: updatedTag.color,
                        createdBy: updatedTag.createdBy,
                        createdById: updatedTag.createdById,
                        createdAt: updatedTag.createdAt
                      }
                    : tag
                ) || []
              }
            : p
        ));
        
        showToast('success', 'タグを更新しました');
        closeTagModal();
      } else {
        let errorMessage = 'タグの更新に失敗しました';
        
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch (parseError) {
          try {
            const errorText = await response.text();
            if (errorText.includes('constraint')) {
              errorMessage = '同じ名前のタグが既に存在します';
            }
          } catch (textError) {
            console.error('エラーレスポンス読み取り失敗:', textError);
          }
        }
        
        throw new Error(errorMessage);
      }
    } catch (error: any) {
      console.error('タグ編集エラー:', error);
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        showToast('error', 'ネットワークエラーが発生しました。接続を確認してください。');
      } else {
        showToast('error', error.message || 'タグの更新に失敗しました');
      }
    }
  };

  // タグ削除関数（共有確認モーダル使用）
  const deleteUserTag = async (productId: number, tagId: number, tagName: string) => {
    openConfirm({
      title: 'タグの削除',
      message: `タグ「${tagName}」を削除しますか？\nこの操作は取り消せません。`,
      confirmText: '削除する',
      cancelText: 'キャンセル',
      type: 'danger',
      onConfirm: async () => {
        try {
          setLoading(true);
          const token = localStorage.getItem("token");
          if (!token) {
            showToast('error', '認証トークンが見つかりません');
            return;
          }

          const response = await fetch(`${API_URL}/api/products/${productId}/tags/${tagId}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            }
          });

          if (response.ok) {
            // ローカル状態を更新
            setProducts(prev => prev.map(p => 
              p.id === productId 
                ? { 
                    ...p, 
                    userTags: p.userTags?.filter(tag => tag.id !== tagId) || []
                  }
                : p
            ));
            
            showToast('success', 'タグを削除しました');
          } else {
            const errorText = await response.text();
            
            let errorMessage = 'タグの削除に失敗しました';
            try {
              const errorData = JSON.parse(errorText);
              errorMessage = errorData.message || errorMessage;
            } catch (parseError) {
              console.error('エラーレスポンスのパースに失敗:', parseError);
            }
            
            throw new Error(errorMessage);
          }
        } catch (error: any) {
          console.error('タグ削除エラー:', error);
          if (error.name === 'TypeError' && error.message.includes('fetch')) {
            showToast('error', 'ネットワークエラーが発生しました。接続を確認してください。');
          } else {
            showToast('error', error.message || 'タグの削除に失敗しました');
          }
        } finally {
          setLoading(false);
        }
      }
    });
  };

  // タグモーダルを開く（新規追加用）
  const openTagModal = (product: Product) => {
    setSelectedProductForTag(product);
    setIsEditingTag(false);
    setEditingTagId(null);
    setNewTagName("");
    setNewTagColor("blue");
    setIsTagModalOpen(true);
  };

  // タグモーダルを開く（編集用）
  const openEditTagModal = (product: Product, tag: UserTag) => {
    setSelectedProductForTag(product);
    setIsEditingTag(true);
    setEditingTagId(tag.id);
    setNewTagName(tag.name);
    setNewTagColor(tag.color);
    setIsTagModalOpen(true);
  };

  // ドキュメント一覧取得
  const fetchProductDocuments = async (productId: number) => {
    try {
      setIsLoadingDocuments(true);
      const token = localStorage.getItem("token");
      if (!token) {
        showToast('error', '認証トークンが見つかりません');
        return;
      }

      const response = await fetch(`${API_URL}/api/product-documents?productMasterId=${productId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        let errorMessage = 'ドキュメントの取得に失敗しました';
        
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch (parseError) {
          const errorText = await response.text();
          console.error('エラーレスポンス（テキスト）:', errorText);
        }
        
        throw new Error(errorMessage);
      }

      const documents = await response.json();
      setProductDocuments(documents);

    } catch (error: any) {
      console.error('ドキュメント取得エラー:', error);
      
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        showToast('error', 'ネットワークエラーが発生しました。接続を確認してください。');
      } else {
        showToast('error', error.message || 'ドキュメントの取得に失敗しました');
      }
      setProductDocuments([]);
    } finally {
      setIsLoadingDocuments(false);
    }
  };

  // ドキュメントアップロード
  const uploadDocument = async (file: File) => {
    if (!selectedProductForDoc) {
      showToast('error', '製品が選択されていません');
      return;
    }

    try {
      setUploadingFile(true);
      const token = localStorage.getItem("token");
      if (!token) {
        showToast('error', '認証トークンが見つかりません');
        return;
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('productMasterId', selectedProductForDoc.id.toString());

      const response = await fetch(`${API_URL}/api/product-documents`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        let errorMessage = 'アップロードに失敗しました';
        
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch (parseError) {
          const errorText = await response.text();
          console.error('エラーレスポンス（テキスト）:', errorText);
        }
        
        throw new Error(errorMessage);
      }

      const result = await response.json();
      
      // 成功時の処理を改善
      setUploadSuccess(true);
      setUploadedFileName(file.name);
      showToast('success', `「${file.name}」をアップロードしました`, 'ドキュメント追加');
      
      await fetchProductDocuments(selectedProductForDoc.id);

    } catch (error: any) {
      console.error('アップロードエラー:', error);
      
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        showToast('error', 'ネットワークエラーが発生しました。接続を確認してください。');
      } else {
        showToast('error', error.message || 'アップロードに失敗しました');
      }
    } finally {
      setUploadingFile(false);
    }
  };

  // ドラッグ&ドロップハンドラー
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      const allowedTypes = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.png', '.jpg', '.jpeg', '.gif', '.txt'];
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
      
      if (allowedTypes.includes(fileExtension)) {
        uploadDocument(file);
      } else {
        showToast('error', '対応していないファイル形式です');
      }
    }
  };

  // ファイル選択ハンドラー
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadDocument(file);
      e.target.value = ''; // ファイル選択をリセット
    }
  };

  // ドキュメント削除（共有確認モーダル使用）
  const deleteDocument = async (documentId: number, filename: string) => {
    openConfirm({
      title: 'ドキュメントの削除',
      message: `「${filename}」を削除しますか？\nこの操作は取り消せません。`,
      confirmText: '削除する',
      cancelText: 'キャンセル',
      type: 'danger',
      onConfirm: async () => {
        try {
          setLoading(true);
          const token = localStorage.getItem("token");
          if (!token) {
            showToast('error', '認証トークンが見つかりません');
            return;
          }

          const response = await fetch(`${API_URL}/api/product-documents/${documentId}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });

          if (!response.ok) {
            let errorMessage = '削除に失敗しました';
            
            try {
              const errorData = await response.json();
              errorMessage = errorData.message || errorData.error || errorMessage;
            } catch (parseError) {
              const errorText = await response.text();
              console.error('エラーレスポンス（テキスト）:', errorText);
            }
            
            throw new Error(errorMessage);
          }

          const result = await response.json();
          
          showToast('success', `「${filename}」を削除しました`, 'ドキュメント削除');
          
          if (selectedProductForDoc) {
            await fetchProductDocuments(selectedProductForDoc.id);
          }

        } catch (error: any) {
          console.error('削除エラー:', error);
          
          if (error.name === 'TypeError' && error.message.includes('fetch')) {
            showToast('error', 'ネットワークエラーが発生しました。接続を確認してください。');
          } else {
            showToast('error', error.message || '削除に失敗しました');
          }
        } finally {
          setLoading(false);
        }
      }
    });
  };

  // ドキュメントモーダルを開く
  const openDocumentModal = async (product: Product) => {
    setSelectedProductForDoc(product);
    setIsDocumentModalOpen(true);
    await fetchProductDocuments(product.id);
  };

  // 期限切れ制御対応版カートに追加
  const handleAddToCart = async (product: Product) => {
    try {
      // 期限切れチェック
      if (isQuotationExpired(product)) {
        showToast('error', '見積り期限が切れています。管理者へご連絡ください。', '期限切れ');
        return;
      }

      // 緊急修正：productオブジェクトを明示的に構築して1個固定
      const safeProduct = {
        id: product.id,
        companyProductId: product.companyProductId,
        code: product.code,
        name: product.name,
        manufacturer: product.manufacturer,
        capacity: product.capacity,
        unit: product.unit,
        oilType: product.oilType,
        price: product.price,
        enabled: product.enabled
      };

      // 絶対に1個だけ追加
      await addToCart(safeProduct, 1);
      showToast('success', `「${product.name}」をカートに追加しました（数量: 1）`, 'カート追加');
    } catch (error: any) {
      showToast('error', error.message || 'カートへの追加に失敗しました');
    }
  };

  // メインアカウントかどうかの判定（タグ追加で使用）
  const isMainUser = userInfo?.systemRole === 'main';

  // ユーザー情報取得
  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          window.location.href = `${FRONTEND_URL}/login`;
          return;
        }

        const payload = JSON.parse(atob(token.split('.')[1]));
        setUserInfo({
          id: payload.id,
          systemRole: payload.systemRole,
          name: 'ユーザー'
        });
      } catch (error) {
        console.error('ユーザー情報の取得に失敗:', error);
        window.location.href = `${FRONTEND_URL}/login`;
      }
    };

    fetchUserInfo();
  }, [FRONTEND_URL]);

  // 商品リスト取得（初回読み込み）
  useEffect(() => {
    fetchProducts();
  }, []);

  // 商品データ取得（エラーハンドリング改善）
  const fetchProducts = async () => {
    try { 
      setIsLoading(true);
      const token = localStorage.getItem("token");
      
      if (!token) {
        showToast('error', '認証情報が見つかりません。再ログインしてください。', '認証エラー');
        return;
      }

      const res = await fetch(`${API_URL}/api/products`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!res.ok) {
        if (res.status === 401) {
          showToast('error', '認証に失敗しました。再ログインが必要です。', '認証エラー');
          return;
        }
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      const data = await res.json();
      
      setProducts(Array.isArray(data) ? data : []);
      
    } catch (error) {
      console.error("商品の取得に失敗しました:", error);
      setProducts([]);
      
      // 重要なエラーはアラートで表示
      showToast('error', '商品データの取得に失敗しました。ネットワーク接続を確認してください。', 'データ取得エラー');
    } finally {
      setIsLoading(false);
    }
  };

  // 検索フィルター（会社レベルの表示/非表示のみ考慮）
  const filteredProducts = products.filter(p => {
    // 会社レベルの表示/非表示フィルター
    const companyEnabled = p.enabled !== false;
    
    // 最終的な表示判定: 会社が有効 OR 使用中止も表示モード
    const shouldShow = companyEnabled || showDisabledProducts;
    
    if (!shouldShow) {
      return false;
    }
    
    // 検索フィルター
    return p.name.toLowerCase().includes(search.toLowerCase()) ||
           p.manufacturer.toLowerCase().includes(search.toLowerCase()) ||
           p.userTags?.some(tag => tag.name.toLowerCase().includes(search.toLowerCase()));
  });

  if (isLoading) {
    return (
      <div className="card-container text-center py-8">
        <div className="loading-spinner mx-auto mb-2"></div>
        <p className="text-slate-500 font-medium">商品を読み込み中...</p>
        <p className="text-xs text-slate-500 mt-2">API: {API_URL}</p>
      </div>
    );
  }

  return (
  <ProtectedRoute permission="products">
    <div className="fade-in">
      {/* Toast通知 */}
      <ToastContainer 
        toasts={toasts} 
        onClose={removeToast} 
        position="top-right" 
      />
      
      {/* ===== 統一ページヘッダー ===== */}
      <div className="page-header">
        <h1 className="page-title text-slate-900 font-bold">
          <Package className="page-title-icon" />
          製品一覧
        </h1>
        <div className="page-actions">
          <div className="text-xs text-slate-600">
            {filteredProducts.length} / {products.length} 商品を表示
            {showDisabledProducts && (
              <span className="ml-2 text-xs text-amber-600">(使用中止製品含む)</span>
            )}
          </div>
          {userInfo && (
            <div className="text-xs text-slate-600">
              <span className="text-slate-700">{userInfo.name}</span>
              <span className="text-slate-500 ml-1">
                ({isMainUser ? 'メインアカウント' : 'サブアカウント'})
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ===== 検索・フィルターエリア ===== */}
      <div className="mb-4 flex items-center gap-4">
        <div className="relative w-80">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="製品名・メーカー・タグで検索"
            className="w-full pl-10 pr-4 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-[#115e59] focus:ring-1 focus:ring-[#115e59] bg-white"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        {/* 使用中止製品表示切り替えボタン */}
        <button
          onClick={() => setShowDisabledProducts(!showDisabledProducts)}
          className={`
            px-3 py-2 text-xs font-medium rounded-md border transition-colors flex items-center gap-2
            ${showDisabledProducts 
              ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100' 
              : 'bg-white text-slate-600 hover:bg-slate-50 border-slate-200 hover:border-slate-300'
            }
          `}
        >
          {showDisabledProducts ? (
            <>
              <EyeOff className="w-4 h-4" />
              使用中止製品を隠す
            </>
          ) : (
            <>
              <Eye className="w-4 h-4" />
              使用中止製品も表示
            </>
          )}
        </button>
      </div>

      {/* ===== メインコンテンツ ===== */}
      {filteredProducts.length === 0 ? (
        <div className="card-container text-center py-12">
          <Package className="w-16 h-16 mx-auto mb-4 text-slate-300" />
          <p className="text-lg mb-2 font-semibold text-slate-600">
            {showDisabledProducts ? '条件に合う製品がありません' : '表示中の製品がありません'}
          </p>
          <p className="text-sm text-slate-500">
            {!showDisabledProducts && '使用中止製品も含めて検索してみてください'}
          </p>
        </div>
      ) : (
        <>
          {/* モバイル用スクロールヒント追加 */}
          <div className="sm:hidden text-xs text-slate-500 text-center mb-2 bg-blue-50 py-2 rounded">
            ← 左右にスクロールできます →
          </div>
          
          <div className="table-container">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="bg-[#115e59] text-white px-3 py-2 text-xs font-semibold text-left">No.</th>
                  <th className="bg-[#115e59] text-white px-3 py-2 text-xs font-semibold text-left">製品名</th>
                  <th className="bg-[#115e59] text-white px-3 py-2 text-xs font-semibold text-left">メーカー</th>
                  <th className="bg-[#115e59] text-white px-3 py-2 text-xs font-semibold text-center">容量</th>
                  <th className="bg-[#115e59] text-white px-3 py-2 text-xs font-semibold text-center">油種</th>
                  <th className="bg-[#115e59] text-white px-3 py-2 text-xs font-semibold text-center">タグ</th>
                  <th className="bg-[#115e59] text-white px-3 py-2 text-xs font-semibold text-center">利用状況</th>
                  <th className="bg-[#115e59] text-white px-3 py-2 text-xs font-semibold text-center">操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product, index) => {
                  // 期限切れ判定
                  const expired = isQuotationExpired(product);
                  
                  return (
                    <tr 
                      key={product.id} 
                      className={`
                        border-b border-slate-100 hover:bg-slate-50 transition-colors
                        ${product.enabled === false ? 'bg-slate-50 opacity-70' : ''}
                        ${expired ? 'bg-slate-100 opacity-50' : ''}
                      `}
                    >
                      <td className="px-3 py-2 text-xs text-slate-900 font-medium">{index + 1}</td>
                      <td className="px-3 py-2 text-xs">
                        <div className="flex items-center gap-2">
                          <div>
                            <div className={`font-semibold ${expired ? 'text-slate-500' : 'text-slate-900'}`}>
                              {product.name}
                              {product.enabled === false && (
                                <span className="ml-2 text-xs bg-slate-200 text-slate-600 px-2 py-1 rounded">
                                  使用中止
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className={`px-3 py-2 text-xs ${expired ? 'text-slate-400' : 'text-slate-700'}`}>{product.manufacturer}</td>
                      <td className={`px-3 py-2 text-xs text-center ${expired ? 'text-slate-400' : 'text-slate-700'}`}>
                        {product.capacity}{product.unit}
                      </td>
                      <td className={`px-3 py-2 text-xs text-center ${expired ? 'text-slate-400' : 'text-slate-700'}`}>
                        {product.oilType}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        <div className="flex flex-wrap gap-1 justify-center max-w-xs">
                          {product.userTags?.map((tag) => (
                            <div
                              key={tag.id}
                              className={`
                                relative group text-xs px-2 py-1 rounded-full font-medium inline-flex items-center gap-1
                                ${expired ? 'opacity-50' : ''}
                                ${tag.color === 'blue' ? 'bg-blue-100 text-blue-700' :
                                  tag.color === 'green' ? 'bg-green-100 text-green-700' :
                                  tag.color === 'yellow' ? 'bg-yellow-100 text-yellow-700' :
                                  tag.color === 'red' ? 'bg-red-100 text-red-700' :
                                  tag.color === 'purple' ? 'bg-purple-100 text-purple-700' :
                                  tag.color === 'pink' ? 'bg-pink-100 text-pink-700' :
                                  tag.color === 'indigo' ? 'bg-indigo-100 text-indigo-700' :
                                  tag.color === 'orange' ? 'bg-orange-100 text-orange-700' :
                                  tag.color === 'teal' ? 'bg-teal-100 text-teal-700' :
                                  'bg-slate-100 text-slate-700'}
                              `}
                              title={`作成者: ${tag.createdBy}${isMainUser ? ' - クリックで編集' : ''}`}
                            >
                              <span 
                                className={isMainUser ? "cursor-pointer hover:underline" : "cursor-default"}
                                onClick={isMainUser ? () => openEditTagModal(product, tag) : undefined}
                              >
                                {tag.name}
                              </span>
                              {/* メインアカウントのみ削除ボタン表示 */}
                              {isMainUser && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteUserTag(product.id, tag.id, tag.name);
                                  }}
                                  className="opacity-0 group-hover:opacity-100 hover:bg-red-500 hover:text-white rounded-full w-4 h-4 flex items-center justify-center transition-all ml-1"
                                  title="削除"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          ))}
                          {/* メインアカウントのみタグ追加ボタン表示 */}
                          {isMainUser && (
                            <button
                              onClick={() => openTagModal(product)}
                              className="text-xs px-2 py-1 rounded-full bg-slate-200 text-slate-600 hover:bg-slate-300 transition-colors border-2 border-dashed border-slate-400"
                              title="タグを追加"
                            >
                              + タグ追加
                            </button>
                          )}
                          {(!product.userTags || product.userTags.length === 0) && !isMainUser && (
                            <span className="text-xs text-slate-400">タグなし</span>
                          )}
                        </div>
                      </td>                  
                      <td className="px-3 py-2 text-center">
                        {/* メイン・サブアカウント両方で切り替え可能 */}
                        <button
                          onClick={() => toggleProductEnabled(product.companyProductId!, product.enabled ?? true)}
                          className={`
                            flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium transition-colors mx-auto
                            ${expired ? 'opacity-50' : ''}
                            ${product.enabled !== false 
                              ? 'bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200' 
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-300'
                            }
                          `}
                          title={`利用状況: ${product.enabled !== false ? '使用中' : '使用中止'} - クリックで切り替え`}
                        >
                          {product.enabled !== false ? (
                            <>
                              <ToggleRight className="w-5 h-5" />
                              <span>使用中</span>
                            </>
                          ) : (
                            <>
                              <ToggleLeft className="w-5 h-5" />
                              <span>使用中止</span>
                            </>
                          )}
                        </button>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <div className="flex justify-center gap-4">
                          <button
                            className={`
                              transition-colors p-1
                              ${expired ? 'text-slate-300' : 'text-slate-500 hover:text-slate-700'}
                            `}
                            title="ドキュメント"
                            onClick={() => openDocumentModal(product)}
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                          {/* カートアイコン：期限切れ/使用中止の制御 */}
                          <button
                            onClick={() => handleAddToCart(product)}
                            className={`
                              transition-colors p-1
                              ${(product.enabled === false || expired)
                                ? 'text-slate-300' 
                                : 'text-slate-500 hover:text-slate-700'
                              }
                            `}
                            title={
                              expired ? '見積り期限が切れています' :
                              product.enabled === false ? '使用中止のため注文できません' : 
                              'カートに追加'
                            }
                          >
                            <ShoppingCart className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* タグ追加・編集モーダル */}
      <Dialog open={isTagModalOpen} onOpenChange={closeTagModal}>
        <DialogContent className="border border-slate-200 rounded-lg p-6 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-slate-800">
              {isEditingTag ? 'タグを編集' : 'タグを追加'}
            </DialogTitle>
          </DialogHeader>
          
          {selectedProductForTag && (
            <div className="space-y-4">
              <div className="text-sm text-slate-600">
                製品: <span className="font-medium text-slate-800">{selectedProductForTag.name}</span>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">タグ名</label>
                <Input
                  placeholder="タグ名を入力"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  className="border-slate-200 focus:border-slate-400"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">色</label>
                <div className="flex gap-2 flex-wrap">
                  {['blue', 'green', 'yellow', 'red', 'purple', 'pink', 'indigo', 'orange', 'teal', 'gray'].map((color) => (
                    <button
                      key={color}
                      onClick={() => setNewTagColor(color)}
                      className={`
                        w-8 h-8 rounded-full border-2 transition-all
                        ${newTagColor === color ? 'border-slate-400 scale-110' : 'border-slate-200'}
                        ${color === 'blue' ? 'bg-blue-500' :
                          color === 'green' ? 'bg-green-500' :
                          color === 'yellow' ? 'bg-yellow-500' :
                          color === 'red' ? 'bg-red-500' :
                          color === 'purple' ? 'bg-purple-500' :
                          color === 'pink' ? 'bg-pink-500' :
                          color === 'indigo' ? 'bg-indigo-500' :
                          color === 'orange' ? 'bg-orange-500' :
                          color === 'teal' ? 'bg-teal-500' :
                          'bg-gray-500'}
                      `}
                      title={color}
                    />
                  ))}
                </div>
              </div>
              
              <div className="flex justify-end gap-2 pt-4">
                <Button 
                  variant="outline"
                  onClick={closeTagModal}
                  className="border-slate-300 text-slate-700 hover:bg-slate-50"
                >
                  キャンセル
                </Button>
                <Button 
                  onClick={isEditingTag ? editUserTag : addUserTag}
                  disabled={!newTagName.trim()}
                  className="bg-[#115e59] hover:bg-[#0f766e] text-white"
                >
                  {isEditingTag ? '更新' : '追加'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ドキュメントモーダル */}
      <Dialog open={isDocumentModalOpen} onOpenChange={closeDocumentModal}>
        <DialogContent className="border border-slate-200 rounded-lg p-6 max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              関連資料
            </DialogTitle>
          </DialogHeader>
          
          {selectedProductForDoc && (
            <div className="space-y-6">
              <div className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg">
                製品: <span className="font-medium text-slate-800">{selectedProductForDoc.name}</span> ({selectedProductForDoc.code})
                <br />
                メーカー: <span className="font-medium text-slate-800">{selectedProductForDoc.manufacturer}</span>
              </div>
              
              {/* ヘッダー */}
              <div className="flex justify-between items-center">
                <div className="text-sm text-slate-600">
                  {productDocuments.length}件の関連資料
                </div>
                <button
                  onClick={() => setShowUploadForm(!showUploadForm)}
                  className="bg-[#115e59] hover:bg-[#0f766e] text-white px-3 py-2 rounded-md text-sm flex items-center gap-2 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  資料をアップロード
                </button>
              </div>

              {/* アップロードフォーム（改善版） */}
              {showUploadForm && (
                <div className="border-2 border-teal-200 bg-teal-50 rounded-lg p-6 space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="text-lg font-medium text-slate-800">新しい関連資料をアップロード</h4>
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="border-slate-300 hover:border-slate-400 hover:bg-slate-50 shadow-sm"
                      onClick={closeUploadForm}
                    >
                      キャンセル
                    </Button>
                  </div>

                  {/* アップロード成功時のUI */}
                  {uploadSuccess ? (
                    <div className="border-2 border-teal-300 bg-teal-100 rounded-lg p-8 text-center">
                      <div className="flex flex-col items-center space-y-4">
                        {/* チェックマークアイコン */}
                        <div className="w-16 h-16 bg-teal-500 rounded-full flex items-center justify-center">
                          <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                        
                        <div>
                          <p className="text-lg font-medium text-teal-700 mb-2">ファイルを選択済み</p>
                          <p className="font-medium text-slate-800 break-all">{uploadedFileName}</p>
                        </div>
                        
                        <div className="flex gap-3">
                          <Button
                            variant="outline"
                            onClick={selectAnotherFile}
                            className="border-slate-300 hover:border-slate-400 hover:bg-slate-50"
                          >
                            別のファイルを選択
                          </Button>
                          <Button
                            onClick={closeUploadForm}
                            className="bg-[#115e59] hover:bg-[#0f766e] text-white"
                          >
                            完了
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* 通常のアップロードUI */
                    <div 
                      className={`
                        relative border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200
                        ${isDragOver 
                          ? 'border-teal-400 bg-teal-100' 
                          : 'border-slate-300 bg-white hover:border-slate-400'
                        }
                      `}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                    >
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.txt"
                        onChange={handleFileSelect}
                        disabled={uploadingFile}
                        className="hidden"
                        id="document-upload"
                      />
                      
                      <div className="flex flex-col items-center space-y-4">
                        {uploadingFile ? (
                          <>
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
                            <p className="text-lg font-medium text-teal-700">アップロード中...</p>
                          </>
                        ) : (
                          <>
                            <FileText className={`h-12 w-12 ${isDragOver ? 'text-teal-500' : 'text-slate-400'}`} />
                            <div>
                              <p className={`text-lg font-medium ${isDragOver ? 'text-teal-700' : 'text-slate-700'}`}>
                                {isDragOver ? 'ファイルをドロップしてください' : 'ファイルをドラッグ&ドロップ'}
                              </p>
                              <p className="text-sm text-slate-500 mt-2">または</p>
                            </div>
                            <Button
                              variant="outline"
                              onClick={() => document.getElementById('document-upload')?.click()}
                              disabled={uploadingFile}
                              className="border-2 border-slate-300 hover:border-slate-400 hover:bg-slate-50 px-8 py-3 text-base shadow-sm"
                            >
                              ファイルを選択
                            </Button>
                          </>
                        )}
                      </div>
                      
                      <p className="text-xs text-slate-500 mt-6">
                        PDF, Word, Excel, 画像ファイル (最大10MB)
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* ドキュメント一覧 */}
              <div className="space-y-3">
                <h3 className="font-semibold text-slate-800">登録済みドキュメント</h3>
                
                {isLoadingDocuments ? (
                  <div className="text-center py-8">
                    <div className="loading-spinner mx-auto mb-2"></div>
                    <p className="text-slate-600 text-xs">読み込み中...</p>
                  </div>
                ) : productDocuments.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <FileText className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                    <p className="text-lg mb-2">関連資料がありません</p>
                  </div>
                ) : (
                  <div className="table-container">
                    <table className="w-full">
                      <thead>
                        <tr>
                          <th className="bg-[#115e59] text-white px-3 py-2 text-xs font-semibold text-left">ファイル名</th>
                          <th className="bg-[#115e59] text-white px-3 py-2 text-xs font-semibold text-left">アップロード者</th>
                          <th className="bg-[#115e59] text-white px-3 py-2 text-xs font-semibold text-left">アップロード日</th>
                          <th className="bg-[#115e59] text-white px-3 py-2 text-xs font-semibold text-center">サイズ</th>
                          <th className="bg-[#115e59] text-white px-3 py-2 text-xs font-semibold text-center">操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {productDocuments.map((doc) => (
                          <tr key={doc.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                            <td className="px-3 py-2 text-xs">
                              <div className="flex items-center gap-3">
                                <FileText className="w-4 h-4 text-slate-500" />
                                <div>
                                  <p className="font-medium text-slate-800">{doc.filename}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-2 text-xs text-slate-600">
                              <DeletedUserDisplay 
                                name={doc.uploadedBy?.name || "－"}
                                isDeleted={doc.uploadedBy?.status === 'deleted' || false}
                                showIcon={false}
                                size="sm"
                              />
                            </td>
                            <td className="px-3 py-2 text-xs text-slate-600">
                              {doc.createdAt ? 
                                new Date(doc.createdAt).toLocaleDateString("ja-JP") : 
                                "-"
                              }
                            </td>
                            <td className="px-3 py-2 text-center text-xs text-slate-500">
                              {doc.size ? `${Math.round(doc.size / 1024)} KB` : "-"}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  className="text-slate-500 hover:text-slate-700 transition-colors p-1"
                                  onClick={async () => {
                                    try {
                                      const token = localStorage.getItem("token");
                                      if (!token) {
                                        showToast('error', '認証トークンが見つかりません');
                                        return;
                                      }

                                      // プレビュー用のリクエスト（tokenをヘッダーで送信）
                                      const response = await fetch(
                                        `${API_URL}/api/product-documents/${doc.id}/download?preview=true`,
                                        {
                                          headers: {
                                            'Authorization': `Bearer ${token}`, // ヘッダーで送信
                                          },
                                        }
                                      );

                                      if (!response.ok) {
                                        throw new Error('プレビューの読み込みに失敗しました');
                                      }

                                      const data = await response.json();
                                      
                                      // ファイルタイプに応じた処理
                                      if (data.mimeType?.startsWith('image/')) {
                                        // 画像の場合：新しいタブで開く
                                        window.open(data.url, '_blank');
                                      } else if (data.mimeType === 'application/pdf') {
                                        // PDFの場合：新しいタブで開く
                                        window.open(data.url, '_blank');
                                      } else {
                                        // その他：ダウンロードを促す
                                        showToast('info', 'このファイルはプレビュー機能がご利用になれません。ダウンロードしてご確認ください', 'プレビュー');
                                        window.location.href = data.url;
                                      }
                                    } catch (error) {
                                      console.error('プレビューエラー:', error);
                                      showToast('error', 'プレビューの表示に失敗しました');
                                    }
                                  }}
                                  title="プレビュー"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
    
                                {/* ダウンロードボタン（修正版） */}
                                <button
                                  className="text-slate-500 hover:text-slate-700 transition-colors p-1"
                                  onClick={() => {
                                    try {
                                      const token = localStorage.getItem("token");
                                      if (!token) {
                                        showToast('error', '認証トークンが見つかりません');
                                        return;
                                      }

                                      // 直接URLにトークンを付けてダウンロード（fetchを使わない）
                                      const downloadUrl = `${API_URL}/api/product-documents/${doc.id}/download?token=${encodeURIComponent(token)}`;
                                      
                                      // 新しいタブで開かずに、現在のウィンドウでダウンロード
                                      const link = document.createElement('a');
                                      link.href = downloadUrl;
                                      link.download = doc.filename;
                                      link.style.display = 'none';
                                      document.body.appendChild(link);
                                      link.click();
                                      document.body.removeChild(link);
                                      
                                    } catch (error) {
                                      console.error('ダウンロードエラー:', error);
                                      showToast('error', 'ダウンロードに失敗しました');
                                    }
                                  }}
                                  title="ダウンロード"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                </button>

                                <button
                                  className="text-red-500 hover:text-red-700 transition-colors p-1"
                                  onClick={() => deleteDocument(doc.id, doc.filename)}
                                  disabled={uploadingFile}
                                  title="削除"
                                >
                                  <X className="w-4 h-4" />
                                </button>
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
                  className="border-slate-300 hover:border-slate-400 hover:bg-slate-50 shadow-sm"
                >
                  閉じる
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  </ProtectedRoute>
  );
}