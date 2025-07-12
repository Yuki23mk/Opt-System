/**
 * ファイルパス: optioil-admin/app/orders/page.tsx
 * 管理者画面 - 受注管理ページ（一括更新機能付き完全版）
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Calendar, User, MapPin, FileText, CheckCircle, XCircle, Package, AlertTriangle, ArrowLeft, Stamp, Check } from "lucide-react";
import { toast } from 'sonner';
import { ENV } from '@/lib/env';

interface OrderItem {
  id: number;
  productId: number;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  product: {
    id: number;
    code: string;
    name: string;
    manufacturer: string;
    capacity: string;
    unit: string;
    oilType: string;
  };
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
  user: {
    id: number;
    name: string;
    email: string;
    company: {
      id: number;
      name: string;
    };
  };
  orderItems: OrderItem[];
}

interface OrderPaperwork {
  id: number;
  documentType: string;
  documentNumber: string;
  status: string;
  deliveryDate?: string;
  isApproved: boolean;
  approvedAt?: string;
  approvedBy?: string;
  createdAt: string;
  createdBy: {
    id: number;
    username: string;
  };
}

const statusLabels: Record<string, { label: string; color: string }> = {
  pending: { label: '注文受付', color: 'bg-blue-100 text-blue-800' },
  confirmed: { label: '注文確定', color: 'bg-green-100 text-green-800' },
  processing: { label: '商品手配中', color: 'bg-yellow-100 text-yellow-800' },
  shipped: { label: '発送済み', color: 'bg-purple-100 text-purple-800' },
  delivered: { label: '配送完了', color: 'bg-gray-100 text-gray-800' },
  cancelled: { label: 'キャンセル', color: 'bg-red-100 text-red-800' },
  cancel_requested: { label: 'キャンセル申請中', color: 'bg-orange-100 text-orange-800' },
  cancel_rejected: { label: 'キャンセル拒否', color: 'bg-red-100 text-red-800' }
};

function AdminOrderManagementPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchKeyword, setSearchKeyword] = useState<string>("");
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectOrderId, setRejectOrderId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showCancelReasonModal, setShowCancelReasonModal] = useState(false);
  const [selectedCancelReason] = useState<{ orderNumber: string; reason: string } | null>(null);
  
  // ドキュメント管理用state
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [selectedOrderForDoc] = useState<Order | null>(null);
  const [orderPaperwork, setOrderPaperwork] = useState<OrderPaperwork[]>([]);
  const [showCreateDocModal, setShowCreateDocModal] = useState(false);
  const [createDocType, setCreateDocType] = useState<'delivery_note' | 'receipt'>('delivery_note');
  const [deliveryDate, setDeliveryDate] = useState<string>('');
  
  // 一括選択・更新用state
  const [selectedOrderIds, setSelectedOrderIds] = useState<number[]>([]);
  const [showBulkUpdateModal, setShowBulkUpdateModal] = useState(false);
  const [bulkUpdateStatus, setBulkUpdateStatus] = useState<string>('confirmed');

  const API_URL = ENV.API_URL;

  console.log('🔧 管理者FE環境設定:', {
    API_URL,
    ADMIN_URL: process.env.NEXT_PUBLIC_ADMIN_URL,
    NODE_ENV: process.env.NODE_ENV
  });

const fetchOrders = useCallback(async () => {
  try {
    setIsLoading(true);
    
    const apiUrl = ENV.API_URL;
    const token = localStorage.getItem("adminToken");
    
    console.log('🔧 管理者画面Request:', {
      apiUrl,
      fullUrl: `${apiUrl}/api/admin/orders`,
      hasToken: !!token,
      origin: typeof window !== 'undefined' ? window.location.origin : 'server-side'
    });
    
    if (!token) {
      console.error('❌ 管理者トークンがありません');
      toast.error('認証が必要です。ログインしてください。');
      router.push('/login');
      return;
    }

    const response = await fetch(`${apiUrl}/api/admin/orders`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    console.log('🌐 API Response:', {
      status: response.status,
      statusText: response.statusText,
      url: response.url
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ 受注データ取得成功:', data.length, '件');
      setOrders(data);
    } else {
      const errorData = await response.text();
      console.error('❌ API エラー:', response.status, errorData);
      
      if (response.status === 401) {
        toast.error('認証が失効しました。再ログインしてください。');
        localStorage.removeItem('adminToken');
        router.push('/login');
      } else if (response.status === 403) {
        toast.error('アクセスが拒否されました。CORS設定を確認してください。');
      } else if (response.status === 404) {
        toast.error('APIエンドポイントが見つかりません');
      } else {
        toast.error(`サーバーエラー: ${response.status}`);
      }
    }
  } catch (error) {
    console.error('🚨 ネットワークエラー:', error);
    
    if (error instanceof TypeError && error.message.includes('fetch')) {
      toast.error('APIサーバーに接続できません。サーバーが起動しているか確認してください。');
    } else {
      toast.error('予期しないエラーが発生しました');
    }
  } finally {
    setIsLoading(false);
  }
}, [router]);


  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // フィルタ変更時に選択状態をリセット
  useEffect(() => {
    setSelectedOrderIds([]);
    
    // フィルタに応じて次のステータスをデフォルト設定
    const getNextStatus = (currentFilter: string) => {
      switch (currentFilter) {
        case 'pending': return 'confirmed';
        case 'confirmed': return 'processing';
        case 'processing': return 'shipped';
        case 'shipped': return 'delivered';
        default: return 'confirmed';
      }
    };
    
    setBulkUpdateStatus(getNextStatus(statusFilter));
  }, [statusFilter]);

  const updateOrderStatus = async (orderId: number, newStatus: string) => {
    try {
      const token = localStorage.getItem("adminToken");
      if (!token) {
        toast.error('認証エラーが発生しました');
        return;
      }

      const response = await fetch(`${API_URL}/api/admin/orders/${orderId}/status`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        console.log('ステータスを更新しました');
        toast.success(`ステータスを「${statusLabels[newStatus]?.label}」に更新しました`);
        await fetchOrders();
      } else {
        console.error('ステータス更新に失敗しました');
        toast.error('ステータス更新に失敗しました');
      }
    } catch (error) {
      console.error('ステータス更新エラー:', error);
      toast.error('ステータス更新中にエラーが発生しました');
    }
  };

  const handleCancelApproval = async (orderId: number, approve: boolean) => {
    try {
      const token = localStorage.getItem("adminToken");
      if (!token) return;

      if (approve) {
        // キャンセル承認
        const response = await fetch(`${API_URL}/api/admin/orders/${orderId}/approve-cancel`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        });

        if (response.ok) {
          console.log('キャンセルを承認しました');
          await fetchOrders();
        } else {
          console.error('キャンセル承認に失敗しました');
        }
      } else {
        // キャンセル拒否モーダルを表示
        setRejectOrderId(orderId);
        setShowRejectModal(true);
      }
    } catch (error) {
      console.error('キャンセル処理エラー:', error);
    }
  };

  const handleRejectSubmit = async () => {
    if (!rejectOrderId || !rejectReason.trim()) {
      alert('拒否理由を入力してください');
      return;
    }

    try {
      const token = localStorage.getItem("adminToken");
      if (!token) return;

      const response = await fetch(`${API_URL}/api/admin/orders/${rejectOrderId}/reject-cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: rejectReason.trim() }),
      });

      if (response.ok) {
        console.log('キャンセルを拒否しました');
        setShowRejectModal(false);
        setRejectOrderId(null);
        setRejectReason("");
        await fetchOrders();
      } else {
        const errorData = await response.json();
        console.error('キャンセル拒否に失敗しました:', errorData);
        alert('キャンセル拒否に失敗しました: ' + errorData.error);
      }
    } catch (error) {
      console.error('キャンセル拒否エラー:', error);
      alert('処理中にエラーが発生しました');
    }
  };

  // ★★★ 修正：未使用だった関数を削除（コメントアウト形式で保持）
  // const showCancelReason = (orderNumber: string, reason: string) => {
  //   setSelectedCancelReason({ orderNumber, reason });
  //   setShowCancelReasonModal(true);
  // };

  // 一括選択・更新関連関数
  const handleSelectOrder = (orderId: number, checked: boolean) => {
    if (checked) {
      setSelectedOrderIds(prev => [...prev, orderId]);
    } else {
      setSelectedOrderIds(prev => prev.filter(id => id !== orderId));
    }
  };

  const handleSelectAll = () => {
    const filteredOrderIds = filteredOrders.map(order => order.id);
    setSelectedOrderIds(filteredOrderIds);
  };

  const handleDeselectAll = () => {
    setSelectedOrderIds([]);
  };

  const handleBulkUpdate = async () => {
    if (selectedOrderIds.length === 0) {
      alert('更新する注文を選択してください');
      return;
    }

    try {
      const token = localStorage.getItem("adminToken");
      if (!token) return;

      const response = await fetch(`${API_URL}/api/admin/orders/bulk-status`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderIds: selectedOrderIds,
          newStatus: bulkUpdateStatus
        }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log(`一括更新成功: ${result.updatedCount}件更新`);
        toast.success(`${result.updatedCount}件の注文ステータスを「${statusLabels[bulkUpdateStatus]?.label}」に更新しました`);
        setShowBulkUpdateModal(false);
        setSelectedOrderIds([]);
        await fetchOrders();
      } else {
        const errorData = await response.json();
        toast.error('一括更新に失敗しました: ' + errorData.error);
      }
    } catch (error) {
      console.error('一括更新エラー:', error);
      toast.error('一括更新中にエラーが発生しました');
    }
  };

  // ドキュメント管理関数
  // ★★★ 修正：未使用だった関数を削除（コメントアウト形式で保持）
  // const openDocumentModal = async (order: Order) => {
  //   setSelectedOrderForDoc(order);
  //   setShowDocumentModal(true);
  //   await fetchOrderPaperwork(order.id);
  // };

  const fetchOrderPaperwork = async (orderId: number) => {
    try {
      const token = localStorage.getItem("adminToken");
      if (!token) return;

      const response = await fetch(`${API_URL}/api/admin/orders/${orderId}/documents`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setOrderPaperwork(data);
      } else {
        console.error('書類取得に失敗しました');
      }
    } catch (error) {
      console.error('書類取得エラー:', error);
    }
  };

  const createPaperwork = async () => {
    if (!selectedOrderForDoc) return;

    try {
      const token = localStorage.getItem("adminToken");
      if (!token) return;

      const response = await fetch(`${API_URL}/api/admin/orders/${selectedOrderForDoc.id}/documents`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          documentType: createDocType,
          deliveryDate: deliveryDate || null
        }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('書類作成成功:', result.paperwork?.documentNumber || 'No document number');
        setShowCreateDocModal(false);
        setDeliveryDate('');
        await fetchOrderPaperwork(selectedOrderForDoc.id);
      } else {
        const errorData = await response.json();
        alert('書類作成に失敗しました: ' + errorData.error);
      }
    } catch (error) {
      console.error('書類作成エラー:', error);
      alert('書類作成中にエラーが発生しました');
    }
  };

  const approvePaperwork = async (paperworkId: number) => {
    if (!selectedOrderForDoc) return;

    try {
      const token = localStorage.getItem("adminToken");
      if (!token) return;

      const response = await fetch(`${API_URL}/api/admin/orders/${selectedOrderForDoc.id}/documents`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          documentId: paperworkId,
          action: 'approve',
          approvedBy: '管理者'
        }),
      });

      if (response.ok) {
        console.log('書類承認成功');
        await fetchOrderPaperwork(selectedOrderForDoc.id);
      } else {
        alert('書類承認に失敗しました');
      }
    } catch (error) {
      console.error('書類承認エラー:', error);
    }
  };

  const finalizePaperwork = async (paperworkId: number) => {
    if (!selectedOrderForDoc) return;

    try {
      const token = localStorage.getItem("adminToken");
      if (!token) return;

      const response = await fetch(`${API_URL}/api/admin/orders/${selectedOrderForDoc.id}/documents`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          documentId: paperworkId,
          action: 'finalize'
        }),
      });

      if (response.ok) {
        console.log('書類ファイナライズ成功');
        await fetchOrderPaperwork(selectedOrderForDoc.id);
      } else {
        alert('書類ファイナライズに失敗しました');
      }
    } catch (error) {
      console.error('書類ファイナライズエラー:', error);
    }
  };

  const downloadPaperwork = (paperworkId: number) => {
    const token = localStorage.getItem("adminToken");
    if (!token || !selectedOrderForDoc) return;

    // 正しいAPIエンドポイントにリクエスト（orders配下に変更）
    const url = `${API_URL}/api/orders/${selectedOrderForDoc.id}/download?documentId=${paperworkId}`;
    
    // 新しいタブでプレビューを開く
    const previewWindow = window.open('', '_blank');
    
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
      if (previewWindow) {
        previewWindow.document.write(html);
        previewWindow.document.close();
      }
    })
    .catch(error => {
      console.error('プレビューエラー:', error);
      if (previewWindow) {
        previewWindow.close();
      }
      alert('プレビューの表示に失敗しました: ' + error.message);
    });
  };

  const filteredOrders = orders.filter(order => {
    // ステータスフィルタ
    const statusMatch = statusFilter === "all" || order.status === statusFilter;
    
    // 検索キーワードフィルタ
    const keywordMatch = !searchKeyword || 
      order.orderNumber.toLowerCase().includes(searchKeyword.toLowerCase()) ||
      order.user.name.toLowerCase().includes(searchKeyword.toLowerCase()) ||
      order.user.company.name.toLowerCase().includes(searchKeyword.toLowerCase()) ||
      order.deliveryName.toLowerCase().includes(searchKeyword.toLowerCase()) ||
      (order.deliveryCompany && order.deliveryCompany.toLowerCase().includes(searchKeyword.toLowerCase()));
    
    return statusMatch && keywordMatch;
  });

  const pendingCancelCount = orders.filter(order => order.status === 'cancel_requested').length;

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
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Package className="h-6 w-6 text-blue-600" />
              受注管理
              {pendingCancelCount > 0 && (
                <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-sm">
                  キャンセル申請 {pendingCancelCount}件
                </span>
              )}
            </h1>
            <p className="text-gray-600">受注の確認・ステータス管理・キャンセル承認・書類作成を行います。</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <input
                type="text"
                placeholder="注文番号・会社名・担当者名で検索..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className="w-64 px-3 py-2 pl-8 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <FileText className="h-4 w-4 text-gray-400 absolute left-2.5 top-3" />
            </div>
            <select 
              value={statusFilter} 
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border rounded-lg px-3 py-2"
            >
              <option value="all">すべて ({orders.length})</option>
              <option value="pending">注文受付 ({orders.filter(o => o.status === 'pending').length})</option>
              <option value="confirmed">注文確定 ({orders.filter(o => o.status === 'confirmed').length})</option>
              <option value="processing">商品手配中 ({orders.filter(o => o.status === 'processing').length})</option>
              <option value="shipped">発送済み ({orders.filter(o => o.status === 'shipped').length})</option>
              <option value="delivered">配送完了 ({orders.filter(o => o.status === 'delivered').length})</option>
              <option value="cancel_requested">キャンセル申請中 ({pendingCancelCount})</option>
              <option value="cancelled">キャンセル ({orders.filter(o => o.status === 'cancelled').length})</option>
              <option value="cancel_rejected">キャンセル拒否 ({orders.filter(o => o.status === 'cancel_rejected').length})</option>
            </select>
          </div>
        </div>
      </div>

      {/* 一括操作ツールバー */}
      {filteredOrders.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4 mb-4 border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSelectAll}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                  disabled={selectedOrderIds.length === filteredOrders.length}
                >
                  全選択
                </button>
                <button
                  onClick={handleDeselectAll}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                  disabled={selectedOrderIds.length === 0}
                >
                  選択解除
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">
                    {selectedOrderIds.length}件選択中
                  </span>
                  <span className="text-xs text-gray-500">
                    / 表示中{filteredOrders.length}件
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {selectedOrderIds.length > 0 && (
                <>
                  <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg border border-blue-200">
                    <span className="text-sm text-blue-600">更新先:</span>
                    <select
                      value={bulkUpdateStatus}
                      onChange={(e) => setBulkUpdateStatus(e.target.value)}
                      className="text-sm border-0 bg-transparent text-blue-700 font-medium focus:ring-0 focus:outline-none"
                    >
                      <option value="confirmed">✅ 注文確定</option>
                      <option value="processing">⚙️ 商品手配中</option>
                      <option value="shipped">🚚 発送済み</option>
                      <option value="delivered">📦 配送完了</option>
                    </select>
                  </div>
                  <button
                    onClick={() => setShowBulkUpdateModal(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 flex items-center gap-2 transition-colors"
                  >
                    <Package className="h-4 w-4" />
                    {selectedOrderIds.length}件を一括更新
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {filteredOrders.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="text-gray-500">
            <Package className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p className="text-lg mb-2">
              {statusFilter === "all" ? "受注データがありません" : "該当する受注がありません"}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => (
            <div key={order.id} className="bg-white rounded-lg shadow hover:shadow-md transition-shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <input
                    type="checkbox"
                    checked={selectedOrderIds.includes(order.id)}
                    onChange={(e) => handleSelectOrder(order.id, e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <div>
                    <div className="flex items-center gap-2 text-lg font-semibold">
                      {order.orderNumber}
                      <span className={`px-2 py-1 rounded text-sm ${statusLabels[order.status]?.color || 'bg-gray-100 text-gray-800'}`}>
                        {statusLabels[order.status]?.label || order.status}
                      </span>
                      {order.status === 'cancel_requested' && (
                        <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-sm animate-pulse">
                          要対応
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4 text-gray-500" />
                        {new Date(order.createdAt).toLocaleDateString('ja-JP')}
                      </span>
                      <span className="flex items-center gap-1">
                        <User className="h-4 w-4 text-blue-500" />
                        {order.user.name} ({order.user.company.name})
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold">
                    {order.totalAmount.toLocaleString()}円<span className="text-sm text-gray-500 ml-1">(税抜)</span>
                  </div>
                  <div className="text-sm text-gray-500">
                    {order.orderItems.reduce((sum, item) => sum + item.quantity, 0)}点
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 mt-1 text-red-400" />
                  <div className="text-sm text-gray-600">
                    <div className="font-medium">{order.deliveryName}</div>
                    {order.deliveryCompany && <div>{order.deliveryCompany}</div>}
                    <div>
                      〒{order.deliveryZipCode} {order.deliveryPrefecture}{order.deliveryCity}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedOrder(order)}
                    className="px-3 py-1 border rounded text-sm hover:bg-gray-50 flex items-center gap-1"
                  >
                    <FileText className="h-4 w-4 text-gray-600" />
                    詳細
                  </button>

                  {/* 書類管理ボタン - 受領書、請求書の仕組みを一時的に非表示。 */}
{/*
                  <button
                    onClick={() => openDocumentModal(order)}
                    className="px-3 py-1 border border-blue-200 text-blue-600 rounded text-sm hover:bg-blue-50 flex items-center gap-1"
                  >
                    <FileText className="h-4 w-4 text-blue-600" />
                    書類管理
                  </button>
                  */}
                  {order.status === 'cancel_requested' && (
                    <>
                      <button
                        onClick={() => handleCancelApproval(order.id, true)}
                        className="px-3 py-1 border border-green-200 text-green-600 rounded text-sm hover:bg-green-50 flex items-center gap-1"
                      >
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        承認
                      </button>
                      <button
                        onClick={() => handleCancelApproval(order.id, false)}
                        className="px-3 py-1 border border-red-200 text-red-600 rounded text-sm hover:bg-red-50 flex items-center gap-1"
                      >
                        <XCircle className="h-4 w-4 text-red-600" />
                        拒否
                      </button>
                    </>
                  )}
                  
                  {['pending', 'confirmed', 'processing', 'shipped'].includes(order.status) && (
                    <select
                      value={order.status}
                      onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                      className="border rounded text-sm px-2 py-1"
                    >
                      <option value="pending">注文受付</option>
                      <option value="confirmed">注文確定</option>
                      <option value="processing">商品手配中</option>
                      <option value="shipped">発送済み</option>
                      <option value="delivered">配送完了</option>
                    </select>
                  )}
                  
                  {order.status === 'delivered' && (
                    <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded text-sm">
                      配送完了済み
                    </span>
                  )}
                </div>
              </div>

              {/* キャンセル理由の常時表示 */}
              {order.cancelReason && (
                <div className="mt-4 p-4 bg-orange-50 rounded-lg border border-orange-200">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-4 w-4 text-orange-600" />
                    <span className="font-medium text-orange-800">キャンセル理由:</span>
                  </div>
                  <div className="text-orange-700 leading-relaxed">
                    {order.cancelReason}
                  </div>
                </div>
              )}
              
              {/* キャンセル拒否理由の常時表示 */}
              {order.cancelRejectReason && (
                <div className="mt-4 p-4 bg-red-50 rounded-lg border border-red-200">
                  <div className="flex items-center gap-2 mb-2">
                    <XCircle className="h-4 w-4 text-red-600" />
                    <span className="font-medium text-red-800">キャンセル拒否理由:</span>
                  </div>
                  <div className="text-red-700 leading-relaxed">
                    {order.cancelRejectReason}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 一括更新確認モーダル */}
      {showBulkUpdateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-2xl">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Package className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                一括ステータス更新
              </h3>
              <p className="text-gray-600">
                選択した注文のステータスを一括で変更します
              </p>
            </div>

            {/* 現在の状況 */}
            <div className="space-y-4 mb-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-sm text-gray-600 mb-1">現在の表示フィルタ</div>
                <div className="font-medium text-gray-900">
                  {statusLabels[statusFilter]?.label || statusFilter === "all" ? "すべて" : statusFilter}
                </div>
              </div>

              <div className="bg-blue-50 rounded-lg p-4">
                <div className="text-sm text-blue-600 mb-1">更新対象</div>
                <div className="font-medium text-blue-900">
                  選択した {selectedOrderIds.length} 件の注文
                </div>
                <div className="text-xs text-blue-600 mt-1">
                  {selectedOrderIds.length < filteredOrders.length 
                    ? `表示中 ${filteredOrders.length} 件のうち ${selectedOrderIds.length} 件を選択`
                    : `表示中の全 ${filteredOrders.length} 件を選択`
                  }
                </div>
              </div>

              {/* Before/After */}
              <div className="flex items-center justify-between bg-gradient-to-r from-gray-50 to-green-50 rounded-lg p-4">
                <div className="text-center flex-1">
                  <div className="text-xs text-gray-500 mb-1">変更前</div>
                  <div className="text-sm font-medium text-gray-700">
                    {statusFilter === "all" ? "混在" : statusLabels[statusFilter]?.label}
                  </div>
                </div>
                <div className="px-3">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                    <span className="text-green-600 text-lg">→</span>
                  </div>
                </div>
                <div className="text-center flex-1">
                  <div className="text-xs text-green-600 mb-1">変更後</div>
                  <div className="text-sm font-semibold text-green-700">
                    {statusLabels[bulkUpdateStatus]?.label}
                  </div>
                </div>
              </div>

              {/* ステータス選択 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  更新後のステータス
                </label>
                <select
                  value={bulkUpdateStatus}
                  onChange={(e) => setBulkUpdateStatus(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                >
                  <option value="confirmed">✅ 注文確定</option>
                  <option value="processing">⚙️ 商品手配中</option>
                  <option value="shipped">🚚 発送済み</option>
                  <option value="delivered">📦 配送完了</option>
                </select>
              </div>
            </div>

            {/* 警告 */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6">
              <div className="flex items-start">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 mr-2 flex-shrink-0" />
                <div className="text-xs text-amber-700">
                  この操作は取り消せません。選択した全ての注文が同じステータスに変更されます。
                </div>
              </div>
            </div>

            {/* アクションボタン */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowBulkUpdateModal(false)}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleBulkUpdate}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                {selectedOrderIds.length}件を更新
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 注文詳細モーダル */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">受注詳細 - {selectedOrder.orderNumber}</h2>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>
              
              <div className="space-y-6">
                {/* 注文情報 */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="font-semibold mb-2">注文情報</h3>
                    <div className="space-y-1 text-sm">
                      <div>注文番号: {selectedOrder.orderNumber}</div>
                      <div>注文日時: {new Date(selectedOrder.createdAt).toLocaleString('ja-JP')}</div>
                      <div>注文者: {selectedOrder.user.name}</div>
                      <div>会社: {selectedOrder.user.company.name}</div>
                      <div className="flex items-center gap-2">
                        ステータス: 
                        <span className={`px-2 py-1 rounded text-xs ${statusLabels[selectedOrder.status]?.color || 'bg-gray-100 text-gray-800'}`}>
                          {statusLabels[selectedOrder.status]?.label || selectedOrder.status}
                        </span>
                      </div>
                      {selectedOrder.cancelReason && (
                        <div className="mt-2 p-3 bg-orange-50 rounded border border-orange-200">
                          <div className="flex items-center gap-2 mb-2">
                            <AlertTriangle className="h-4 w-4 text-orange-600" />
                            <span className="font-medium text-orange-800">キャンセル理由:</span>
                          </div>
                          <div className="text-orange-700 text-sm leading-relaxed">
                            {selectedOrder.cancelReason}
                          </div>
                        </div>
                      )}
                      {selectedOrder.cancelRejectReason && (
                        <div className="mt-2 p-3 bg-red-50 rounded border border-red-200">
                          <div className="flex items-center gap-2 mb-2">
                            <XCircle className="h-4 w-4 text-red-600" />
                            <span className="font-medium text-red-800">キャンセル拒否理由:</span>
                          </div>
                          <div className="text-red-700 text-sm leading-relaxed">
                            {selectedOrder.cancelRejectReason}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">配送先</h3>
                    <div className="space-y-1 text-sm">
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

                {/* 注文商品 */}
                <div>
                  <h3 className="font-semibold mb-3">注文商品</h3>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="p-3 text-left">商品</th>
                          <th className="p-3 text-center">数量</th>
                          <th className="p-3 text-center">単価(税抜)</th>
                          <th className="p-3 text-center">合計(税抜)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedOrder.orderItems.map((item) => (
                          <tr key={item.id} className="border-t">
                            <td className="p-3">
                              <div>
                                <div className="font-medium">{item.product.name}</div>
                                <div className="text-gray-500 text-xs">
                                  {item.product.manufacturer} | {item.product.code} | {item.product.capacity}{item.product.unit}
                                </div>
                              </div>
                            </td>
                            <td className="p-3 text-center">{item.quantity}</td>
                            <td className="p-3 text-center">{item.unitPrice.toLocaleString()}円</td>
                            <td className="p-3 text-center font-medium">{item.totalPrice.toLocaleString()}円</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-50">
                        <tr>
                          <td colSpan={3} className="p-3 text-right font-semibold">合計金額(税抜):</td>
                          <td className="p-3 text-center font-bold text-lg">
                            {selectedOrder.totalAmount.toLocaleString()}円
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 書類管理モーダル */}
      {showDocumentModal && selectedOrderForDoc && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">書類管理 - {selectedOrderForDoc.orderNumber}</h2>
                <button
                  onClick={() => setShowDocumentModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>
              
              <div className="space-y-6">
                {/* 書類作成ボタン */}
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setCreateDocType('delivery_note');
                      setShowCreateDocModal(true);
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2"
                  >
                    <FileText className="h-4 w-4" />
                    納品書作成
                  </button>
                  <button
                    onClick={() => {
                      setCreateDocType('receipt');
                      setShowCreateDocModal(true);
                    }}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-2"
                  >
                    <FileText className="h-4 w-4" />
                    受領書作成
                  </button>
                </div>

                {/* 既存書類一覧 */}
                <div>
                  <h3 className="font-semibold mb-3">作成済み書類</h3>
                  {orderPaperwork.length === 0 ? (
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                      <FileText className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-500">まだ書類が作成されていません。</p>
                      <p className="text-sm text-gray-400">上のボタンから納品書または受領書を作成してください。</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {orderPaperwork.map((paperwork) => (
                        <div key={paperwork.id} className="border rounded-lg p-4 bg-gray-50">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                            <div className="font-medium text-lg mb-1 flex items-center gap-2">
                                <FileText className="h-5 w-5" />
                                {paperwork.documentType === 'delivery_note' ? '納品書' : '受領書'}: {paperwork.documentNumber}
                              </div>
                              <div className="text-sm text-gray-600 space-y-1">
                                <div>作成日: {new Date(paperwork.createdAt).toLocaleDateString('ja-JP')} | 
                                作成者: {paperwork.createdBy.username}</div>
                                <div className="flex items-center gap-4">
                                  <span>ステータス: <span className={`px-2 py-1 rounded text-xs ${
                                    paperwork.status === 'finalized' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                                  }`}>
                                    {paperwork.status === 'finalized' ? '確定済み' : '下書き'}
                                  </span></span>
                                  {paperwork.deliveryDate && (
                                    <span>納期: {new Date(paperwork.deliveryDate).toLocaleDateString('ja-JP')}</span>
                                  )}
                                  {paperwork.documentType === 'receipt' && paperwork.isApproved && (
                                    <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-bold flex items-center gap-1">
                                      <Stamp className="h-3 w-3" />
                                      承認印済み
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-2 ml-4">
                              <button
                                onClick={() => downloadPaperwork(paperwork.id)}
                                className="px-3 py-1 border border-gray-300 text-gray-700 rounded text-sm hover:bg-gray-50 flex items-center gap-1"
                              >
                                <FileText className="h-4 w-4" />
                                プレビュー
                              </button>
                              {paperwork.documentType === 'receipt' && !paperwork.isApproved && paperwork.status === 'finalized' && (
                                <button
                                  onClick={() => approvePaperwork(paperwork.id)}
                                  className="px-3 py-1 border border-red-200 text-red-600 rounded text-sm hover:bg-red-50 flex items-center gap-1"
                                >
                                  <Stamp className="h-4 w-4" />
                                  承認印押印
                                </button>
                              )}
                              {paperwork.status === 'draft' && (
                                <button
                                  onClick={() => finalizePaperwork(paperwork.id)}
                                  className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 flex items-center gap-1"
                                >
                                  <Check className="h-4 w-4" />
                                  確定
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 書類作成モーダル */}
      {showCreateDocModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {createDocType === 'delivery_note' ? '納品書作成' : '受領書作成'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  納期日 (オプション)
                </label>
                <input
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  ※空欄の場合は今日の日付が使用されます
                </p>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => {
                    setShowCreateDocModal(false);
                    setDeliveryDate('');
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  キャンセル
                </button>
                <button
                  onClick={createPaperwork}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  作成
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* キャンセル理由詳細表示モーダル */}
      {showCancelReasonModal && selectedCancelReason && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
                キャンセル理由詳細
              </h3>
              <button
                onClick={() => setShowCancelReasonModal(false)}
                className="text-gray-400 hover:text-gray-600 text-xl"
              >
                ×
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <span className="text-sm text-gray-600">注文番号:</span>
                <span className="ml-2 font-medium">{selectedCancelReason.orderNumber}</span>
              </div>
              <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                <div className="font-medium text-orange-800 mb-2">キャンセル理由:</div>
                <div className="text-orange-700 leading-relaxed whitespace-pre-wrap">
                  {selectedCancelReason.reason}
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => setShowCancelReasonModal(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                >
                  閉じる
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* キャンセル拒否理由入力モーダル */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">キャンセル拒否理由</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  拒否理由を入力してください
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  rows={4}
                  placeholder="キャンセルを拒否する理由を詳しく入力してください..."
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => {
                    setShowRejectModal(false);
                    setRejectOrderId(null);
                    setRejectReason("");
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleRejectSubmit}
                  disabled={!rejectReason.trim()}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  拒否する
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

export default AdminOrderManagementPage;