/**
 * ファイルパス: app/equipments/components/DocumentsTab.tsx
 * DocumentsTab - 統一デザイン刷新版 + ファイル名検索機能追加
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Eye, Download, Trash2, Upload, AlertCircle, CheckCircle, Search } from "lucide-react";

import { ToastContainer } from "../../common/components/Toast";
import { Alert } from "../../common/components/Alert";
import { useNotification } from "../../common/hooks/useNotification";
import { useConfirmModal } from "../../common/components/ConfirmModal";
import { DeletedUserDisplay } from "../../common/components/DeletedUserDisplay";
import { ENV } from '@/lib/env';

interface Document {
  id: number;
  fileName: string;
  storedFilename: string;
  uploadedBy: {
    name: string;
    isDeleted?: boolean;
    status?: string;
  } | null;
  uploadedAt: string;
  fileUrl: string;
  size?: number;
  mimeType?: string;
}

interface DocumentsTabProps {
  equipmentId: number;
  confirmModal?: ReturnType<typeof useConfirmModal>;
}

export default function DocumentsTab({ equipmentId, confirmModal }: DocumentsTabProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string>("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [fileSearchTerm, setFileSearchTerm] = useState<string>(""); // ファイル名検索用の状態
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { openConfirm } = useConfirmModal();

  // 🎯 通知システムと確認モーダル
  const notification = useNotification();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFileName(file.name);
    } else {
      setSelectedFileName("");
    }
  };

  // ドラッグ&ドロップ処理
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
      // ファイルタイプチェック
      const allowedTypes = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.csv', '.png', '.jpg', '.jpeg', '.gif', '.txt'];
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
      
      if (allowedTypes.includes(fileExtension)) {
        setSelectedFileName(file.name);
        // ファイル入力に設定
        if (fileInputRef.current) {
          const dt = new DataTransfer();
          dt.items.add(file);
          fileInputRef.current.files = dt.files;
        }
      } else {
        notification.warningAlert("対応していないファイル形式です", {
          title: 'ファイル形式エラー'
        });
      }
    }
  };

  const fetchDocuments = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${ENV.API_URL}/api/equipments/${equipmentId}/documents`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);
      } else {
        const errorData = await res.json().catch(() => ({ message: "資料の取得に失敗しました" }));
        notification.errorAlert(errorData.message || "資料の取得に失敗しました", {
          title: '取得エラー'
        });
      }
    } catch (error) {
      console.error("Fetch documents error:", error);
      notification.errorAlert("サーバーに接続できませんでした", {
        title: 'ネットワークエラー'
      });
    }
  };

  useEffect(() => {
    if (equipmentId) {
      fetchDocuments();
      setSelectedFileName(""); // 設備変更時にファイル選択をリセット
      setFileSearchTerm(""); // 設備変更時に検索もリセット
    }
  }, [equipmentId]);

  const handleUpload = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      notification.warningAlert("ファイルを選択してください", {
        title: '入力エラー'
      });
      return;
    }

    // ファイルサイズチェック（10MB制限）
    if (file.size > 10 * 1024 * 1024) {
      notification.warningAlert("ファイルサイズは10MB以下にしてください", {
        title: 'ファイルサイズエラー'
      });
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const token = localStorage.getItem("token");
      
      console.log("Uploading file:", file.name, "to:", `${ENV.API_URL}/api/equipments/${equipmentId}/documents`);
      
      const res = await fetch(`${ENV.API_URL}/api/equipments/${equipmentId}/documents`, {
        method: "POST",
        body: formData,
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
      });

      console.log("Upload response:", res.status, res.statusText);

      if (res.ok) {
        const result = await res.json();
        console.log("Upload success:", result);
        await fetchDocuments();
        if (fileInputRef.current) fileInputRef.current.value = "";
        setSelectedFileName(""); // ファイル名をリセット
        notification.success("ファイルをアップロードしました！");
      } else {
        const errorText = await res.text();
        console.error("Upload error response:", errorText);
        try {
          const errorData = JSON.parse(errorText);
          notification.errorAlert(errorData.message || "アップロードに失敗しました", {
            title: 'アップロードエラー'
          });
        } catch {
          notification.errorAlert(`アップロードに失敗しました (${res.status}: ${res.statusText})`, {
            title: 'サーバーエラー'
          });
        }
      }
    } catch (error) {
      console.error("Upload error:", error);
      if (error instanceof TypeError && error.message.includes('fetch')) {
        notification.errorAlert("サーバーに接続できません。APIサーバーが起動しているか確認してください。", {
          title: 'ネットワークエラー'
        });
      } else {
        notification.errorAlert(`ネットワークエラーが発生しました: ${error.message}`, {
          title: 'ネットワークエラー'
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDocument = (docId: number, fileName: string) => {
    // 🎯 新しい確認モーダルを使用
    openConfirm({
      title: 'ドキュメントの削除',
      message: `「${fileName}」を削除しますか？\nこの操作は取り消すことができません。`,
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

          const res = await fetch(`${ENV.API_URL}/api/equipments/${equipmentId}/documents/${docId}`, {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });

          if (!res.ok) {
            let errorMessage = '削除に失敗しました';
            
            try {
              const errorData = await res.json();
              errorMessage = errorData.message || errorData.error || errorMessage;
            } catch (parseError) {
              const errorText = await res.text();
              console.error('エラーレスポンス（テキスト）:', errorText);
            }
            
            throw new Error(errorMessage);
          }

          await fetchDocuments();
          notification.success(`「${fileName}」を削除しました`);

        } catch (error: any) {
          console.error('削除エラー:', error);
          
          if (error.name === 'TypeError' && error.message.includes('fetch')) {
            notification.error('ネットワークエラーが発生しました。接続を確認してください。');
          } else {
            notification.error(error.message || '削除に失敗しました');
          }
          
          // エラーの場合は再度throwしてモーダルを開いたままにする
          throw error;
        }
      }
    });
  };

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return "-";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${Math.round(bytes / (1024 * 1024))} MB`;
  };

  // ファイル名でフィルタリング
  const filteredDocuments = documents.filter(doc => 
    doc.fileName.toLowerCase().includes(fileSearchTerm.toLowerCase())
  );

  return (
    <>
      {/* 🎯 統合通知システム */}
      <ToastContainer 
        toasts={notification.toasts} 
        onClose={notification.removeToast} 
        position={notification.position as any} 
      />
      
      {/* アラート表示 */}
      <div className="space-y-4 mb-4">
        {notification.alerts.map(alert => (
          <Alert
            key={alert.id}
            type={alert.type}
            title={alert.title}
            message={alert.message}
            closable={alert.closable}
            actions={alert.actions}
            onClose={() => notification.removeAlert(alert.id)}
          />
        ))}
      </div>
      
      <div className="space-y-4">
        {/* アップロードセクション */}
        <div className="space-y-4">
          {/* ドラッグ&ドロップエリア */}
          <div
            className={`
              relative border-2 border-dashed rounded-lg p-6 text-center transition-all duration-200
              ${isDragOver 
                ? 'border-[#115e59] bg-teal-50' 
                : selectedFileName 
                  ? 'border-green-400 bg-green-50' 
                  : 'border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-slate-100'
              }
            `}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.gif,.txt"
              disabled={loading}
              className="hidden"
            />
            
            <div className="flex flex-col items-center space-y-3">
              {selectedFileName ? (
                <>
                  <CheckCircle className="h-8 w-8 text-green-500" />
                  <div>
                    <p className="text-sm font-medium text-green-700">ファイルを選択済み</p>
                    <p className="text-xs text-green-600 mt-1 truncate max-w-xs" title={selectedFileName}>
                      {selectedFileName}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={loading}
                      className="text-xs px-2 py-1 border-slate-300 text-slate-700 hover:bg-slate-50"
                    >
                      別のファイルを選択
                    </Button>
                    <Button
                      onClick={handleUpload}
                      disabled={loading}
                      className="bg-[#115e59] hover:bg-[#0f766e] text-white text-xs px-3 py-1.5 flex items-center gap-2"
                    >
                      <Upload className="h-4 w-4" />
                      {loading ? "アップロード中..." : "アップロード"}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <Upload className={`h-8 w-8 ${isDragOver ? 'text-[#115e59]' : 'text-slate-400'}`} />
                  <div>
                    <p className={`text-sm font-medium ${isDragOver ? 'text-[#115e59]' : 'text-slate-700'}`}>
                      {isDragOver ? 'ファイルをドロップしてください' : 'ファイルをドラッグ&ドロップ'}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">または</p>
                  </div>
                  <Button
                    variant="default"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={loading}
                    className="border-2 px-6 py-2 text-xs border-slate-300 text-slate-700 hover:bg-slate-50"
                  >
                    ファイルを選択
                  </Button>
                </>
              )}
            </div>
            
            <p className="text-xs text-slate-400 mt-3">
              PDF, Word, Excel, CSV, 画像ファイル (最大10MB)
            </p>
          </div>
        </div>

        {/* ファイル名検索エリア */}
        {documents.length > 0 && (
          <div className="mb-4">
            <div className="relative w-80">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="ファイル名で検索..."
                className="w-full pl-10 pr-4 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-[#115e59] focus:ring-1 focus:ring-[#115e59] bg-white"
                value={fileSearchTerm}
                onChange={(e) => setFileSearchTerm(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* 資料一覧 */}
        <div className="border rounded-lg overflow-hidden border-slate-200">
          <table className="w-full text-xs table-fixed">
            <thead>
              <tr className="bg-[#115e59] text-white">
                <th className="px-3 py-2 text-left font-semibold w-28">アップロード日</th>
                <th className="px-3 py-2 text-left font-semibold w-80">ファイル名</th>
                <th className="px-3 py-2 text-left font-semibold w-28">アップロード者</th>
                <th className="px-3 py-2 text-center font-semibold w-16">閲覧</th>
                <th className="px-3 py-2 text-center font-semibold w-20">ダウンロード</th>
                <th className="px-3 py-2 text-center font-semibold w-16">削除</th>
              </tr>
            </thead>
            <tbody>
              {filteredDocuments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    {documents.length === 0 ? (
                      "資料がアップロードされていません"
                    ) : (
                      <>
                        <Search className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                        <p className="font-medium">検索条件に一致するファイルが見つかりません</p>
                        <p className="text-xs mt-1">検索条件を変更してお試しください</p>
                      </>
                    )}
                  </td>
                </tr>
              ) : (
                filteredDocuments.map((doc) => (
                  <tr key={doc.id} className="border-b hover:bg-slate-50">
                    <td className="px-3 py-2 w-28 text-xs">
                      {doc.uploadedAt ? 
                        new Date(doc.uploadedAt).toLocaleDateString("ja-JP") : 
                        "-"
                      }
                    </td>
                    <td className="px-3 py-2 w-80">
                      <div className="flex flex-col">
                        <span className="font-medium truncate" title={doc.fileName}>
                          {doc.fileName || "-"}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 w-28 text-xs">
                      <DeletedUserDisplay 
                        name={doc.uploadedBy?.name || "－"}
                        isDeleted={doc.uploadedBy?.status === 'deleted' || false}
                        showIcon={false}
                        size="sm"
                      />
                    </td>
                    <td className="px-3 py-2 text-center w-16">
                      <div className="flex justify-center">
                        <Button 
                          variant="ghost"
                          size="sm"
                          className="h-4 w-4"
                          onClick={() => window.open(doc.fileUrl, '_blank', 'noopener,noreferrer')}
                          title="閲覧"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center w-20">
                      <div className="flex justify-center">
                        <Button 
                          variant="ghost"
                          size="sm"
                          className="h-4 w-4"
                          onClick={() => {
                            const link = document.createElement('a');
                            link.href = doc.fileUrl;
                            link.download = doc.fileName;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                          }}
                          title="ダウンロード"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center w-16">
                      <div className="flex justify-center">
                        <Button 
                          variant="ghost" 
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleDeleteDocument(doc.id, doc.fileName)}
                          disabled={loading}
                          title="削除"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}