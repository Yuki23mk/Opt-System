'use client';

/**
 * ファイルパス: app/(withSidebar)/approval/page.tsx
 * 承認待ち画面（承認フロー機能）- 共有モーダル使用版
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  User, 
  Calendar, 
  Package, 
  MapPin,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { useConfirmModal } from '../common/components/ConfirmModal';
import { ENV } from '@/lib/env';

// 型定義
interface ApprovalInfo {
  id: number;
  orderId: number;
  status: string;
  requestedAt: string;
  rejectionReason?: string;
  order: {
    id: number;
    orderNumber: string;
    totalAmount: number;
    status: string;
    createdAt: string;
    deliveryName: string;
    deliveryCompany?: string;
    deliveryAddress: {
      zipCode: string;
      prefecture: string;
      city: string;
      address1: string;
      address2?: string;
      phone?: string;
    };
    orderItems: Array<{
      id: number;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
      companyProduct: {
        id: number;
        productMaster: {
          id: number;
          code: string;
          name: string;
          manufacturer: string;
          capacity: string;
          unit: string;
          oilType: string;
        };
      };
    }>;
  };
  requester: {
    id: number;
    name: string;
    email: string;
    isDeleted: boolean;
    displayName: string;
    department?: string;
    position?: string;
  };
  approver?: any;
  priceNote: string;
  itemCount: number;
}

interface ApprovalResponse {
  approvals: ApprovalInfo[];
  totalCount: number;
  approverInfo: {
    id: number;
    name: string;
    hasApprovalPermission: boolean;
  };
}

const ApprovalPage = () => {
  const [approvals, setApprovals] = useState<ApprovalInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingIds, setProcessingIds] = useState<Set<number>>(new Set());
  const [sortBy, setSortBy] = useState('requestedAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [approverInfo, setApproverInfo] = useState<any>(null);
  
  // 却下モーダル関連のstate
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [selectedApproval, setSelectedApproval] = useState<ApprovalInfo | null>(null);
  
  const { toast } = useToast();
  const { openConfirm  } = useConfirmModal();

  // 承認待ち一覧の取得
  const fetchPendingApprovals = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      if (!token) {
        toast({
          title: "認証エラー",
          description: "ログインが必要です",
          variant: "destructive",
        });
        return;
      }

      const response = await fetch(
        `${ENV.API_URL}/api/orders/pending-approvals?sortBy=${sortBy}&sortOrder=${sortOrder}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          }
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '承認待ち一覧の取得に失敗しました');
      }

      const data: ApprovalResponse = await response.json();
      setApprovals(data.approvals);
      setApproverInfo(data.approverInfo);
      
      console.log('✅ 承認待ち一覧取得成功:', {
        count: data.totalCount,
        approver: data.approverInfo.name
      });

    } catch (error) {
      console.error('❌ 承認待ち一覧取得エラー:', error);
      toast({
        title: "取得エラー",
        description: error instanceof Error ? error.message : '承認待ち一覧の取得に失敗しました',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // 承認・却下処理
  const handleApprovalAction = async (
    approvalId: number, 
    orderId: number, 
    orderNumber: string,
    action: 'approve' | 'reject', 
    rejectionReason?: string
  ) => {
    try {
      setProcessingIds(prev => new Set(prev).add(approvalId));
      
      const token = localStorage.getItem('token');
      if (!token) {
        toast({
          title: "認証エラー",
          description: "ログインが必要です",
          variant: "destructive",
        });
        return;
      }

      const requestBody: any = {
        orderId,
        action
      };

      if (action === 'reject' && rejectionReason) {
        requestBody.rejectionReason = rejectionReason;
      }

      const response = await fetch(`${ENV.API_URL}/api/orders/approve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `${action === 'approve' ? '承認' : '却下'}処理に失敗しました`);
      }

      const result = await response.json();
      
      toast({
        title: "処理完了",
        description: `注文【${orderNumber}】を${action === 'approve' ? '承認' : '却下'}しました`,
      });

      // 一覧を再取得
      await fetchPendingApprovals();

      // 🆕 サイドバーの承認待ち件数を更新するためのイベント発火
      window.dispatchEvent(new CustomEvent('approvalCountChanged'));

    } catch (error) {
      console.error(`❌ ${action === 'approve' ? '承認' : '却下'}処理エラー:`, error);
      toast({
        title: "処理エラー",
        description: error instanceof Error ? error.message : `${action === 'approve' ? '承認' : '却下'}処理に失敗しました`,
        variant: "destructive",
      });
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(approvalId);
        return newSet;
      });
    }
  };

  // 承認確認
  const handleApprove = (approval: ApprovalInfo) => {
    openConfirm({
      type: 'question',
      title: '注文承認の確認',
      message: `注文【${approval.order.orderNumber}】を承認しますか？\n\n承認者: ${approverInfo?.name}\n申請者: ${approval.requester.displayName}\n金額: ¥${approval.order.totalAmount.toLocaleString()} (税抜)`,
      confirmText: '承認する',
      onConfirm: () => handleApprovalAction(
        approval.id, 
        approval.orderId, 
        approval.order.orderNumber,
        'approve'
      )
    });
  };

  // 却下確認（理由入力付き）
  const handleReject = (approval: ApprovalInfo) => {
    setSelectedApproval(approval);
    setRejectionReason('');
    setRejectModalOpen(true);
  };

  // 却下モーダルでの確定処理
  const handleRejectConfirm = () => {
    if (!selectedApproval) return;
    
    if (!rejectionReason.trim()) {
      toast({
        title: "入力エラー",
        description: "却下理由を入力してください",
        variant: "destructive",
      });
      return;
    }

    // モーダルを閉じる
    setRejectModalOpen(false);

    // 確認ダイアログを表示
    openConfirm ({
      type: 'danger',
      title: '注文却下の確認',
      message: `注文【${selectedApproval.order.orderNumber}】を却下しますか？\n\n却下理由: ${rejectionReason.trim()}\n\nこの操作は取り消せません。`,
      confirmText: '却下する',
      onConfirm: () => handleApprovalAction(
        selectedApproval.id, 
        selectedApproval.orderId, 
        selectedApproval.order.orderNumber,
        'reject', 
        rejectionReason.trim()
      )
    });
  };

  // 却下モーダルのキャンセル処理
  const handleRejectCancel = () => {
    setRejectModalOpen(false);
    setRejectionReason('');
    setSelectedApproval(null);
  };

  // ソート変更
  const handleSortChange = (newSortBy: string) => {
    if (sortBy === newSortBy) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy);
      setSortOrder('desc');
    }
  };

  // 初期データ取得
  useEffect(() => {
    fetchPendingApprovals();
  }, [sortBy, sortOrder]);

  // ローディング表示
  if (loading) {
    return (
      <div className="p-4 bg-white min-h-screen">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-[#115e59]" />
            <span className="ml-2 text-[#115e59]">承認待ち一覧を読み込み中...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-white min-h-screen">
      <div className="max-w-5xl mx-auto space-y-3">
        {/* ヘッダー */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <AlertCircle className="h-5 w-5 text-[#115e59]" />
            <h1 className="text-xl font-bold text-slate-700">承認待ち注文</h1>
            {approvals.length > 0 && (
              <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                {approvals.length}件
              </Badge>
            )}
          </div>
          
          <Button
            onClick={fetchPendingApprovals}
            size="sm"
            className="bg-[#115e59] hover:bg-[#0f766e] text-white h-7 text-xs px-2 py-1"
          >
            更新
          </Button>
        </div>

        {/* 承認者情報 */}
        {approverInfo && (
          <Card className="border-[#115e59]/20">
            <CardContent className="p-3">
              <div className="flex items-center space-x-2 text-sm text-slate-600">
                <User className="h-4 w-4" />
                <span>承認者: <strong>{approverInfo.name}</strong></span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ソートボタン */}
        <div className="flex items-center space-x-2">
          <span className="text-xs text-slate-600">並び替え:</span>
          <Button
            onClick={() => handleSortChange('requestedAt')}
            size="sm"
            variant={sortBy === 'requestedAt' ? 'default' : 'outline'}
            className={`h-7 text-xs px-2 py-1 ${
              sortBy === 'requestedAt' 
                ? 'bg-[#115e59] hover:bg-[#0f766e] text-white' 
                : 'hover:bg-slate-50'
            }`}
          >
            申請日時 {sortBy === 'requestedAt' && (sortOrder === 'asc' ? '↑' : '↓')}
          </Button>
          <Button
            onClick={() => handleSortChange('orderNumber')}
            size="sm"
            variant={sortBy === 'orderNumber' ? 'default' : 'outline'}
            className={`h-7 text-xs px-2 py-1 ${
              sortBy === 'orderNumber' 
                ? 'bg-[#115e59] hover:bg-[#0f766e] text-white' 
                : 'hover:bg-slate-50'
            }`}
          >
            注文番号 {sortBy === 'orderNumber' && (sortOrder === 'asc' ? '↑' : '↓')}
          </Button>
          <Button
            onClick={() => handleSortChange('totalAmount')}
            size="sm"
            variant={sortBy === 'totalAmount' ? 'default' : 'outline'}
            className={`h-7 text-xs px-2 py-1 ${
              sortBy === 'totalAmount' 
                ? 'bg-[#115e59] hover:bg-[#0f766e] text-white' 
                : 'hover:bg-slate-50'
            }`}
          >
            金額 {sortBy === 'totalAmount' && (sortOrder === 'asc' ? '↑' : '↓')}
          </Button>
        </div>

        {/* 承認待ち一覧 */}
        {approvals.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <CheckCircle className="h-12 w-12 text-[#115e59] mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-700 mb-2">
                承認待ちの注文はありません
              </h3>
              <p className="text-slate-500">
                新しい承認依頼があると、こちらに表示されます。
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {approvals.map((approval) => (
              <Card key={approval.id} className="border-l-4 border-l-amber-500">
                <CardHeader className="bg-[#115e59] text-white p-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium flex items-center space-x-2">
                      <Clock className="h-4 w-4" />
                      <span>注文番号: {approval.order.orderNumber}</span>
                    </CardTitle>
                    <Badge className="bg-amber-500 text-white text-xs">
                      承認待ち
                    </Badge>
                  </div>
                </CardHeader>
                
                <CardContent className="p-3 space-y-3">
                  {/* 基本情報 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <User className="h-3 w-3 text-slate-500" />
                        <span className="text-slate-600">申請者:</span>
                        <span className="font-medium">
                          {approval.requester.displayName}
                          {approval.requester.department && 
                            ` (${approval.requester.department})`
                          }
                        </span>
                        {approval.requester.isDeleted && (
                          <Badge variant="secondary" className="text-xs">削除済み</Badge>
                        )}
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-3 w-3 text-slate-500" />
                        <span className="text-slate-600">申請日時:</span>
                        <span>{new Date(approval.requestedAt).toLocaleString('ja-JP')}</span>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Package className="h-3 w-3 text-slate-500" />
                        <span className="text-slate-600">商品数:</span>
                        <span>{approval.itemCount}点</span>
                        <span className="text-slate-600">金額:</span>
                        <span className="font-medium text-[#115e59]">
                          ¥{approval.order.totalAmount.toLocaleString()}
                        </span>
                        <span className="text-slate-500">(税抜)</span>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-start space-x-2">
                        <MapPin className="h-3 w-3 text-slate-500 mt-0.5" />
                        <div>
                          <span className="text-slate-600">配送先:</span>
                          <div className="text-slate-700">
                            {approval.order.deliveryName}
                            {approval.order.deliveryCompany && 
                              ` (${approval.order.deliveryCompany})`
                            }
                            <br />
                            〒{approval.order.deliveryAddress.zipCode}
                            <br />
                            {approval.order.deliveryAddress.prefecture}
                            {approval.order.deliveryAddress.city}
                            {approval.order.deliveryAddress.address1}
                            {approval.order.deliveryAddress.address2}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 注文商品一覧 */}
                  <div className="border border-slate-200 rounded">
                    <div className="bg-slate-50 p-2 border-b">
                      <h4 className="text-xs font-medium text-slate-700">注文商品</h4>
                    </div>
                    <div className="p-2">
                      <div className="space-y-1">
                        {approval.order.orderItems.map((item, index) => (
                          <div key={item.id} className="flex justify-between items-center text-xs py-1">
                            <div className="flex-1">
                              <span className="font-medium">
                                {item.companyProduct.productMaster.name}
                              </span>
                              <span className="text-slate-500 ml-1">
                                ({item.companyProduct.productMaster.manufacturer})
                              </span>
                            </div>
                            <div className="flex items-center space-x-2 text-right">
                              <span>{item.quantity}個</span>
                              <span>×</span>
                              <span>¥{item.unitPrice.toLocaleString()}</span>
                              <span>=</span>
                              <span className="font-medium text-[#115e59]">
                                ¥{item.totalPrice.toLocaleString()}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* アクションボタン */}
                  <div className="flex justify-end space-x-2 pt-2 border-t">
                    <Button
                      onClick={() => handleReject(approval)}
                      disabled={processingIds.has(approval.id)}
                      size="sm"
                      className="bg-red-600 hover:bg-red-700 text-white h-7 text-xs px-3 py-1"
                    >
                      {processingIds.has(approval.id) ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <>
                          <XCircle className="h-3 w-3 mr-1" />
                          却下
                        </>
                      )}
                    </Button>
                    
                    <Button
                      onClick={() => handleApprove(approval)}
                      disabled={processingIds.has(approval.id)}
                      size="sm"
                      className="bg-[#115e59] hover:bg-[#0f766e] text-white h-7 text-xs px-3 py-1"
                    >
                      {processingIds.has(approval.id) ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <>
                          <CheckCircle className="h-3 w-3 mr-1" />
                          承認
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* 却下理由入力モーダル */}
        <Dialog open={rejectModalOpen} onOpenChange={setRejectModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>却下理由</DialogTitle>
              <DialogDescription>
                {selectedApproval && (
                  `注文【${selectedApproval.order.orderNumber}】`
                )}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <Textarea
                placeholder="却下理由を入力してください"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="min-h-[80px] resize-none"
                maxLength={200}
                autoFocus
              />
              <div className="text-xs text-slate-500 text-right">
                {rejectionReason.length}/200文字
              </div>
            </div>

            <DialogFooter className="space-x-2">
              <Button
                onClick={handleRejectCancel}
                variant="outline"
                size="sm"
              >
                キャンセル
              </Button>
              <Button
                onClick={handleRejectConfirm}
                size="sm"
                className="bg-red-600 hover:bg-red-700 text-white"
                disabled={!rejectionReason.trim()}
              >
                却下する
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default ApprovalPage;