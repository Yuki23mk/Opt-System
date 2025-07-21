/**
 * ファイルパス: app/(withSidebar)/orders/page.tsx
 * 注文履歴ページ - 統一デザイン刷新版
 */

"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Package, MapPin, User, Calendar, AlertCircle, Eye, X, Search, Filter, ArrowUpDown } from "lucide-react";

// 🔥 共通コンポーネント導入
import { useNotification } from "@/app/(withSidebar)/common/hooks/useNotification";
import { ToastContainer } from "@/app/(withSidebar)/common/components/Toast";
import { useConfirmModal } from "@/app/(withSidebar)/common/components/ConfirmModal";
import { ProtectedRoute } from "../common/components/ProtectedRoute";
// ✅ 削除済みユーザー表示コンポーネント
import { DeletedUserDisplay } from "@/app/(withSidebar)/common/components/DeletedUserDisplay";

import { ENV } from '@/lib/env';

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
}

interface OrderItem {
  id: number;
  companyProductId: number;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  companyProduct: CompanyProduct;
}

// ✅ ユーザー型定義に削除済み対応フィールドを追加
interface OrderUser {
  id: number;
  name: string;
  email: string;
  status?: string;           // ✅ 追加
  isDeleted?: boolean;       // ✅ 追加
  displayName?: string;      // ✅ 追加
}

interface Order {
  id: number;
  orderNumber: string;
  totalAmount: number;
  status: string;
  createdAt: string;
  deliveryName: string;
  deliveryCompany?: string;
  deliveryAddress1: string;
  deliveryAddress2?: string;
  deliveryPrefecture: string;
  deliveryCity: string;
  deliveryZipCode: string;
  deliveryPhone?: string;
  cancelReason?: string;
  cancelRejectReason?: string;
  cancelMessage?: string;
  priceNote?: string;
  user: OrderUser;           // ✅ 型を更新
  orderItems: OrderItem[];
}

interface OrderDocument {
  id: number;
  documentType: string;
  documentNumber: string;
  status: string;
  deliveryDate?: string;
  isApproved: boolean;
  approvedAt?: string;
  approvedBy?: string;
  createdAt: string;
}

// ✅ ステータスバッジをベタ塗り対応
const statusLabels: Record<string, { label: string; color: string }> = {
  pending: { label: '注文受付', color: 'bg-blue-500 text-white' },
  confirmed: { label: '注文確定', color: 'bg-[#115e59] text-white' },
  processing: { label: '商品手配中', color: 'bg-amber-500 text-white' },
  shipped: { label: '配送中', color: 'bg-purple-500 text-white' },
  delivered: { label: '配送完了', color: 'bg-slate-500 text-white' },
  cancelled: { label: 'キャンセル', color: 'bg-red-500 text-white' },
  cancel_requested: { label: 'キャンセル申請中', color: 'bg-amber-500 text-white' },
  cancel_rejected: { label: 'キャンセル拒否', color: 'bg-red-600 text-white' }
};

