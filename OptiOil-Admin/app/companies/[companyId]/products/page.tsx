// optioil-admin/app/companies/[companyId]/products/page.tsx
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { 
  ArrowLeft, Search, Plus, Save, ArrowUpDown, ArrowUp, ArrowDown, AlertTriangle,
  Calendar as CalendarIcon, Clock, CalendarClock, Edit, Trash2, RefreshCw, History,
} from 'lucide-react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import api from '@/lib/axios';

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
  packageType?: string;
  active: boolean;
  companyProduct: { 
    id: number;
    enabled: boolean; 
    displayOrder: number;
    price: number | null;
    quotationExpiryDate: string | null;
  } | null;
}

interface PriceSchedule {
  id: number;
  scheduledPrice: number;
  effectiveDate: string;
  expiryDate: string | null;
  isApplied: boolean;
  productName: string;
  productCode: string;
}

interface Company {
  id: number;
  name: string;
}

interface ApiError {
  message: string;
}

interface PriceHistoryData {
  data: PriceSchedule[];
  total: number;
  totalPages: number;
  currentPage: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export default function CompanyProductsPage() {
  const router = useRouter();
  const params = useParams();
  const companyId = parseInt(params.companyId as string);
  const queryClient = useQueryClient();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<Set<number>>(new Set());
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [addSearchTerm, setAddSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | null>(null);
  const [tempPrices, setTempPrices] = useState<Record<number, string>>({});
  
  // スケジュール価格設定
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [selectedProductForSchedule, setSelectedProductForSchedule] = useState<ProductMaster | null>(null);
  const [schedulePrice, setSchedulePrice] = useState('');
  const [scheduleDate, setScheduleDate] = useState<Date | undefined>(undefined);
  const [editingSchedule, setEditingSchedule] = useState<PriceSchedule | null>(null);
  const [scheduleExpiryDate, setScheduleExpiryDate] = useState<Date | undefined>(undefined);

  // 価格履歴表示用state
  const [priceHistoryDialogOpen, setPriceHistoryDialogOpen] = useState(false);
  const [selectedProductForHistory, setSelectedProductForHistory] = useState<ProductMaster | null>(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyLimit] = useState(10); // 1ページ10件

  // 認証チェック
  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (!token) {
      router.push('/login');
    }
  }, [router]);

  // 会社情報取得
  const { data: company } = useQuery({
    queryKey: ['company', companyId],
    queryFn: async (): Promise<Company> => {
      const response = await api.get(`/api/admin/companies/${companyId}`);
      return response.data;
    },
    enabled: !!companyId && !isNaN(companyId),
  });

  // 商品マスタ一覧取得
  const { data: allProducts, isLoading: isLoadingProducts, refetch: refetchProducts } = useQuery({
    queryKey: ['companyProducts', companyId],
    queryFn: async (): Promise<ProductMaster[]> => {
      const response = await api.get(`/api/admin/companies/${companyId}/products`);
      return response.data;
    },
    enabled: !!companyId && !isNaN(companyId),
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
    staleTime: 5 * 60 * 1000,
  });

  // スケジュール価格一覧取得
  const { data: priceSchedules, refetch: refetchSchedules } = useQuery({
    queryKey: ['priceSchedules', companyId],
    queryFn: async (): Promise<Record<number, PriceSchedule[]>> => {
      const response = await api.get(`/api/admin/companies/${companyId}/price-schedules`);
      return response.data;
    },
    enabled: !!companyId && !isNaN(companyId),
  });

  // メモ化：現在表示中の商品
  const companyProducts = useMemo(() => {
    return allProducts?.filter(p => p.companyProduct?.enabled) || [];
  }, [allProducts]);

  // メモ化：期限切れまたは1ヶ月以内の商品数（スケジュール設定済みは除外）
  const expiryWarningCount = useMemo(() => {
    const now = new Date();
    const oneMonthFromNow = new Date();
    oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);
    
    return companyProducts.filter(p => {
      if (!p.companyProduct?.quotationExpiryDate) return false;
      const expiryDate = new Date(p.companyProduct.quotationExpiryDate);
      if (expiryDate > oneMonthFromNow) return false;
      
      // スケジュール設定があるかチェック
      const productSchedules = priceSchedules?.[p.companyProduct.id] || [];
      const hasValidSchedule = productSchedules.some(schedule => {
        const scheduleDate = new Date(schedule.effectiveDate);
        return scheduleDate >= now && scheduleDate <= oneMonthFromNow && !schedule.isApplied;
      });
      
      return !hasValidSchedule; // スケジュール設定がない場合のみ警告対象
    }).length;
  }, [companyProducts, priceSchedules]);

  // メモ化：未設定単価数のカウント
  const unsetPriceCount = useMemo(() => {
    return companyProducts.filter(p => 
      p.companyProduct?.price === null || p.companyProduct?.price === undefined
    ).length;
  }, [companyProducts]);

  // メモ化：未設定見積期限数のカウント
  const unsetExpiryCount = useMemo(() => {
    return companyProducts.filter(p => 
      !p.companyProduct?.quotationExpiryDate
    ).length;
  }, [companyProducts]);

  // 価格履歴取得（ページネーション対応）
  const getAppliedPriceHistory = useCallback((companyProductId: number, page: number = 1, limit: number = 10): PriceHistoryData => {
    const productSchedules = priceSchedules?.[companyProductId] || [];
    const sortedHistory = productSchedules
      .filter(schedule => schedule.isApplied)
      .sort((a, b) => new Date(b.effectiveDate).getTime() - new Date(a.effectiveDate).getTime());
    
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    
    return {
      data: sortedHistory.slice(startIndex, endIndex),
      total: sortedHistory.length,
      totalPages: Math.ceil(sortedHistory.length / limit),
      currentPage: page,
      hasNextPage: page < Math.ceil(sortedHistory.length / limit),
      hasPrevPage: page > 1
    };
  }, [priceSchedules]);

  // 一覧表示用のシンプルな関数（既存の表示で使用）
  const getAppliedPriceHistorySimple = useCallback((companyProductId: number): PriceSchedule[] => {
    const productSchedules = priceSchedules?.[companyProductId] || [];
    return productSchedules
      .filter(schedule => schedule.isApplied)
      .sort((a, b) => new Date(b.effectiveDate).getTime() - new Date(a.effectiveDate).getTime());
  }, [priceSchedules]);

  // メモ化：利用可能な商品（検索フィルタリング付き）
  const availableProducts = useMemo(() => {
    const available = allProducts?.filter(p => !p.companyProduct) || [];
    
    if (!addSearchTerm.trim()) return available;
    
    return available.filter(product => 
      product.name.toLowerCase().includes(addSearchTerm.toLowerCase()) ||
      product.code.toLowerCase().includes(addSearchTerm.toLowerCase()) ||
      product.manufacturer.toLowerCase().includes(addSearchTerm.toLowerCase()) ||
      product.oilType.toLowerCase().includes(addSearchTerm.toLowerCase()) ||
      (product.packageType && product.packageType.toLowerCase().includes(addSearchTerm.toLowerCase())) // 🆕 荷姿での検索追加
    );
  }, [allProducts, addSearchTerm]);

  // メモ化：表示商品の検索フィルタリング＋ソート
  const filteredCompanyProducts = useMemo(() => {
    let result = companyProducts;
    
    // 検索フィルタリング
    if (searchTerm.trim()) {
      result = result.filter((product) => {
        return (
          product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          product.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
          product.manufacturer.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (product.packageType && product.packageType.toLowerCase().includes(searchTerm.toLowerCase()))
        );
      });
    }

    // ソート
    if (sortOrder) {
      result = [...result].sort((a, b) => {
        const aName = a.name.toLowerCase();
        const bName = b.name.toLowerCase();
        if (sortOrder === 'asc') {
          return aName.localeCompare(bName);
        } else {
          return bName.localeCompare(aName);
        }
      });
    }

    return result;
  }, [companyProducts, searchTerm, sortOrder]);

  // 単価更新
  const updatePriceMutation = useMutation({
    mutationFn: async ({ companyProductId, price }: { companyProductId: number; price: number | null }) => {
      const response = await api.patch(`/api/admin/companies/${companyId}/products`, {
        companyProductId,
        price,
      });
      return response.data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['companyProducts', companyId] });
      toast.success('単価を更新しました');
      
      if (variables.price !== null) {
        setTimeout(() => {
          toast.info('単価更新した場合は見積書のアップロードもお忘れなく！ドキュメント管理画面からアップロードできます。', {
            duration: 5000,
          });
        }, 1000);
      }
    },
    onError: (error: unknown) => {
      console.error('Price update error:', error);
      const apiError = error as ApiError;
      toast.error(apiError?.message || '単価の更新に失敗しました');
    },
  });

  // 見積期限更新
  const updateExpiryMutation = useMutation({
    mutationFn: async ({ companyProductId, quotationExpiryDate }: { companyProductId: number; quotationExpiryDate: Date | null }) => {
      const response = await api.patch(`/api/admin/companies/${companyId}/products`, {
        companyProductId,
        quotationExpiryDate: quotationExpiryDate?.toISOString(),
      });
      return response.data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['companyProducts', companyId] });
      toast.success('見積期限を更新しました');
      
      if (variables.quotationExpiryDate) {
        setTimeout(() => {
          toast.info('単価変更した場合は、見積書のアップロードもお忘れなく！ドキュメント管理画面からアップロードできます。', {
            duration: 5000,
          });
        }, 1000);
      }
    },
    onError: (error: unknown) => {
      console.error('Expiry update error:', error);
      const apiError = error as ApiError;
      toast.error(apiError?.message || '見積期限の更新に失敗しました');
    },
  });

  // スケジュール価格作成・更新
  const createScheduleMutation = useMutation({
    mutationFn: async ({ companyProductId, scheduledPrice, effectiveDate, expiryDate, scheduleId }: { 
      companyProductId: number; 
      scheduledPrice: number; 
      effectiveDate: Date;
      expiryDate: Date;
      scheduleId?: number;
    }) => {
      if (scheduleId) {
        // 更新
        const response = await api.put(`/api/admin/companies/${companyId}/price-schedules`, {
          scheduleId,
          scheduledPrice,
          effectiveDate: effectiveDate.toISOString(),
          expiryDate: expiryDate.toISOString(),
        });
        return response.data;
      } else {
        // 新規作成
        const response = await api.post(`/api/admin/companies/${companyId}/price-schedules`, {
          companyProductId,
          scheduledPrice,
          effectiveDate: effectiveDate.toISOString(),
          expiryDate: expiryDate.toISOString(),
        });
        return response.data;
      }
    },
    onSuccess: async () => {
      // 強制的にキャッシュをクリアして最新データを取得
      queryClient.removeQueries({ queryKey: ['companyProducts', companyId] });
      queryClient.removeQueries({ queryKey: ['priceSchedules', companyId] });
      
      // 即座にrefetch実行
      try {
        await Promise.all([
          refetchSchedules(),
          refetchProducts()
        ]);
        toast.success(editingSchedule ? 'スケジュール価格を更新しました' : 'スケジュール価格を設定しました');
      } catch (error) {
        console.error('Refetch error:', error);
      }
      
      setScheduleDialogOpen(false);
      setSelectedProductForSchedule(null);
      setEditingSchedule(null);
      setSchedulePrice('');
      setScheduleDate(undefined);
      setScheduleExpiryDate(undefined);
    },
    onError: (error: unknown) => {
      console.error('Schedule creation error:', error);
      const apiError = error as ApiError;
      toast.error(apiError?.message || 'スケジュール価格の設定に失敗しました');
    },
  });

  // スケジュール価格削除
  const deleteScheduleMutation = useMutation({
    mutationFn: async (scheduleId: number) => {
      const response = await api.delete(`/api/admin/companies/${companyId}/price-schedules`, {
        data: { scheduleId }
      });
      return response.data;
    },
    onSuccess: () => {
      refetchSchedules();
      toast.success('スケジュール価格を削除しました');
    },
    onError: (error: unknown) => {
      console.error('Schedule deletion error:', error);
      const apiError = error as ApiError;
      toast.error(apiError?.message || 'スケジュール価格の削除に失敗しました');
    },
  });

  // 商品更新
  const updateProductsMutation = useMutation({
    mutationFn: async (productIds: number[]) => {
      const response = await api.put(`/api/admin/companies/${companyId}/products`, {
        productIds,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companyProducts', companyId] });
      setSelectedProducts(new Set());
      setIsAddDialogOpen(false);
      setAddSearchTerm('');
      toast.success('商品設定を更新しました');
    },
    onError: (error: unknown) => {
      console.error('Update error:', error);
      const apiError = error as ApiError;
      toast.error(apiError?.message || '商品設定の更新に失敗しました');
    },
  });

  // 日付関連のヘルパー関数
  const isExpired = useCallback((date: string | null): boolean => {
    if (!date) return false;
    return new Date(date) < new Date();
  }, []);

  const isExpiringSoon = useCallback((date: string | null): boolean => {
    if (!date) return false;
    const expiryDate = new Date(date);
    const oneMonthFromNow = new Date();
    oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);
    return expiryDate <= oneMonthFromNow && expiryDate >= new Date();
  }, []);

  // ステータス判定関数
  const getProductStatus = useCallback((quotationExpiryDate: string | null) => {
    if (!quotationExpiryDate) return 'normal'; // 期限未設定は正常
    
    if (isExpired(quotationExpiryDate)) return 'expired';
    if (isExpiringSoon(quotationExpiryDate)) return 'expiring';
    return 'normal';
  }, [isExpired, isExpiringSoon]);

  // イベントハンドラー
  const handlePriceBlur = useCallback((companyProductId: number, originalPrice: number | null) => {
    const tempPrice = tempPrices[companyProductId];
    if (tempPrice === undefined) return;

    const newPrice = tempPrice === '' ? null : parseFloat(tempPrice);
    
    if (newPrice === originalPrice) {
      return;
    }

    if (tempPrice !== '' && (isNaN(newPrice!) || newPrice! < 0)) {
      toast.error('有効な金額を入力してください');
      return;
    }

    updatePriceMutation.mutate({
      companyProductId,
      price: newPrice,
    });

    setTempPrices(prev => {
      const newState = { ...prev };
      delete newState[companyProductId];
      return newState;
    });
  }, [tempPrices, updatePriceMutation]);

  const handleExpiryDateSelect = useCallback((companyProductId: number, originalDate: string | null, newDate: Date | undefined) => {
    const originalDateObj = originalDate ? new Date(originalDate) : null;
    
    if (newDate?.getTime() === originalDateObj?.getTime()) {
      return;
    }

    updateExpiryMutation.mutate({
      companyProductId,
      quotationExpiryDate: newDate || null,
    });
  }, [updateExpiryMutation]);

  const handleOpenScheduleDialog = useCallback((product: ProductMaster, schedule?: PriceSchedule) => {
    setSelectedProductForSchedule(product);
    if (schedule) {
      setEditingSchedule(schedule);
      setSchedulePrice(schedule.scheduledPrice.toString());
      setScheduleDate(new Date(schedule.effectiveDate));
      setScheduleExpiryDate(schedule.expiryDate ? new Date(schedule.expiryDate) : undefined);
    } else {
      setEditingSchedule(null);
      setSchedulePrice('');
      setScheduleDate(undefined);
      setScheduleExpiryDate(undefined);
    }
    setScheduleDialogOpen(true);
  }, []);

  // 価格履歴ダイアログを開く
  const handleOpenPriceHistoryDialog = useCallback((product: ProductMaster) => {
    setSelectedProductForHistory(product);
      setHistoryPage(1); // ページをリセット
    setPriceHistoryDialogOpen(true);
  }, []);

  const handleCreateOrUpdateSchedule = useCallback(() => {
    if (!selectedProductForSchedule?.companyProduct || !schedulePrice || !scheduleDate || !scheduleExpiryDate) {
      toast.error('すべての項目を入力してください');
      return;
    }

    const price = parseFloat(schedulePrice);
    if (isNaN(price) || price < 0) {
      toast.error('有効な金額を入力してください');
      return;
    }

    if (scheduleDate <= new Date()) {
      toast.error('未来の日時を選択してください');
      return;
    }

    // 終了日のバリデーション（必須）
    if (scheduleExpiryDate <= scheduleDate) {
      toast.error('終了日は開始日より後の日時を選択してください');
      return;
    }

    createScheduleMutation.mutate({
      companyProductId: selectedProductForSchedule.companyProduct.id,
      scheduledPrice: price,
      effectiveDate: scheduleDate,
      expiryDate: scheduleExpiryDate,
      scheduleId: editingSchedule?.id,
    });
  }, [selectedProductForSchedule, schedulePrice, scheduleDate, scheduleExpiryDate, editingSchedule, createScheduleMutation]);

  const handleDeleteSchedule = useCallback((scheduleId: number) => {
    if (confirm('スケジュール価格を削除してもよろしいですか？')) {
      deleteScheduleMutation.mutate(scheduleId);
    }
  }, [deleteScheduleMutation]);

  // その他のハンドラー
  const handleSaveProducts = useCallback(() => {
    const currentProductIds = companyProducts.map(p => p.id);
    const newProductIds = Array.from(selectedProducts);
    const uniqueNewProductIds = newProductIds.filter(id => !currentProductIds.includes(id));
    const allProductIds = [...currentProductIds, ...uniqueNewProductIds];
    
    if (allProductIds.length === 0) {
      toast.warning('少なくとも1つの商品を選択してください');
      return;
    }
    
    updateProductsMutation.mutate(allProductIds);
  }, [companyProducts, selectedProducts, updateProductsMutation]);

  const handleRemoveProduct = useCallback((productId: number) => {
    const remainingProductIds = companyProducts
      .filter(p => p.id !== productId)
      .map(p => p.id);
    
    updateProductsMutation.mutate(remainingProductIds);
  }, [companyProducts, updateProductsMutation]);

  const handleSelectProduct = useCallback((productId: number, checked: boolean) => {
    const newSelected = new Set(selectedProducts);
    if (checked) {
      newSelected.add(productId);
    } else {
      newSelected.delete(productId);
    }
    setSelectedProducts(newSelected);
  }, [selectedProducts]);

  const handleSelectAll = useCallback((checked: boolean) => {
    if (checked) {
      setSelectedProducts(new Set(availableProducts.map(p => p.id)));
    } else {
      setSelectedProducts(new Set());
    }
  }, [availableProducts]);

  const handleRefresh = useCallback(() => {
    refetchProducts();
    refetchSchedules();
    toast.info('データを更新しました');
  }, [refetchProducts, refetchSchedules]);

  const handleSort = useCallback(() => {
    if (sortOrder === null) {
      setSortOrder('asc');
    } else if (sortOrder === 'asc') {
      setSortOrder('desc');
    } else {
      setSortOrder(null);
    }
  }, [sortOrder]);

  const getSortIcon = useCallback(() => {
    if (sortOrder === 'asc') return <ArrowUp className="w-4 h-4" />;
    if (sortOrder === 'desc') return <ArrowDown className="w-4 h-4" />;
    return <ArrowUpDown className="w-4 h-4" />;
  }, [sortOrder]);

  const handleCloseScheduleDialog = useCallback(() => {
    setScheduleDialogOpen(false);
    setSelectedProductForSchedule(null);
    setEditingSchedule(null);
    setSchedulePrice('');
    setScheduleDate(undefined);
    setScheduleExpiryDate(undefined);
  }, []);

  const handleCloseAddDialog = useCallback(() => {
    setIsAddDialogOpen(false);
    setSelectedProducts(new Set());
    setAddSearchTerm('');
  }, []);

  const handleOpenDialog = useCallback(() => {
    setSelectedProducts(new Set());
    setAddSearchTerm('');
    setIsAddDialogOpen(true);
  }, []);

  // 価格履歴ダイアログを閉じる
  const handleClosePriceHistoryDialog = useCallback(() => {
    setPriceHistoryDialogOpen(false);
    setSelectedProductForHistory(null);
  }, []);

  if (isLoadingProducts && !allProducts) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* ヘッダー */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              onClick={() => router.push('/companies')}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              会社管理に戻る
            </Button>
            <Button variant="outline" onClick={handleRefresh}>
              <RefreshCw className="w-4 h-4 mr-2" />
              更新
            </Button>
          </div>
        </div>

        {/* タイトル */}
        <div>
          <h1 className="text-2xl font-bold">商品表示設定</h1>
          <p className="text-muted-foreground">
            {company?.name} で表示する商品を選択してください
          </p>
        </div>

        {/* 警告表示 */}
        {unsetPriceCount > 0 && (
          <Alert className="border-red-200 bg-red-50">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              <strong>{unsetPriceCount}件の商品</strong>で単価が未設定です。ユーザー承認前に単価を設定してください。
            </AlertDescription>
          </Alert>
        )}

        {unsetExpiryCount > 0 && (
          <Alert className="border-red-200 bg-red-50">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              <strong>{unsetExpiryCount}件の商品</strong>で見積期限が未設定です。見積期限を設定してください。
            </AlertDescription>
          </Alert>
        )}

        {expiryWarningCount > 0 && (
          <Alert className="border-orange-200 bg-orange-50">
            <Clock className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-800">
              <strong>{expiryWarningCount}件の商品</strong>で見積期限が1ヶ月以内に切れます。価格更新または期限延長が必要です。
            </AlertDescription>
          </Alert>
        )}

        {/* 表示商品一覧 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                表示商品一覧
                <span className="ml-2 text-sm text-muted-foreground">
                  チェックを入れた商品がユーザーに表示されます
                </span>
              </CardTitle>
              <div className="flex space-x-2">
                <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={handleOpenDialog}>
                      <Plus className="w-4 h-4 mr-2" />
                      商品を追加
                    </Button>
                  </DialogTrigger>
                  {/* 商品追加ダイアログ */}
                  <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
                    <DialogHeader className="flex-shrink-0">
                      <DialogTitle>商品を追加</DialogTitle>
                      <DialogDescription>
                        商品マスタから表示する商品を選択してください
                      </DialogDescription>
                    </DialogHeader>
                    
                    <div className="flex flex-col space-y-4 overflow-hidden flex-1">
                      {/* 検索 */}
                      <div className="flex items-center space-x-2 flex-shrink-0">
                        <Search className="w-4 h-4 text-muted-foreground" />
                        <Input
                          placeholder="商品名、コード、メーカー、荷姿で検索..."
                          value={addSearchTerm}
                          onChange={(e) => setAddSearchTerm(e.target.value)}
                          className="flex-1"
                        />
                      </div>

                      {/* 全選択 */}
                      {availableProducts.length > 0 && (
                        <div className="flex items-center space-x-2 border-b pb-2 flex-shrink-0">
                          <Checkbox
                            id="select-all"
                            checked={availableProducts.length > 0 && selectedProducts.size === availableProducts.length}
                            onCheckedChange={handleSelectAll}
                          />
                          <label htmlFor="select-all" className="text-sm font-medium">
                            すべて選択 ({selectedProducts.size} / {availableProducts.length} 商品を選択)
                          </label>
                        </div>
                      )}

                      {/* 商品一覧 */}
                      <div className="border rounded-lg overflow-hidden flex-1 min-h-0">
                        <div className="overflow-x-auto overflow-y-auto h-full">
                          <Table>
                            <TableHeader className="sticky top-0 bg-white">
                              <TableRow>
                                <TableHead className="w-12 min-w-12">選択</TableHead>
                                <TableHead className="w-20 min-w-20 text-xs">コード</TableHead>
                                <TableHead className="w-32 min-w-32 text-xs">商品名</TableHead>
                                <TableHead className="w-24 min-w-24 text-xs">メーカー</TableHead>
                                <TableHead className="w-16 min-w-16 text-xs">容量</TableHead>
                                <TableHead className="w-20 min-w-20 text-xs">油種</TableHead>
                                <TableHead className="w-16 min-w-16 text-xs">荷姿</TableHead>
                                <TableHead className="w-16 min-w-16 text-xs">タグ</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {availableProducts.length === 0 ? (
                                <TableRow>
                                  <TableCell colSpan={8} className="text-center py-8 text-sm">
                                    {addSearchTerm ? '検索条件に一致する商品がありません' : '追加可能な商品がありません'}
                                  </TableCell>
                                </TableRow>
                              ) : (
                                availableProducts.map((product) => (
                                  <TableRow key={product.id}>
                                    <TableCell className="p-2">
                                      <Checkbox
                                        checked={selectedProducts.has(product.id)}
                                        onCheckedChange={(checked) => 
                                          handleSelectProduct(product.id, checked as boolean)
                                        }
                                      />
                                    </TableCell>
                                    <TableCell className="font-mono text-xs p-2">{product.code}</TableCell>
                                    <TableCell className="text-xs p-2 max-w-32 truncate" title={product.name}>
                                      {product.name}
                                    </TableCell>
                                    <TableCell className="text-xs p-2 max-w-24 truncate" title={product.manufacturer}>
                                      {product.manufacturer}
                                    </TableCell>
                                    <TableCell className="text-xs p-2">
                                      {product.capacity}{product.unit}
                                    </TableCell>
                                    <TableCell className="text-xs p-2 max-w-20 truncate" title={product.oilType}>
                                      {product.oilType}
                                    </TableCell>
                                    <TableCell className="text-xs p-2 max-w-20 truncate" title={product.packageType}>
                                      {product.packageType || '未設定'}
                                    </TableCell>
                                    <TableCell className="p-2">
                                      {product.internalTag && (
                                        <Badge variant="secondary" className="text-xs px-1 py-0">
                                          {product.internalTag.substring(0, 4)}
                                          {product.internalTag.length > 4 ? '...' : ''}
                                        </Badge>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                ))
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      </div>

                      {/* アクション */}
                      <div className="flex justify-end space-x-2 flex-shrink-0 pt-4 border-t">
                        <Button
                          variant="outline"
                          onClick={handleCloseAddDialog}
                        >
                          キャンセル
                        </Button>
                        <Button
                          onClick={handleSaveProducts}
                          disabled={selectedProducts.size === 0 || updateProductsMutation.isPending}
                        >
                          <Save className="w-4 h-4 mr-2" />
                          {updateProductsMutation.isPending ? '保存中...' : `${selectedProducts.size}個の商品を追加`}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* 検索 */}
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Search className="w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="商品名、コード、メーカー、荷姿で検索..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-80"
                />
              </div>
              <div className="text-sm text-muted-foreground">
                {filteredCompanyProducts.length} / {companyProducts?.length || 0} 商品を表示中
              </div>
            </div>

            {/* 商品テーブル */}
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-32">商品コード</TableHead>
                    <TableHead className="min-w-48">
                      <button
                        onClick={handleSort}
                        className="flex items-center space-x-1 hover:text-primary transition-colors"
                      >
                        <span>商品名</span>
                        {getSortIcon()}
                      </button>
                    </TableHead>
                    <TableHead className="w-40">メーカー</TableHead>
                    <TableHead className="w-24">容量</TableHead>
                    <TableHead className="w-32">油種</TableHead>
                    <TableHead className="w-24">荷姿</TableHead>
                    <TableHead className="w-32">税抜単価（円）</TableHead>
                    <TableHead className="w-40">見積期限</TableHead>
                    <TableHead className="w-40">スケジュール</TableHead>
                    <TableHead className="w-24">ステータス</TableHead>
                    <TableHead className="w-20 text-center">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCompanyProducts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                        {searchTerm ? '検索条件に一致する商品がありません' : '表示商品がありません'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCompanyProducts.map((product) => {
                      const isPriceUnset = product.companyProduct?.price === null || product.companyProduct?.price === undefined;
                      const quotationExpiryDate = product.companyProduct?.quotationExpiryDate;
                      const isQuotationExpired = quotationExpiryDate ? isExpired(quotationExpiryDate) : false;
                      const isQuotationExpiringSoon = quotationExpiryDate ? isExpiringSoon(quotationExpiryDate) : false;
                      const companyProductId = product.companyProduct?.id;
                      const productSchedules = (companyProductId && priceSchedules?.[companyProductId]) || [];
                      
                      return (
                        <TableRow 
                          key={product.id} 
                          className={cn(
                            isQuotationExpired && "bg-gray-100",
                            isQuotationExpiringSoon && !isQuotationExpired && "bg-orange-50"
                          )}
                        >
                          <TableCell className="font-mono">{product.code}</TableCell>
                          <TableCell className="font-medium">{product.name}</TableCell>
                          <TableCell>{product.manufacturer}</TableCell>
                          <TableCell>{product.capacity}{product.unit}</TableCell>
                          <TableCell>{product.oilType}</TableCell>
                          
                          {/* 🆕 荷姿セル追加 */}
                          <TableCell>
                            {product.packageType ? (
                              <span className="text-sm">{product.packageType}</span>
                            ) : (
                              <span className="text-muted-foreground text-xs">未設定</span>
                            )}
                          </TableCell>
                          
                          {/* 税抜単価 */}
                          <TableCell>
                            <Input
                              type="number"
                              placeholder="未設定"
                              value={
                                tempPrices[product.companyProduct?.id ?? 0] !== undefined 
                                  ? tempPrices[product.companyProduct?.id ?? 0]
                                  : product.companyProduct?.price || ''
                              }
                              onChange={(e) => {
                              const companyProduct = product.companyProduct;
                              if (companyProduct?.id) {
                                setTempPrices(prev => ({
                                  ...prev,
                                  [companyProduct.id]: e.target.value
                                }));
                              }
                              }}
                              onBlur={() => {
                                if (product.companyProduct?.id) {
                                  handlePriceBlur(product.companyProduct.id, product.companyProduct.price);
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && product.companyProduct?.id) {
                                  handlePriceBlur(product.companyProduct.id, product.companyProduct.price);
                                  e.currentTarget.blur();
                                }
                              }}
                              className={`w-24 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                                isPriceUnset ? 'border-red-300 bg-red-50' : ''
                              }`}
                              min="0"
                              step="0.01"
                             />
                          </TableCell>
                          
                          {/* 見積期限 */}
                          <TableCell>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    "w-36 justify-start text-left font-normal text-xs",
                                    !product.companyProduct?.quotationExpiryDate && "text-muted-foreground border-red-300 bg-red-50",
                                    isQuotationExpired && "border-red-300 bg-red-50",
                                    isQuotationExpiringSoon && !isQuotationExpired && "border-orange-300 bg-orange-50"
                                  )}
                                >
                                  <CalendarIcon className="mr-2 h-3 w-3" />
                                  {product.companyProduct?.quotationExpiryDate ? (
                                    format(new Date(product.companyProduct.quotationExpiryDate), "yyyy/MM/dd", { locale: ja })
                                  ) : (
                                    "期限未設定"
                                  )}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0">
                                <Calendar
                                  mode="single"
                                  selected={product.companyProduct?.quotationExpiryDate ? new Date(product.companyProduct.quotationExpiryDate) : undefined}
                                  onSelect={(date) => {
                                    if (product.companyProduct?.id) {
                                      handleExpiryDateSelect(product.companyProduct.id, product.companyProduct.quotationExpiryDate, date);
                                    }
                                  }}
                                  disabled={(date) => date <= new Date()}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                          </TableCell>

                          {/* スケジュール価格表示 - 適用済みは非表示、未適用のみ表示 */}
                          <TableCell>
                            <div className="space-y-1">
                              {productSchedules.length > 0 ? (
                                <div className="space-y-1">
                                  {/* 価格履歴ボタン */}
                                  {getAppliedPriceHistorySimple(companyProductId!).length > 0 && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-xs h-6 text-blue-600"
                                      onClick={() => handleOpenPriceHistoryDialog(product)}
                                    >
                                      <History className="w-3 h-3 mr-1" />
                                      履歴
                                    </Button>
                                  )}
                                  
                                  {/* 未適用のスケジュールのみ表示 */}
                                  {productSchedules
                                    .filter((schedule) => {
                                      // 適用済みは非表示
                                      if (schedule.isApplied) return false;
                                      
                                      // 終了日チェック
                                      if (!schedule.expiryDate) return false;
                                      const now = new Date();
                                      const expiryDate = new Date(schedule.expiryDate);
                                      
                                      // 期限切れでないもののみ表示
                                      return expiryDate >= now;
                                    })
                                    .map((schedule) => (
                                    <div key={schedule.id} className="flex items-center space-x-1">
                                      <Badge variant="secondary" className="text-xs">
                                        ¥{schedule.scheduledPrice.toLocaleString()} 
                                        ({format(new Date(schedule.effectiveDate), "MM/dd", { locale: ja })} - {
                                          schedule.expiryDate ? format(new Date(schedule.expiryDate), "MM/dd", { locale: ja }) : "未設定"
                                        })
                                      </Badge>
                                      <div className="flex space-x-1">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-5 w-5 p-0"
                                          onClick={() => handleOpenScheduleDialog(product, schedule)}
                                        >
                                          <Edit className="w-3 h-3" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-5 w-5 p-0 text-red-500"
                                          onClick={() => handleDeleteSchedule(schedule.id)}
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </Button>
                                      </div>
                                    </div>
                                  ))}
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-xs h-6"
                                    onClick={() => handleOpenScheduleDialog(product)}
                                  >
                                    <Plus className="w-3 h-3 mr-1" />
                                    追加
                                  </Button>
                                </div>
                              ) : (
                                <div className="space-y-1">
                                  {/* 価格履歴ボタン */}
                                  {getAppliedPriceHistorySimple(companyProductId!).length > 0 && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-xs h-6 text-blue-600"
                                      onClick={() => handleOpenPriceHistoryDialog(product)}
                                    >
                                      <History className="w-3 h-3 mr-1" />
                                      履歴
                                    </Button>
                                  )}
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-xs h-6"
                                    onClick={() => handleOpenScheduleDialog(product)}
                                  >
                                    <CalendarClock className="w-3 h-3 mr-1" />
                                    設定
                                  </Button>
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              {(() => {
                                const status = getProductStatus(product.companyProduct?.quotationExpiryDate || null);
                                
                                switch (status) {
                                  case 'expired':
                                    return (
                                      <Badge variant="destructive" className="text-xs">
                                        期限切れ
                                      </Badge>
                                    );
                                  case 'expiring':
                                    return (
                                      <Badge variant="outline" className="text-xs border-orange-300 text-orange-600">
                                        期限間近
                                      </Badge>
                                    );
                                  case 'normal':
                                  default:
                                    return (
                                      <Badge variant="default" className="text-xs">
                                        正常
                                      </Badge>
                                    );
                                }
                              })()}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRemoveProduct(product.id)}
                              disabled={updateProductsMutation.isPending}
                            >
                              削除
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* スケジュール価格設定ダイアログ */}
      <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
        <DialogContent onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>
              {editingSchedule ? 'スケジュール価格編集' : 'スケジュール価格設定'}
            </DialogTitle>
            <DialogDescription>
              {selectedProductForSchedule?.name} の将来の価格変更を{editingSchedule ? '編集' : '設定'}します
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">新単価（税抜）</label>
              <Input
                type="number"
                placeholder="新しい単価を入力"
                value={schedulePrice}
                onChange={(e) => setSchedulePrice(e.target.value)}
                min="0"
                step="0.01"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">変更日時</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !scheduleDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {scheduleDate ? format(scheduleDate, "yyyy年MM月dd日 00:00から", { locale: ja }) : "日付を選択"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={scheduleDate}
                    onSelect={setScheduleDate}
                    disabled={(date) => date <= new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* 終了日選択フィールド - 必須に変更 */}
            <div className="space-y-2">
              <label className="text-sm font-medium">適用終了日 <span className="text-red-500">*</span></label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !scheduleExpiryDate && "text-muted-foreground border-red-300"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {scheduleExpiryDate ? 
                      format(scheduleExpiryDate, "yyyy年MM月dd日 00:00まで", { locale: ja }) : 
                      "終了日を選択してください"
                    }
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={scheduleExpiryDate}
                    onSelect={setScheduleExpiryDate}
                    disabled={(date) => scheduleDate ? date <= scheduleDate : date <= new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button
              variant="outline"
              onClick={handleCloseScheduleDialog}
            >
              キャンセル
            </Button>
            <Button
              onClick={handleCreateOrUpdateSchedule}
              disabled={!schedulePrice || !scheduleDate || !scheduleExpiryDate || createScheduleMutation.isPending}
            >
              {createScheduleMutation.isPending ? '処理中...' : editingSchedule ? 'スケジュール更新' : 'スケジュール設定'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 価格履歴表示ダイアログ */}
      <Dialog open={priceHistoryDialogOpen} onOpenChange={setPriceHistoryDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>価格履歴</DialogTitle>
            <DialogDescription>
              {selectedProductForHistory?.name} の過去の価格変更履歴
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-auto">
            {selectedProductForHistory?.companyProduct && (
              <div className="space-y-4">
                {/* 現在価格 */}
                <div className="border-b pb-4">
                  <h3 className="font-medium text-sm text-muted-foreground mb-2">現在価格</h3>
                  <div className="flex items-center space-x-2">
                    <Badge variant="default" className="text-sm">
                      現在: ¥{selectedProductForHistory.companyProduct.price?.toLocaleString() || '未設定'}
                    </Badge>
                    {selectedProductForHistory.companyProduct.quotationExpiryDate && (
                      <span className="text-xs text-muted-foreground">
                        (見積期限: {format(new Date(selectedProductForHistory.companyProduct.quotationExpiryDate), "yyyy/MM/dd", { locale: ja })})
                      </span>
                    )}
                  </div>
                </div>

                {/* 適用済み履歴 */}
                <div>
                  <h3 className="font-medium text-sm text-muted-foreground mb-2">適用済み価格履歴</h3>
                  {(() => {
                    const historyData = getAppliedPriceHistory(selectedProductForHistory.companyProduct.id, historyPage, historyLimit);
                    
                    if (historyData.total === 0) {
                      return (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                          価格変更履歴がありません
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-4">
                        {/* 履歴アイテム */}
                        <div className="space-y-2">
                          {historyData.data.map((schedule, index) => (
                            <div key={schedule.id} className="flex items-center justify-between p-3 border rounded-lg bg-gray-50">
                              <div className="flex items-center space-x-3">
                                <Badge variant="outline" className="text-xs">
                                  #{historyData.total - ((historyData.currentPage - 1) * historyLimit) - index}
                                </Badge>
                                <div>
                                  <div className="font-medium">¥{schedule.scheduledPrice.toLocaleString()}</div>
                                  <div className="text-xs text-muted-foreground">
                                    適用期間: {format(new Date(schedule.effectiveDate), "yyyy/MM/dd", { locale: ja })} 
                                    {schedule.expiryDate && ` - ${format(new Date(schedule.expiryDate), "yyyy/MM/dd", { locale: ja })}`}
                                  </div>
                                </div>
                              </div>
                              <Badge variant="secondary" className="text-xs">
                                適用済み
                              </Badge>
                            </div>
                          ))}
                        </div>

                        {/* ページネーション */}
                        {historyData.totalPages > 1 && (
                          <div className="flex items-center justify-between pt-4 border-t">
                            <div className="text-xs text-muted-foreground">
                              全{historyData.total}件中 {((historyData.currentPage - 1) * historyLimit) + 1} - {Math.min(historyData.currentPage * historyLimit, historyData.total)}件を表示
                            </div>
                            <div className="flex space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setHistoryPage(prev => Math.max(1, prev - 1))}
                                disabled={!historyData.hasPrevPage}
                              >
                                前へ
                              </Button>
                              <div className="flex items-center space-x-1">
                                {Array.from({ length: historyData.totalPages }, (_, i) => i + 1)
                                  .filter(page => 
                                    page === 1 || 
                                    page === historyData.totalPages || 
                                    Math.abs(page - historyData.currentPage) <= 1
                                  )
                                  .map((page, index, filteredPages) => (
                                    <div key={page} className="flex items-center">
                                      {index > 0 && filteredPages[index - 1] !== page - 1 && (
                                        <span className="px-1 text-xs text-muted-foreground">...</span>
                                      )}
                                      <Button
                                        variant={page === historyData.currentPage ? "default" : "outline"}
                                        size="sm"
                                        className="w-8 h-8 p-0 text-xs"
                                        onClick={() => setHistoryPage(page)}
                                      >
                                        {page}
                                      </Button>
                                    </div>
                                  ))}
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setHistoryPage(prev => Math.min(historyData.totalPages, prev + 1))}
                                disabled={!historyData.hasNextPage}
                              >
                                次へ
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-4 border-t flex-shrink-0">
            <Button
              variant="outline"
              onClick={handleClosePriceHistoryDialog}
            >
              閉じる
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}