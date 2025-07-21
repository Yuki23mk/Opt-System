// OptiOil-Admin/app/legal/page.tsx
"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { 
  FileText, Plus, Eye, X, Calendar, Upload, Download,
  CheckCircle, ArrowLeft, Loader2
} from 'lucide-react';
import axios from '@/lib/axios';

interface LegalDocument {
  id: number;
  type: string;
  title: string;
  s3Key?: string;
  s3Url?: string;
  version: string;
  isActive: boolean;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
  metadata?: {
    originalFileName: string;
    fileSize: number;
    mimeType: string;
  };
  creator?: {
    username: string;
  };
}

interface DocumentForm {
  type: string;
  title: string;
  version: string;
}

export default function LegalManagementPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showUploader, setShowUploader] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<LegalDocument | null>(null);

  const [uploaderForm, setUploaderForm] = useState<DocumentForm>({
    type: 'terms',
    title: '',
    version: ''
  });

  const documentTypes = [
    { value: 'terms', label: '利用規約' },
    { value: 'privacy', label: 'プライバシーポリシー' },
  ];

  // 🔧 次のバージョンを計算する関数（シンプル版）
  const getNextVersion = (documents: LegalDocument[], type: string): string => {
    // 指定タイプの文書のみフィルタリング
    const typeDocuments = documents.filter(doc => doc.type === type);
    
    if (typeDocuments.length === 0) {
      return '1.0'; // 初回は1.0から開始
    }

    // バージョンを数値に変換して最大値を取得
    const versions = typeDocuments
      .map(doc => {
        const num = parseFloat(doc.version);
        return isNaN(num) ? 0 : num;
      })
      .filter(num => num > 0);

    if (versions.length === 0) {
      return '1.0';
    }

    const maxVersion = Math.max(...versions);
    // 0.1刻みで次のバージョンを計算（小数点第1位で丸める）
    const nextVersion = Math.round((maxVersion + 0.1) * 10) / 10;
    
    return nextVersion.toFixed(1); // 常に小数点1桁で表示
  };

  // 文書一覧を取得
  const { data: documents, isLoading } = useQuery({
    queryKey: ['legalDocuments'],
    queryFn: async () => {
      const response = await axios.get('/api/admin/legal');
      return response.data as LegalDocument[];
    }
  });

  // 文書を無効化
  const deactivateDocumentMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await axios.patch(`/api/admin/legal/${id}/deactivate`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['legalDocuments'] });
      toast.success('文書が無効化されました');
    },
    onError: (error: unknown) => {
      const apiError = error as { message?: string };
      toast.error(apiError.message || '文書の無効化に失敗しました');
    }
  });

  // アップローダーを開いたときに次のバージョンを自動設定
  const handleOpenUploader = () => {
    if (documents) {
      const nextVersion = getNextVersion(documents, uploaderForm.type);
      setUploaderForm(prev => ({
        ...prev,
        version: nextVersion
      }));
    }
    setShowUploader(true);
  };

  // 文書タイプが変更されたときも次のバージョンを再計算
  const handleTypeChange = (newType: string) => {
    setUploaderForm(prev => ({
      ...prev,
      type: newType
    }));
    
    if (documents) {
      const nextVersion = getNextVersion(documents, newType);
      setUploaderForm(prev => ({
        ...prev,
        version: nextVersion
      }));
    }
  };

  // ファイルアップロード処理
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // ファイル形式チェック
    const allowedTypes = ['.md', '.txt', '.docx', '.pdf'];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    
    if (!allowedTypes.includes(fileExtension)) {
      toast.error('対応していないファイル形式です。.md, .txt, .docx, .pdf ファイルをアップロードしてください。');
      event.target.value = '';
      return;
    }

    // ファイルサイズチェック（10MB）
    if (file.size > 10 * 1024 * 1024) {
      toast.error('ファイルサイズが大きすぎます（10MB以下にしてください）');
      event.target.value = '';
      return;
    }

    if (!uploaderForm.title) {
      toast.error('タイトルを入力してください');
      return;
    }
    setUploading(true);

    try {
      // FormDataでファイルアップロード
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', uploaderForm.type);
      formData.append('title', uploaderForm.title);
      formData.append('version', uploaderForm.version); // 自動計算されたバージョンを使用

      const token = localStorage.getItem('adminToken');
      const baseUrl = process.env.NEXT_PUBLIC_API_URL;
      
      const response = await fetch(`${baseUrl}/api/admin/legal/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (response.ok) {
        toast.success('ファイルが正常にアップロードされました');
        queryClient.invalidateQueries({ queryKey: ['legalDocuments'] });
        setShowUploader(false);
        resetForm();
      } else {
        const error = await response.json();
          // バージョン重複エラーの場合は分かりやすいメッセージを表示
        if (error.error?.includes('Unique constraint failed')) {
          toast.error('このバージョンは既に存在します。別のバージョン番号を入力してください。');
        } else {
          toast.error(error.error || 'ファイルのアップロードに失敗しました');
        }
      }
      
    } catch (error) {
      console.error('File upload error:', error);
      toast.error('ファイルのアップロードに失敗しました');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const resetForm = () => {
    setUploaderForm({
      type: 'terms',
      title: '',
      version: ''
    });
  };

  const handlePreview = (doc: LegalDocument) => {
    setPreviewDoc(doc);
  };

  const handleDownload = async (doc: LegalDocument) => {
    if (!doc.s3Key) {
      toast.error('ダウンロード可能なファイルがありません');
      return;
    }

    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL;
      const token = localStorage.getItem('adminToken');
      
      const response = await fetch(`${baseUrl}/api/admin/legal/${doc.id}/download`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        window.open(data.downloadUrl, '_blank');
      } else {
        toast.error('ダウンロードURLの取得に失敗しました');
      }
    } catch (error) {
      console.error('Download error:', error);
      toast.error('ダウンロードに失敗しました');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#115e59]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* ダッシュボードに戻るボタン */}
        <button
          onClick={() => router.push('/dashboard')}
          className="flex items-center text-gray-600 hover:text-gray-800 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          ダッシュボードに戻る
        </button>

        {/* ヘッダー */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">法的文書管理</h1>
            <p className="text-gray-600 mt-2">利用規約・プライバシーポリシー等のファイル管理</p>
          </div>
          <Button 
            onClick={handleOpenUploader} 
            className="bg-[#115e59] hover:bg-[#0f766e] text-white"
            disabled={uploading}
          >
            <Plus className="w-4 h-4 mr-2" />
            ファイルアップロード
          </Button>
        </div>

        {/* 文書一覧 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              登録文書一覧
            </CardTitle>
          </CardHeader>
          <CardContent>
            {documents && documents.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-[#115e59] text-white">
                    <tr>
                      <th className="text-left p-4 font-medium">文書種別</th>
                      <th className="text-left p-4 font-medium">タイトル</th>
                      <th className="text-left p-4 font-medium">ファイル情報</th>
                      <th className="text-left p-4 font-medium">バージョン</th>
                      <th className="text-left p-4 font-medium">状態</th>
                      <th className="text-left p-4 font-medium">公開日</th>
                      <th className="text-left p-4 font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.map((doc) => (
                      <tr key={doc.id} className="border-t hover:bg-slate-50">
                        <td className="p-4">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-500 text-white">
                            {documentTypes.find(t => t.value === doc.type)?.label}
                          </span>
                        </td>
                        <td className="p-4 font-medium">{doc.title}</td>
                        <td className="p-4">
                          {doc.metadata ? (
                            <div>
                              <p className="text-sm font-medium">{doc.metadata.originalFileName}</p>
                              <p className="text-xs text-gray-500">
                                {formatFileSize(doc.metadata.fileSize)} • 
                                {doc.metadata.originalFileName.split('.').pop()?.toUpperCase()}
                              </p>
                            </div>
                          ) : (
                            <span className="text-gray-400 text-sm">ファイルなし</span>
                          )}
                        </td>
                        <td className="p-4">
                          <Badge variant="outline">{doc.version}</Badge>
                        </td>
                        <td className="p-4">
                          {doc.isActive ? (
                            <div className="flex items-center gap-1">
                              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                              <CheckCircle className="w-4 h-4 text-green-600" />
                              <span className="text-green-700 text-sm font-medium">有効</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <div className="w-2 h-2 bg-gray-400 rounded-full" />
                              <X className="w-4 h-4 text-gray-500" />
                              <span className="text-gray-600 text-sm">無効</span>
                            </div>
                          )}
                        </td>
                        <td className="p-4 text-sm text-gray-600">
                          {doc.publishedAt ? (
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(doc.publishedAt).toLocaleDateString('ja-JP')}
                            </div>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="p-4">
                          <div className="flex gap-2">
                            {/* プレビューボタン */}
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handlePreview(doc)}
                              className="h-8 px-2 hover:bg-gray-100"
                              title="文書情報を表示"
                            >
                              <Eye className="w-3 h-3 mr-1" />
                              詳細
                            </Button>
                            
                            {/* ダウンロードボタン */}
                            {doc.s3Key && (
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => handleDownload(doc)}
                                className="h-8 px-2 hover:bg-blue-50 text-blue-600 hover:text-blue-700"
                                title="ファイルをダウンロード"
                              >
                                <Download className="w-3 h-3 mr-1" />
                                DL
                              </Button>
                            )}
                            
                            {/* 無効化ボタン */}
                            {doc.isActive && (
                              <Button 
                                size="sm" 
                                variant="destructive"
                                onClick={() => {
                                  if (confirm(
                                    `⚠️ 緊急無効化の確認\n\n` +
                                    `「${doc.title}」を無効化すると、ユーザーはこの文書を閲覧できなくなります。\n\n` +
                                    `通常は新しいバージョンをアップロードすることで自動的に切り替わります。\n` +
                                    `緊急時のみこの機能を使用してください。\n\n` +
                                    `本当に無効化しますか？`
                                  )) {
                                    deactivateDocumentMutation.mutate(doc.id);
                                  }
                                }}
                                className="h-8 px-3 bg-red-600 hover:bg-red-700 text-white"
                                disabled={deactivateDocumentMutation.isPending}
                                title="緊急時のみ：この文書を即座に無効化"
                              >
                                {deactivateDocumentMutation.isPending ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <>
                                    <X className="w-3 h-3 mr-1" />
                                    緊急無効化
                                  </>
                                )}
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-4">まだ文書がアップロードされていません</p>
                <Button 
                  onClick={handleOpenUploader} 
                  variant="outline"
                  disabled={uploading}
                >
                  最初のファイルをアップロード
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* アップローダーモーダル */}
        {showUploader && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg w-full max-w-lg">
              <div className="p-6 border-b flex justify-between items-center">
                <h2 className="text-xl font-bold">ファイルアップロード</h2>
                <Button variant="ghost" onClick={() => setShowUploader(false)} disabled={uploading}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              
              <div className="p-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                  <p className="text-sm text-blue-800">
                    <strong>ℹ️ 自動切り替えについて：</strong><br />
                    新しい文書をアップロードすると、同じ種別の既存文書は自動的に無効化され、
                    最新版のみが有効になります。
                  </p>
                </div>
                <div className="space-y-4">
                  <div>
                    <Label>文書種別 *</Label>
                    <Select 
                      value={uploaderForm.type}
                      onValueChange={handleTypeChange}
                      disabled={uploading}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {documentTypes.map(type => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label>タイトル *</Label>
                    <Input
                      value={uploaderForm.title}
                      onChange={(e) => setUploaderForm({...uploaderForm, title: e.target.value})}
                      placeholder="文書のタイトルを入力"
                      disabled={uploading}
                    />
                  </div>
                  
                  <div>
                    <Label>バージョン（自動設定）</Label>
                    <Input
                      value={uploaderForm.version}
                      disabled
                      className="bg-gray-100"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      バージョンは自動的に設定されます（0.1刻み）
                    </p>
                  </div>

                  {/* ファイルアップロード */}
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                    <div className="text-center">
                      <input
                        type="file"
                        id="file-upload"
                        accept=".md,.txt,.docx,.pdf"
                        className="hidden"
                        onChange={handleFileUpload}
                        disabled={uploading}
                      />
                      <label
                        htmlFor="file-upload"
                        className={`cursor-pointer inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 ${
                          uploading ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      >
                        {uploading ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            アップロード中...
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4 mr-2" />
                            ファイルを選択
                          </>
                        )}
                      </label>
                      <p className="text-xs text-gray-500 mt-2">
                        Word (.docx), PDF (.pdf), Markdown (.md), テキスト (.txt)
                      </p>
                      <p className="text-xs text-gray-500">
                        最大ファイルサイズ: 10MB
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="p-6 border-t flex justify-end gap-3 bg-gray-50">
                <Button 
                  variant="outline" 
                  onClick={() => setShowUploader(false)}
                  disabled={uploading}
                >
                  キャンセル
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* プレビューモーダル */}
        {previewDoc && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden">
              <div className="p-6 border-b flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold">{previewDoc.title}</h2>
                  <p className="text-sm text-gray-600">
                    バージョン {previewDoc.version}
                    {previewDoc.metadata && ` • ${previewDoc.metadata.originalFileName}`}
                  </p>
                </div>
                <Button variant="ghost" onClick={() => setPreviewDoc(null)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              
              <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
                <div className="text-center py-8">
                  <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 mb-4">
                    ファイルのプレビューはダウンロードしてご確認ください
                  </p>
                  {previewDoc.metadata && (
                    <div className="bg-gray-50 rounded-lg p-4 mb-4">
                      <h3 className="font-medium mb-2">ファイル情報</h3>
                      <div className="text-sm text-gray-600 space-y-1">
                        <p><strong>ファイル名:</strong> {previewDoc.metadata.originalFileName}</p>
                        <p><strong>サイズ:</strong> {formatFileSize(previewDoc.metadata.fileSize)}</p>
                        <p><strong>形式:</strong> {previewDoc.metadata.mimeType}</p>
                      </div>
                    </div>
                  )}
                  {previewDoc.s3Key && (
                    <Button onClick={() => handleDownload(previewDoc)} className="bg-[#115e59] hover:bg-[#0f766e] text-white">
                      <Download className="w-4 h-4 mr-2" />
                      ファイルをダウンロード
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}