export default function OrderHistoryPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  
  // フィルター・ソート用state
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<string>('desc');
  const [productFilter, setProductFilter] = useState<string>('');
  const [searchInput, setSearchInput] = useState<string>(''); // 入力中のテキスト用
  
  // キャンセル理由入力モーダル用state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelOrderId, setCancelOrderId] = useState<number | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelMessage, setCancelMessage] = useState("");

  // ドキュメント管理用state
  const [orderDocuments, setOrderDocuments] = useState<Record<number, OrderDocument[]>>({});

  // 🔥 共通通知システム
  const notification = useNotification();
  const { openConfirm } = useConfirmModal();

  const API_URL = ENV.API_URL;

  // debounce機能：入力停止から500ms後に検索実行
  useEffect(() => {
    const timer = setTimeout(() => {
      setProductFilter(searchInput);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    fetchOrders();
  }, [sortBy, sortOrder, productFilter]);

  // 注文取得時にドキュメントも取得 - 一時的にコメントアウト
  /* useEffect(() => {
    if (orders.length > 0) {
      orders.forEach(order => {
        fetchOrderDocuments(order.id);
      });
    }
  }, [orders]); */

  const fetchOrderDocuments = async (orderId: number) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      console.log(`📄 注文${orderId}の書類取得を開始...`);

      const response = await fetch(`${API_URL}/api/orders/${orderId}/documents`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`📄 注文${orderId}の書類取得成功:`, data.length, '件');
        setOrderDocuments(prev => ({
          ...prev,
          [orderId]: data
        }));
      } else {
        console.error(`❌ 注文${orderId}の書類取得失敗:`, response.status, response.statusText);
      }
    } catch (error) {
      console.error('❌ 書類取得エラー:', error);
    }
  };

  const downloadDocument = (orderId: number, documentId: number, documentType: string, documentNumber: string) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        notification.error('ログインが必要です');
        return;
      }

      console.log(`📄 書類ダウンロード開始: ${documentNumber}`);
      
      const filename = `${documentType === 'delivery_note' ? '納品書' : '受領書'}_${documentNumber}`;
      const url = `${API_URL}/api/orders/${orderId}/download?documentId=${documentId}`;
      
      // fetchでHTMLを取得して新しいタブで表示
      fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      .then(response => {
        if (response.ok) {
          return response.text();
        }
        throw new Error('書類の取得に失敗しました');
      })
      .then(html => {
        const previewWindow = window.open('', '_blank');
        if (previewWindow) {
          previewWindow.document.write(html);
          previewWindow.document.close();
        }
        notification.success(`${documentType === 'delivery_note' ? '納品書' : '受領書'}を表示しました`);
      })
      .catch(error => {
        console.error('❌ ダウンロードエラー:', error);
        notification.error('ダウンロードに失敗しました: ' + error.message);
      });
    } catch (error) {
      console.error('❌ ダウンロードエラー:', error);
      notification.error('ダウンロードに失敗しました');
    }
  };

  const fetchOrders = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem("token");
      if (!token) return;

      // クエリパラメータの構築
      const params = new URLSearchParams({
        sortBy,
        sortOrder,
        ...(productFilter.trim() && { productFilter: productFilter.trim() })
      });

      const response = await fetch(`${API_URL}/api/orders?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        
        // ✅ APIレスポンスに削除済み情報がない場合は、フロントエンドで生成
        const processedOrders = data.map((order: Order) => ({
          ...order,
          user: {
            ...order.user,
            isDeleted: order.user.status === "deleted" || order.user.isDeleted || false,
            displayName: (order.user.status === "deleted" || order.user.isDeleted) 
              ? "削除済みアカウント" 
              : (order.user.displayName || order.user.name)
          }
        }));
        
        setOrders(processedOrders);
        
        // 最初の注文からキャンセルメッセージを取得
        if (processedOrders.length > 0 && processedOrders[0].cancelMessage) {
          setCancelMessage(processedOrders[0].cancelMessage);
        }
      } else {
        throw new Error('注文履歴の取得に失敗しました');
      }
    } catch (error) {
      console.error('注文履歴取得エラー:', error);
      notification.error('注文履歴の取得に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelRequest = (orderId: number) => {
    setCancelOrderId(orderId);
    setShowCancelModal(true);
  };

  const submitCancelRequest = async () => {
    if (!cancelOrderId || !cancelReason.trim()) {
      notification.warning('お急ぎの場合は丸一機料商会（084-962-0525）まで直接ご連絡頂けますようお願いします。', {
        title: 'キャンセル理由が未入力です'
      });
      return;
    }

    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const response = await fetch(`${API_URL}/api/orders`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          orderId: cancelOrderId,
          cancelReason: cancelReason.trim() 
        }),
      });

      if (response.ok) {
        notification.success('キャンセル申請を送信しました');
        setShowCancelModal(false);
        setCancelOrderId(null);
        setCancelReason("");
        await fetchOrders();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'キャンセル申請に失敗しました');
      }
    } catch (error) {
      console.error('キャンセル申請エラー:', error);
      notification.error(error instanceof Error ? error.message : 'キャンセル申請に失敗しました');
    }
  };

  const openOrderDetail = (order: Order) => {
    setSelectedOrder(order);
    setIsDetailOpen(true);
  };

  const canCancel = (status: string) => {
    return ['pending', 'confirmed'].includes(status);
  };

  // ソート順序の切り替え
  const toggleSortOrder = () => {
    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
  };

  return (
    <ProtectedRoute permission="orders">
      <div className="fade-in">
        {/* ===== 統一ページヘッダー ===== */}
        <div className="page-header">
          <h1 className="page-title text-slate-900 font-bold">
            <Package className="page-title-icon" />
            注文履歴
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            過去の注文履歴を確認できます。
            {orders.length > 0 && orders[0].priceNote && (
              <span className="ml-2 text-xs font-medium text-amber-600">
                {orders[0].priceNote}
              </span>
            )}
          </p>
        </div>

        {/* ===== フィルター・ソート機能 ===== */}
        <Card className="mb-4 border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm text-slate-700">
              <Filter className="h-4 w-4" />
              フィルター・ソート
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-col sm:flex-row flex-wrap gap-3">
              {/* 製品名フィルター */}
              <div className="flex-1 min-w-0 sm:min-w-48">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  製品名で絞り込み
                </label>
                <div className="relative w-full max-w-80">
                  <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-slate-400" />
                  <Input
                    placeholder="製品名を入力..."
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    className="pl-7 text-xs h-8 border-slate-200 focus:border-[#115e59] focus:ring-1 focus:ring-[#115e59] w-full"
                  />
                </div>
              </div>
              
              {/* ソート項目 */}
              <div className="w-full sm:w-40">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  並び順
                </label>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="border-slate-200 h-8 text-xs w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="createdAt">注文日時</SelectItem>
                    <SelectItem value="orderNumber">注文番号</SelectItem>
                    <SelectItem value="status">ステータス</SelectItem>
                    <SelectItem value="totalAmount">合計金額</SelectItem>
                    <SelectItem value="userName">注文者名</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* ソート順序 */}
              <div className="w-full sm:w-28">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  順序
                </label>
              <Button
                variant="outline"                                    
                onClick={toggleSortOrder}                   
                className="w-full justify-between bg-[#115e59] border-[#115e59] text-white hover:bg-[#0f766e] h-8 text-xs px-2"                 
              >                   
                {sortOrder === 'desc' ? '新しい順' : '古い順'}                   
                <ArrowUpDown className="h-3 w-3" />                 
              </Button>              
              </div>
            </div>
            
            {/* フィルター結果の表示 */}
            {(searchInput.trim() || sortBy !== 'createdAt' || sortOrder !== 'desc') && (
              <div className="mt-3 p-2 bg-slate-50 rounded-lg">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <span className="text-xs text-slate-600">
                    {orders.length}件の注文が見つかりました
                    {searchInput.trim() && productFilter !== searchInput && (
                      <span className="ml-2 text-xs text-blue-600">検索中...</span>
                    )}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearchInput('');
                      setProductFilter('');
                      setSortBy('createdAt');
                      setSortOrder('desc');
                    }}
                    className="border-slate-300 text-slate-600 hover:bg-slate-50 text-xs px-2 py-1 w-full sm:w-auto"
                  >
                    フィルターをクリア
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ===== メインコンテンツ ===== */}
        {isLoading ? (
          <div className="card-container text-center py-8">
            <div className="loading-spinner mx-auto mb-2"></div>
            <p className="text-slate-500 font-medium">読み込み中...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="card-container text-center py-12">
            <div className="text-slate-600">
              <Package className="w-16 h-16 mx-auto mb-4 text-slate-300" />
              {productFilter.trim() ? (
                <>
                  <p className="text-lg mb-2 font-semibold">「{productFilter}」に一致する注文がありません</p>
                  <p className="text-sm font-medium">別のキーワードで検索してみてください</p>
                </>
              ) : (
                <>
                  <p className="text-lg mb-2 font-semibold">注文履歴がありません</p>
                  <p className="text-sm font-medium">商品を注文すると、こちらに履歴が表示されます</p>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <Card key={order.id} className="hover:shadow-md transition-shadow border-slate-200">
                <CardHeader className="pb-2">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="flex flex-col sm:flex-row sm:items-center gap-2 text-sm text-slate-800">
                        <span className="truncate">注文番号: {order.orderNumber}</span>
                        <Badge className={`text-xs px-2 py-1 ${statusLabels[order.status]?.color || 'bg-slate-500 text-white'} w-fit`}>
                          {statusLabels[order.status]?.label || order.status}
                        </Badge>
                      </CardTitle>
                      <CardDescription className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 mt-1 text-xs text-slate-600">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(order.createdAt).toLocaleDateString('ja-JP')}
                        </span>
                        <span className="flex items-center gap-1">
                          <DeletedUserDisplay 
                            name={order.user.name}
                            isDeleted={order.user.isDeleted || false}
                            showIcon={true}
                            size="sm"
                          />
                        </span>
                      </CardDescription>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-lg font-bold text-slate-800">
                        {order.totalAmount.toLocaleString()}円
                        {order.priceNote && (
                          <span className="text-xs text-slate-500 ml-1 block">
                            (税抜)
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500">
                        {order.orderItems.reduce((sum, item) => sum + item.quantity, 0)}点
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                {/* 商品一覧の簡単表示 */}
                <div className="mb-3">
                  <div className="text-xs text-slate-600 space-y-1">
                    {order.orderItems.slice(0, 2).map((item) => (
                      <div key={item.id} className="flex flex-col sm:flex-row sm:justify-between gap-1">
                        <span className="truncate pr-2 flex-1">{item.companyProduct.productMaster.name}</span>
                        <span className="text-xs whitespace-nowrap text-slate-500">{item.quantity}個 × {item.unitPrice.toLocaleString()}円</span>
                      </div>
                    ))}
                    {order.orderItems.length > 2 && (
                      <div className="text-slate-400 text-xs">
                        他{order.orderItems.length - 2}点...
                      </div>
                    )}
                  </div>
                </div>
                  {/* キャンセル理由の表示 */}
                  {order.cancelReason && (
                    <div className="mb-3 p-2 bg-amber-50 rounded border border-amber-200">
                      <div className="flex items-center gap-1 mb-1">
                        <AlertCircle className="h-3 w-3 text-amber-600" />
                        <span className="text-xs font-medium text-amber-800">キャンセル理由:</span>
                      </div>
                      <div className="text-xs text-amber-700">{order.cancelReason}</div>
                    </div>
                  )}

                  {/* キャンセル拒否理由の表示 */}
                  {order.cancelRejectReason && (
                    <div className="mb-3 p-2 bg-red-50 rounded border border-red-200">
                      <div className="flex items-center gap-1 mb-1">
                        <X className="h-3 w-3 text-red-600" />
                        <span className="text-xs font-medium text-red-800">キャンセル拒否理由:</span>
                      </div>
                      <div className="text-xs text-red-700">{order.cancelRejectReason}</div>
                    </div>
                  )}

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-1 flex-1 min-w-0">
                    <MapPin className="h-3 w-3 mt-1 text-slate-400 flex-shrink-0" />
                    <div className="text-xs text-slate-600 min-w-0">
                      <div className="font-medium truncate">{order.deliveryName}</div>
                      {order.deliveryCompany && <div className="truncate">{order.deliveryCompany}</div>}
                      <div className="truncate">
                        〒{order.deliveryZipCode} {order.deliveryPrefecture}{order.deliveryCity}
                      </div>
                      <div className="truncate">{order.deliveryAddress1}</div>
                    </div>
                  </div>
                  <div className="flex gap-1 flex-wrap justify-end sm:justify-start">
                    {/* 詳細ボタン */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openOrderDetail(order)}
                      className="border-[#115e59] text-[#115e59] hover:bg-[#115e59] hover:text-white text-xs px-2 py-1 h-7 min-w-fit"
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      詳細
                    </Button>
                    
                    {/* キャンセル申請ボタン */}
                    {canCancel(order.status) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCancelRequest(order.id)}
                        className="text-red-600 hover:text-white border-red-600 hover:bg-red-600 text-xs px-2 py-1 h-7 min-w-fit"
                      >
                        <AlertCircle className="h-3 w-3 mr-1" />
                        <span className="hidden sm:inline">キャンセル</span>
                        <span className="sm:hidden">取消</span>
                      </Button>
                    )}
                  </div>
                </div>                
                </CardContent>
              </Card>
            ))}
          </div>
        )}

    {/* 注文詳細モーダル - スマホ対応 */}
        <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
          <DialogContent className="w-[95vw] max-w-2xl max-h-[95vh] overflow-y-auto border-slate-200 p-3 sm:p-6">
            <DialogHeader className="pb-3">
              <DialogTitle className="text-sm sm:text-base text-slate-800 break-all">
                注文詳細 - {selectedOrder?.orderNumber}
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm text-slate-600">
                注文の詳細情報を確認できます
                {selectedOrder?.priceNote && (
                  <span className="ml-2 text-amber-600">
                    {selectedOrder.priceNote}
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>
            {selectedOrder && (
              <div className="space-y-4 sm:space-y-6">
                {/* 注文情報 - スマホでは縦並び */}
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold mb-2 text-xs sm:text-sm text-slate-700">注文情報</h3>
                    <div className="space-y-1 text-xs sm:text-sm text-slate-600">
                      <div className="break-all">注文番号: {selectedOrder.orderNumber}</div>
                      <div>注文日時: {new Date(selectedOrder.createdAt).toLocaleString('ja-JP')}</div>
                      <div className="flex items-center gap-2 flex-wrap">
                        注文者: 
                        <DeletedUserDisplay 
                          name={selectedOrder.user.name}
                          isDeleted={selectedOrder.user.isDeleted || false}
                          showIcon={false}
                          size="sm"
                        />
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        ステータス: 
                        <Badge className={`text-xs px-2 py-1 ${statusLabels[selectedOrder.status]?.color || 'bg-slate-500 text-white'}`}>
                          {statusLabels[selectedOrder.status]?.label || selectedOrder.status}
                        </Badge>
                      </div>
                    </div>
                    
                    {/* 詳細画面でのキャンセル理由表示 */}
                    {selectedOrder.cancelReason && (
                      <div className="mt-3 p-2 bg-amber-50 rounded border border-amber-200">
                        <div className="flex items-center gap-1 mb-1">
                          <AlertCircle className="h-3 w-3 text-amber-600" />
                          <span className="text-xs font-medium text-amber-800">キャンセル理由:</span>
                        </div>
                        <div className="text-xs text-amber-700 leading-relaxed">{selectedOrder.cancelReason}</div>
                      </div>
                    )}
                    
                    {/* 詳細画面でのキャンセル拒否理由表示 */}
                    {selectedOrder.cancelRejectReason && (
                      <div className="mt-3 p-2 bg-red-50 rounded border border-red-200">
                        <div className="flex items-center gap-1 mb-1">
                          <X className="h-3 w-3 text-red-600" />
                          <span className="text-xs font-medium text-red-800">キャンセル拒否理由:</span>
                        </div>
                        <div className="text-xs text-red-700 leading-relaxed">{selectedOrder.cancelRejectReason}</div>
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <h3 className="font-semibold mb-2 text-xs sm:text-sm text-slate-700">配送先</h3>
                    <div className="space-y-1 text-xs sm:text-sm text-slate-600">
                      <div className="font-medium">{selectedOrder.deliveryName}</div>
                      {selectedOrder.deliveryCompany && <div>{selectedOrder.deliveryCompany}</div>}
                      <div>〒{selectedOrder.deliveryZipCode}</div>
                      <div>{selectedOrder.deliveryPrefecture}{selectedOrder.deliveryCity}</div>
                      <div>{selectedOrder.deliveryAddress1}</div>
                      {selectedOrder.deliveryAddress2 && <div>{selectedOrder.deliveryAddress2}</div>}
                      {selectedOrder.deliveryPhone && <div>TEL: {selectedOrder.deliveryPhone}</div>}
                    </div>
                  </div>
                </div>

                {/* 注文商品 - スマホでカード表示、PC でテーブル表示 */}
                <div>
                  <h3 className="font-semibold mb-3 text-xs sm:text-sm text-slate-700">注文商品</h3>
                  
                  {/* スマホ表示（md未満） */}
                  <div className="md:hidden space-y-3">
                    {selectedOrder.orderItems.map((item) => (
                      <div key={item.id} className="border border-slate-200 rounded-lg p-3 bg-white">
                        <div className="space-y-2">
                          <div className="font-medium text-sm text-slate-800 leading-tight">
                            {item.companyProduct.productMaster.name}
                          </div>
                          <div className="text-xs text-slate-500 leading-tight">
                            {item.companyProduct.productMaster.manufacturer} | {item.companyProduct.productMaster.code}
                          </div>
                          <div className="text-xs text-slate-500">
                            容量: {item.companyProduct.productMaster.capacity}{item.companyProduct.productMaster.unit}
                          </div>
                          <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                            <div className="text-xs text-slate-600">
                              数量: <span className="font-medium">{item.quantity}</span>
                            </div>
                            <div className="text-xs text-slate-600">
                              単価: <span className="font-medium">{item.unitPrice.toLocaleString()}円</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-bold text-slate-800">
                              {item.totalPrice.toLocaleString()}円
                            </div>
                            <div className="text-xs text-slate-500">(税抜)</div>
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {/* 合計金額 */}
                    <div className="bg-[#115e59] rounded-lg p-3 text-white">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-semibold">合計金額(税抜):</span>
                        <span className="text-lg font-bold">
                          {selectedOrder.totalAmount.toLocaleString()}円
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* PC表示（md以上） */}
                  <div className="hidden md:block border rounded-lg overflow-hidden border-slate-200">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-[#115e59] text-white">
                            <th className="px-3 py-2 text-left font-semibold">商品</th>
                            <th className="px-3 py-2 text-center font-semibold">数量</th>
                            <th className="px-3 py-2 text-center font-semibold">単価(税抜)</th>
                            <th className="px-3 py-2 text-center font-semibold">合計(税抜)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedOrder.orderItems.map((item) => (
                            <tr key={item.id} className="border-t border-slate-100">
                              <td className="px-3 py-2">
                                <div>
                                  <div className="font-medium text-slate-800 break-words">{item.companyProduct.productMaster.name}</div>
                                  <div className="text-slate-500 text-xs break-words">
                                    {item.companyProduct.productMaster.manufacturer} | 
                                    {item.companyProduct.productMaster.code} | 
                                    {item.companyProduct.productMaster.capacity}{item.companyProduct.productMaster.unit}
                                  </div>
                                </div>
                              </td>
                              <td className="px-3 py-2 text-center text-slate-600">{item.quantity}</td>
                              <td className="px-3 py-2 text-center text-slate-600">{item.unitPrice.toLocaleString()}円</td>
                              <td className="px-3 py-2 text-center font-medium text-slate-800">{item.totalPrice.toLocaleString()}円</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-[#115e59] text-white">
                          <tr>
                            <td colSpan={3} className="px-3 py-2 text-right font-semibold">合計金額(税抜):</td>
                            <td className="px-3 py-2 text-center font-bold text-sm">
                              {selectedOrder.totalAmount.toLocaleString()}円
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* キャンセル理由入力モーダル */}
        <Dialog open={showCancelModal} onOpenChange={setShowCancelModal}>
          <DialogContent className="max-w-md border-slate-200 mx-4">
            <DialogHeader>
              <DialogTitle className="text-slate-800">キャンセル申請</DialogTitle>
              <DialogDescription className="text-slate-600">
                {cancelMessage || 'お急ぎの場合は丸一機料商会（084-962-0525）まで直接ご連絡頂けますようお願いします。'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  キャンセル理由 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full px-2 py-2 border border-slate-300 rounded text-xs focus:outline-none focus:ring-[#115e59] focus:border-[#115e59] text-slate-700 resize-none"
                  rows={3}
                  placeholder="キャンセル理由を入力してください..."
                  required
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCancelModal(false);
                    setCancelOrderId(null);
                    setCancelReason("");
                  }}
                  className="border-slate-300 text-slate-700 hover:bg-slate-50 text-xs px-3 py-1.5 w-full sm:w-auto"
                >
                  キャンセル
                </Button>
                <Button
                  variant="destructive"
                  onClick={submitCancelRequest}
                  className="bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-1.5 w-full sm:w-auto"
                >
                  送信
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* 🔥 共通通知システム */}
        <ToastContainer 
          toasts={notification.toasts} 
          onClose={notification.removeToast} 
          position="top-right"
        />
      </div>
    </ProtectedRoute>
  );
}