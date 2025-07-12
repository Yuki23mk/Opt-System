/**
 * ファイルパス: optioil-admin/app/documents/page.tsx
 * 管理者画面 - 商品ドキュメント管理ページ（エンハンス版）
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FileText, Upload, Trash2, Building, Package, ArrowLeft, Eye, Mail, CheckCircle, X, AlertTriangle } from "lucide-react";
import { toast } from 'sonner';
import { ENV } from '@/lib/env';

// ★★★ 追加：削除確認モーダル用のhook
const useConfirmModal = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<{
    title: string;
    message: string;
    type: 'warning' | 'danger' | 'info' | 'question';
    onConfirm: () => void;
    onCancel?: () => void;
    isLoading?: boolean;
  } | null>(null);

  const openModal = (modalConfig: typeof config) => {
    setConfig(modalConfig);
    setIsOpen(true);
  };

  const closeModal = () => {
    setIsOpen(false);
    setConfig(null);
  };

  const handleConfirm = () => {
    if (config?.onConfirm) {
      config.onConfirm();
    }
  };

  const handleCancel = () => {
    if (config?.onCancel) {
      config.onCancel();
    }
    closeModal();
  };

  const ConfirmModal = () => {
    if (!isOpen || !config) return null;

    const getModalStyles = () => {
      switch (config.type) {
        case 'danger':
          return {
            icon: <AlertTriangle className="h-6 w-6 text-red-600" />,
            buttonClass: 'bg-red-600 hover:bg-red-700 text-white',
            headerClass: 'text-red-800'
          };
        case 'warning':
          return {
            icon: <AlertTriangle className="h-6 w-6 text-amber-600" />,
            buttonClass: 'bg-amber-600 hover:bg-amber-700 text-white',
            headerClass: 'text-amber-800'
          };
        case 'info':
          return {
            icon: <CheckCircle className="h-6 w-6 text-blue-600" />,
            buttonClass: 'bg-blue-600 hover:bg-blue-700 text-white',
            headerClass: 'text-blue-800'
          };
        default:
          return {
            icon: <AlertTriangle className="h-6 w-6 text-gray-600" />,
            buttonClass: 'bg-gray-600 hover:bg-gray-700 text-white',
            headerClass: 'text-gray-800'
          };
      }
    };

    const styles = getModalStyles();

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
          <div className="flex items-center gap-3 mb-4">
            {styles.icon}
            <h3 className={`text-lg font-semibold ${styles.headerClass}`}>
              {config.title}
            </h3>
          </div>
          <p className="text-gray-600 mb-6">{config.message}</p>
          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={config.isLoading}
            >
              キャンセル
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={config.isLoading}
              className={styles.buttonClass}
            >
              {config.isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  処理中...
                </>
              ) : (
                '削除'
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return { openModal, closeModal, ConfirmModal };
};

interface ProductMaster {
  id: number;
  code: string;
  name: string;
  manufacturer: string;
  capacity: string;
  unit: string;
  oilType: string;
  active: boolean;
}

interface Company {
  id: number;
  name: string;
  createdAt: string;
}

// uploadedByの安全なアクセスを追加
interface UploaderInfo {
  id: number;
  name?: string;
  displayName: string;
  isAdmin: boolean;
  isDeleted: boolean;
}

interface ProductDocument {
  id: number;
  filename: string;
  storedFilename?: string;
  mimeType?: string;
  size: number;
  createdAt: string;
  productMaster: {
    id: number;
    name: string;
    code: string;
  };
  company: {
    id: number;
    name: string;
  };
  uploadedBy: UploaderInfo;
  fileUrl: string;
}

function AdminDocumentManagementPage() {
  const router = useRouter();
  const API_URL = ENV.API_URL;
  const [productMasters, setProductMasters] = useState<ProductMaster[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [documents, setDocuments] = useState<ProductDocument[]>([]);
  const [selectedProductMasterId, setSelectedProductMasterId] = useState<number | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]); // ★★★ 修正：複数ファイル対応
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false); // ★★★ 追加：削除中状態

  // ★★★ 追加：削除確認モーダル
  const { openModal, closeModal, ConfirmModal } = useConfirmModal();

  const fetchProductMasters = useCallback(async () => {
    try {
      const token = localStorage.getItem("adminToken");
      if (!token) return;

      const response = await fetch(`${API_URL}/api/admin/product-masters`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setProductMasters(data.filter((pm: ProductMaster) => pm.active));
      }
    } catch (error) {
      console.error('商品マスター取得エラー:', error);
      toast.error('商品マスターの取得に失敗しました');
    }
  }, [API_URL]);

  const fetchCompanies = useCallback(async () => {
    try {
      const token = localStorage.getItem("adminToken");
      if (!token) return;

      const response = await fetch(`${API_URL}/api/admin/companies`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setCompanies(data);
      }
    } catch (error) {
      console.error('会社一覧取得エラー:', error);
      toast.error('会社一覧の取得に失敗しました');
    } finally {
      setIsLoading(false);
    }
  }, [API_URL]);

  const fetchDocuments = useCallback(async () => {
    if (!selectedProductMasterId) return;

    try {
      const token = localStorage.getItem("adminToken");
      if (!token) return;

      const queryParams = new URLSearchParams({
        productMasterId: selectedProductMasterId.toString(),
      });

      if (selectedCompanyId) {
        queryParams.append('companyId', selectedCompanyId.toString());
      }

      const response = await fetch(`${API_URL}/api/admin/product-documents?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setDocuments(data);
      }
    } catch (error) {
      console.error('ドキュメント取得エラー:', error);
      toast.error('ドキュメントの取得に失敗しました');
    }
  }, [selectedProductMasterId, selectedCompanyId, API_URL]);

  useEffect(() => {
    fetchProductMasters();
    fetchCompanies();
  }, [fetchProductMasters, fetchCompanies]);

  useEffect(() => {
    if (selectedProductMasterId) {
      fetchDocuments();
    } else {
      setDocuments([]);
    }
  }, [selectedProductMasterId, selectedCompanyId, fetchDocuments]);

  // ★★★ 修正：累積ファイル選択
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files || []);
    setSelectedFiles(prev => {
      // 既存ファイルと重複しないように追加
      const existingNames = prev.map(f => f.name);
      const uniqueNewFiles = newFiles.filter(f => !existingNames.includes(f.name));
      return [...prev, ...uniqueNewFiles];
    });
    // inputをリセットして同じファイルを再選択可能にする
    e.target.value = '';
  };

  // ★★★ 追加：ファイル削除機能
  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleFileUpload = async () => {
    if (selectedFiles.length === 0 || !selectedProductMasterId || !selectedCompanyId) {
      toast.error('ファイル、商品、会社を選択してください');
      return;
    }

    setIsUploading(true);

    try {
      const token = localStorage.getItem("adminToken");
      if (!token) return;

      const formData = new FormData();
      
      // ★★★ 修正：複数ファイルを追加
      selectedFiles.forEach(file => {
        formData.append('file', file);
      });
      
      formData.append('productMasterId', selectedProductMasterId.toString());
      formData.append('companyId', selectedCompanyId.toString());

      const response = await fetch(`${API_URL}/api/admin/product-documents`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        
        // ★★★ 追加：成功トースト
        toast.success(
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <div>
              <div className="font-medium">アップロード完了</div>
              <div className="text-sm text-gray-600">
                {result.count}件のファイルをアップロードし、メール通知を送信しました
              </div>
            </div>
          </div>,
          { duration: 5000 }
        );
        
        setSelectedFiles([]);
        await fetchDocuments();
      } else {
        const errorData = await response.json();
        toast.error('アップロードに失敗しました: ' + errorData.error);
      }
    } catch (error) {
      console.error('アップロードエラー:', error);
      toast.error('アップロード中にエラーが発生しました');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteDocument = async (documentId: number, filename: string, uploaderInfo: UploaderInfo | null) => {
    // nullチェックを追加
    if (!uploaderInfo) {
      toast.error('アップロード者情報が不明です');
      return;
    }

    // ユーザーアップロードファイルの削除制御
    if (!uploaderInfo.isAdmin) {
      toast.error(
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <div>
            <div className="font-medium">削除できません</div>
            <div className="text-sm text-gray-600">
              ユーザーがアップロードしたファイルは管理者からは削除できません
            </div>
          </div>
        </div>
      );
      return;
    }
    // ★★★ 修正：モーダルでの削除確認
    openModal({
      title: 'ドキュメント削除確認',
      message: `「${filename}」を削除しますか？この操作は取り消せません。`,
      type: 'danger',
      isLoading: isDeleting,
      onConfirm: async () => {
        setIsDeleting(true);
        try {
          const token = localStorage.getItem("adminToken");
          if (!token) return;

        // ★★★ 修正：クエリパラメータでIDを指定
        const response = await fetch(`${API_URL}/api/admin/product-documents?id=${documentId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

          if (response.ok) {
            toast.success('ドキュメントを削除しました');
            await fetchDocuments();
            closeModal();
          } else {
            const errorData = await response.json();
            if (errorData.error?.includes('ユーザーがアップロード')) {
              toast.error(
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <div>
                    <div className="font-medium">削除制限</div>
                    <div className="text-sm text-gray-600">{errorData.error}</div>
                  </div>
                </div>
              );
            } else {
              toast.error('削除に失敗しました: ' + errorData.error);
           }
            closeModal();
          }
        } catch (error) {
          console.error('削除エラー:', error);
          toast.error('削除中にエラーが発生しました');
          closeModal();
        } finally {
          setIsDeleting(false);
        }
      }
    });
  };

  const selectedProductMaster = productMasters.find(pm => pm.id === selectedProductMasterId);
  const selectedCompany = companies.find(c => c.id === selectedCompanyId);

  // ★★★ 追加：ファイル選択状態の判定
  const hasFilesSelected = selectedFiles.length > 0;
  const totalFileSize = selectedFiles.reduce((sum, file) => sum + file.size, 0);

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 px-4">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mr-4"></div>
          <span>読み込み中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <ConfirmModal />
      <div className="max-w-7xl mx-auto space-y-6">
        <Button
          variant="ghost"
          onClick={() => router.push('/dashboard')}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          ダッシュボードに戻る
        </Button>

        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6 text-blue-600" />
            商品ドキュメント管理
          </h1>
          <p className="text-gray-600">商品に関連する資料をアップロードし、会社単位でメール通知を送信します。</p>
        </div>

        {/* 商品・会社選択エリア */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">📋 アップロード設定</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                商品選択
              </label>
              <select
                value={selectedProductMasterId || ''}
                onChange={(e) => setSelectedProductMasterId(e.target.value ? Number(e.target.value) : null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">商品を選択してください</option>
                {productMasters.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} ({product.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                対象会社
              </label>
              <select
                value={selectedCompanyId || ''}
                onChange={(e) => setSelectedCompanyId(e.target.value ? Number(e.target.value) : null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">会社を選択してください</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* ★★★ 修正：ファイルアップロードエリア（複数ファイル対応 + 状態表示） */}
          <div className={`border-2 border-dashed rounded-lg p-6 transition-colors ${
            hasFilesSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
          }`}>
            <div className="text-center">
              <Upload className={`h-12 w-12 mx-auto mb-4 ${hasFilesSelected ? 'text-blue-500' : 'text-gray-400'}`} />
              <div className="flex items-center justify-center mb-4">
                <input
                  type="file"
                  multiple // ★★★ 追加：複数ファイル選択
                  onChange={handleFileChange}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif"
                />
              </div>
              
              {/* ★★★ 追加：選択されたファイル一覧 */}
              {selectedFiles.length > 0 && (
                <div className="mb-4">
                  <div className="text-sm font-medium text-blue-700 mb-2">
                    選択されたファイル ({selectedFiles.length}件 / {(totalFileSize / 1024 / 1024).toFixed(2)} MB)
                  </div>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {selectedFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-between bg-white p-2 rounded border">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <FileText className="h-4 w-4 text-blue-500 flex-shrink-0" />
                          <span className="text-sm truncate">{file.name}</span>
                          <span className="text-xs text-gray-500 flex-shrink-0">
                            ({(file.size / 1024 / 1024).toFixed(2)} MB)
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(index)}
                          className="text-red-500 hover:text-red-700 p-1 h-auto"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <Button
                onClick={handleFileUpload}
                disabled={selectedFiles.length === 0 || !selectedProductMasterId || !selectedCompanyId || isUploading}
                className="flex items-center gap-2"
              >
                {isUploading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    アップロード中...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    {selectedFiles.length > 0 ? `${selectedFiles.length}件をアップロード & メール通知` : 'アップロード & メール通知'}
                  </>
                )}
              </Button>
            </div>
          </div>

          {selectedProductMaster && selectedCompany && (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center gap-2 mb-2">
                <Mail className="h-4 w-4 text-blue-600" />
                <span className="font-medium text-blue-800">通知設定</span>
              </div>
              <div className="text-sm text-blue-700">
                <div>商品: <span className="font-medium">{selectedProductMaster.name}</span></div>
                <div>通知先: <span className="font-medium">{selectedCompany.name}</span> の全ユーザー</div>
                <div className="text-xs text-blue-600 mt-1">
                  ※アップロード完了後、自動でメール通知が送信されます
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ドキュメント一覧 */}
        {selectedProductMasterId && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <FileText className="h-5 w-5" />
                アップロード済みドキュメント
                {selectedCompany && (
                  <span className="text-sm font-normal text-gray-600">
                    ({selectedCompany.name} 限定表示)
                  </span>
                )}
              </h2>
            </div>
            
            {documents.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>まだドキュメントがアップロードされていません。</p>
              </div>
            ) : (
              <div className="divide-y">
                {/* ドキュメント一覧 */}
                {documents.map((doc) => (
                  <div key={doc.id} className="p-6 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <FileText className="h-4 w-4 text-blue-500" />
                          <span className="font-medium">{doc.filename}</span>
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                            {(doc.size / 1024 / 1024).toFixed(2)} MB
                          </span>
                          {/* uploadedByのnullチェックを追加 */}
                          {doc.uploadedBy && (
                            <span className={`text-xs px-2 py-1 rounded ${
                              doc.uploadedBy.isAdmin 
                                ? 'bg-purple-100 text-purple-700' 
                                : 'bg-green-100 text-green-700'
                            }`}>
                              {doc.uploadedBy.isAdmin ? '管理者' : 'ユーザー'}
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-600 space-y-1">
                          <div className="flex items-center gap-4">
                            <span className="flex items-center gap-1">
                              <Package className="h-3 w-3" />
                              {doc.productMaster.name} ({doc.productMaster.code})
                            </span>
                            <span className="flex items-center gap-1">
                              <Building className="h-3 w-3" />
                              {doc.company.name}
                            </span>
                          </div>
                          <div>
                            アップロード: {new Date(doc.createdAt).toLocaleDateString('ja-JP')} |
                            アップロード者: {doc.uploadedBy?.displayName || '不明'}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 ml-4">
                        {/* プレビューボタンはfileUrlが存在する場合のみ表示 */}
                        {doc.fileUrl && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(doc.fileUrl, '_blank')}
                            className="flex items-center gap-1"
                          >
                            <Eye className="h-4 w-4" />
                            プレビュー
                          </Button>
                        )}
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteDocument(doc.id, doc.filename, doc.uploadedBy)}
                          disabled={!doc.uploadedBy?.isAdmin}
                          className={`flex items-center gap-1 ${
                            doc.uploadedBy?.isAdmin 
                              ? 'text-red-600 hover:text-red-700' 
                              : 'text-gray-400 cursor-not-allowed'
                          }`}
                          title={!doc.uploadedBy?.isAdmin ? 'ユーザーがアップロードしたファイルは削除できません' : '削除'}
                        >
                          <Trash2 className="h-4 w-4" />
                          削除
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminDocumentManagementPage;