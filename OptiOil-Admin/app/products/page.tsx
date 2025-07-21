// /OptiOil-Admin/app/products/page.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Plus, Pencil, Search, ArrowLeft, Trash2, ArrowUpDown, ArrowUp, ArrowDown, Upload, Download } from 'lucide-react';
import api from '@/lib/axios';
import axios from 'axios';

// 型定義
interface ProductMaster {
  id: number;
  code: string;
  name: string;
  manufacturer: string;
  capacity: string;
  unit: string;
  oilType: string;
  internalTag?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function ProductsPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductMaster | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | null>(null);
  const [isCsvUploadOpen, setIsCsvUploadOpen] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (!token) {
      router.push('/login');
    }
  }, [router]);

  // 商品一覧取得
  const { data: allProducts, isLoading } = useQuery({
    queryKey: ['adminProducts', searchTerm],
    queryFn: async () => {
      const response = await api.get('/api/admin/products', {
        params: { search: searchTerm },
      });
      return response.data as ProductMaster[];
    },
  });

  // ソート処理
  const products = useMemo(() => {
    if (!allProducts) return [];
    
    if (!sortOrder) return allProducts;
    
    return [...allProducts].sort((a, b) => {
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();
      if (sortOrder === 'asc') {
        return aName.localeCompare(bName);
      } else {
        return bName.localeCompare(aName);
      }
    });
  }, [allProducts, sortOrder]);

  // 商品作成
  const createMutation = useMutation({
    mutationFn: async (data: Partial<ProductMaster>) => {
      const response = await api.post('/api/admin/products', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminProducts'] });
      setIsCreateOpen(false);
      toast.success('商品を作成しました', {
        description: '新しい商品マスタが登録されました',
      });
    },
    onError: (error: unknown) => {
      let errorMessage = '商品の作成に失敗しました';
      
      if (axios.isAxiosError(error)) {
        errorMessage = error.response?.data?.error || error.message || errorMessage;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      toast.error('エラー', {
        description: errorMessage,
      });
    },
  });

  // 商品更新
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<ProductMaster> }) => {
      const response = await api.put(`/api/admin/products/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminProducts'] });
      setEditingProduct(null);
      toast.success('商品を更新しました');
    },
    onError: () => {
      toast.error('商品の更新に失敗しました');
    },
  });

  // 商品削除
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await api.delete(`/api/admin/products/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminProducts'] });
      toast.success('商品を削除しました');
    },
    onError: () => {
      toast.error('商品の削除に失敗しました');
    },
  });

  // CSV一括アップロード
  const csvUploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const response = await api.post('/api/admin/products/bulk-upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['adminProducts'] });
      setIsCsvUploadOpen(false);
      toast.success('CSV一括アップロードが完了しました', {
        description: `${data.successCount}件の商品を追加しました${data.errorCount > 0 ? `（エラー: ${data.errorCount}件）` : ''}`,
      });
    },
    onError: (error: unknown) => {
      let errorMessage = 'ファイルの処理中にエラーが発生しました';
      if (axios.isAxiosError(error) && error.response?.data?.error) {
        errorMessage = error.response.data.error;
      }
      toast.error('CSV一括アップロードに失敗しました', {
        description: errorMessage,
      });
    },
  });

  // CSVテンプレートダウンロード
  const downloadCsvTemplate = () => {
    const headers = ['code', 'name', 'manufacturer', 'capacity', 'unit', 'oilType'];
    const sampleData = [
      ['SAMPLE001', 'サンプル商品1', 'サンプルメーカー', '200', 'L', '切削油'],
      ['SAMPLE002', 'サンプル商品2', 'テストメーカー', '20', 'L', '作動油'],
    ];
    
    const csvContent = [headers, ...sampleData]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');
    
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'products_template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, active }: { id: number; active: boolean }) => {
      const response = await api.patch(`/api/admin/products/${id}/active`, { active });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminProducts'] });
      toast.success('ステータスを変更しました');
    },
  });

  const handleSort = () => {
    if (sortOrder === null) {
      setSortOrder('asc');
    } else if (sortOrder === 'asc') {
      setSortOrder('desc');
    } else {
      setSortOrder(null);
    }
  };

  const getSortIcon = () => {
    if (sortOrder === 'asc') return <ArrowUp className="w-4 h-4" />;
    if (sortOrder === 'desc') return <ArrowDown className="w-4 h-4" />;
    return <ArrowUpDown className="w-4 h-4" />;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* ヘッダー */}
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            onClick={() => router.push('/dashboard')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            ダッシュボードに戻る
          </Button>
        </div>

        {/* タイトル */}
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">商品マスタ管理</h1>
          <p className="text-muted-foreground">
            システム全体の商品マスタを管理します。会社ごとの表示設定は会社管理画面で行います。
          </p>
        </div>

        {/* 検索と追加 */}
        <div className="flex items-center justify-between bg-white p-4 rounded-lg border shadow-sm">
          <div className="flex items-center space-x-2">
            <Search className="w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="商品名、コード、メーカーで検索..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-80"
            />
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              onClick={downloadCsvTemplate}
            >
              <Download className="w-4 h-4 mr-2" />
              CSVテンプレート
            </Button>
            <Dialog open={isCsvUploadOpen} onOpenChange={setIsCsvUploadOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Upload className="w-4 h-4 mr-2" />
                  CSV一括追加
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>CSV一括アップロード</DialogTitle>
                  <DialogDescription>
                    CSVファイルを使用して商品を一括で追加できます
                  </DialogDescription>
                </DialogHeader>
                <CsvUploadForm
                  onSubmit={(file) => csvUploadMutation.mutate(file)}
                  isLoading={csvUploadMutation.isPending}
                  onDownloadTemplate={downloadCsvTemplate}
                />
              </DialogContent>
            </Dialog>
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  商品を追加
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>新規商品作成</DialogTitle>
                  <DialogDescription>
                    新しい商品マスタを作成します
                  </DialogDescription>
                </DialogHeader>
                <ProductForm
                  onSubmit={(data) => createMutation.mutate(data)}
                  isLoading={createMutation.isPending}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* 商品テーブル */}
        <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="w-28 py-3 px-4 font-semibold">商品コード</TableHead>
                <TableHead className="min-w-52 py-3 px-4 font-semibold">
                  <button
                    onClick={handleSort}
                    className="flex items-center space-x-1 hover:text-primary transition-colors"
                  >
                    <span>商品名</span>
                    {getSortIcon()}
                  </button>
                </TableHead>
                <TableHead className="w-44 py-3 px-4 font-semibold">メーカー</TableHead>
                <TableHead className="w-24 py-3 px-4 font-semibold">容量</TableHead>
                <TableHead className="w-28 py-3 px-4 font-semibold">油種</TableHead>
                <TableHead className="w-28 py-3 px-4 text-center font-semibold">ステータス</TableHead>
                <TableHead className="w-32 py-3 px-4 text-center font-semibold">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    <div className="flex items-center justify-center space-x-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
                      <span>読み込み中...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : products?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    商品が見つかりません
                  </TableCell>
                </TableRow>
              ) : (
                products?.map((product: ProductMaster) => (
                  <TableRow key={product.id} className="hover:bg-gray-50/50">
                    <TableCell className="py-3 px-4 font-mono text-sm">{product.code}</TableCell>
                    <TableCell className="py-3 px-4 font-medium">{product.name}</TableCell>
                    <TableCell className="py-3 px-4">{product.manufacturer}</TableCell>
                    <TableCell className="py-3 px-4">{product.capacity}{product.unit}</TableCell>
                    <TableCell className="py-3 px-4">{product.oilType}</TableCell>
                    <TableCell className="py-3 px-4 text-center">
                      <Switch
                        checked={product.active}
                        onCheckedChange={(checked) => 
                          toggleActiveMutation.mutate({ id: product.id, active: checked })
                        }
                      />
                    </TableCell>
                    <TableCell className="py-3 px-4">
                      <div className="flex items-center justify-center space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingProduct(product)}
                          className="h-8 w-8 p-0"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>商品を削除しますか？</AlertDialogTitle>
                              <AlertDialogDescription>
                                商品「{product.name}」を削除します。この操作は取り消すことができません。
                                関連する会社の商品設定からも削除されます。
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>キャンセル</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteMutation.mutate(product.id)}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                削除する
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* 編集ダイアログ */}
        {editingProduct && (
          <Dialog open={!!editingProduct} onOpenChange={() => setEditingProduct(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>商品編集</DialogTitle>
                <DialogDescription>
                  商品情報を編集します
                </DialogDescription>
              </DialogHeader>
              <ProductForm
                product={editingProduct}
                onSubmit={(data) => 
                  updateMutation.mutate({ id: editingProduct.id, data })
                }
                isLoading={updateMutation.isPending}
              />
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}

// CSVアップロードフォームコンポーネント
function CsvUploadForm({
  onSubmit,
  isLoading,
  onDownloadTemplate,
}: {
  onSubmit: (file: File) => void;
  isLoading: boolean;
  onDownloadTemplate: () => void;
}) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
        setSelectedFile(file);
      } else {
        toast.error('CSVファイルを選択してください');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
        setSelectedFile(file);
      } else {
        toast.error('CSVファイルを選択してください');
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedFile) {
      onSubmit(selectedFile);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>CSVファイル</Label>
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
            dragActive 
              ? 'border-primary bg-primary/5' 
              : 'border-gray-300 hover:border-gray-400'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
          <div className="space-y-2">
            <p className="text-sm text-gray-600">
              CSVファイルをドラッグ&ドロップするか、クリックして選択
            </p>
            <Input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="cursor-pointer"
            />
          </div>
        </div>
        {selectedFile && (
          <div className="text-sm text-gray-600">
            選択されたファイル: {selectedFile.name}
          </div>
        )}
      </div>

      <div className="bg-blue-50 p-4 rounded-lg">
        <h4 className="font-medium text-blue-900 mb-2">CSVフォーマット</h4>
        <p className="text-sm text-blue-700 mb-2">
          以下の列を含むCSVファイルをアップロードしてください：
        </p>
        <div className="text-xs font-mono bg-white p-2 rounded border">
          code,name,manufacturer,capacity,unit,oilType
        </div>
        <Button
          type="button"
          variant="link"
          size="sm"
          onClick={onDownloadTemplate}
          className="text-blue-600 p-0 h-auto mt-2"
        >
          テンプレートファイルをダウンロード
        </Button>
      </div>

      <div className="bg-yellow-50 p-4 rounded-lg">
        <h4 className="font-medium text-yellow-900 mb-2">注意事項</h4>
        <ul className="text-sm text-yellow-700 space-y-1">
          <li>• 重複する商品コードがある場合はスキップされます</li>
          <li>• 必須項目が空の行はエラーとなります</li>
          <li>• 文字エンコードはUTF-8を使用してください</li>
        </ul>
      </div>

      <div className="flex justify-end space-x-2">
        <Button type="submit" disabled={!selectedFile || isLoading}>
          {isLoading ? 'アップロード中...' : 'アップロード'}
        </Button>
      </div>
    </form>
  );
}

// 商品フォームコンポーネント
function ProductForm({
  product,
  onSubmit,
  isLoading,
}: {
  product?: ProductMaster;
  onSubmit: (data: Partial<ProductMaster>) => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState({
    code: product?.code || '',
    name: product?.name || '',
    manufacturer: product?.manufacturer || '',
    capacity: product?.capacity || '',
    unit: product?.unit || '',
    oilType: product?.oilType || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="code">商品コード</Label>
          <Input
            id="code"
            value={formData.code}
            onChange={(e) => setFormData({ ...formData, code: e.target.value })}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="name">商品名</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="manufacturer">メーカー</Label>
          <Input
            id="manufacturer"
            value={formData.manufacturer}
            onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="oilType">油種</Label>
          <Input
            id="oilType"
            value={formData.oilType}
            onChange={(e) => setFormData({ ...formData, oilType: e.target.value })}
            required
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="capacity">容量</Label>
          <Input
            id="capacity"
            value={formData.capacity}
            onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="unit">単位</Label>
          <Input
            id="unit"
            placeholder="L, mL, kg"
            value={formData.unit}
            onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
            required
          />
        </div>
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={isLoading}>
          {isLoading ? '保存中...' : '保存'}
        </Button>
      </div>
    </form>
  );
}