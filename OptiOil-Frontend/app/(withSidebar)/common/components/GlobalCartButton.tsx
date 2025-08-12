"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ShoppingCart, Plus, Minus, X, AlertCircle } from "lucide-react";
import { useCart } from "../contexts/CartContext";
import { useConfirmModal } from "./ConfirmModal";
import { ToastContainer, ToastItem } from "./Toast";
import { ENV } from '@/lib/env';

// 型定義
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
}

interface GlobalCartButtonProps {
  className?: string;
}

export default function GlobalCartButton({ className }: GlobalCartButtonProps) {
  // カートコンテキスト
  const { state: cartState, updateQuantity, removeFromCart, clearCart } = useCart();
  const { openConfirm } = useConfirmModal();
  
  // Toast管理
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // モーダル状態
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [cartStep, setCartStep] = useState<'cart' | 'delivery' | 'confirm'>('cart');
  
  // 配送関連
  const [deliveryAddresses, setDeliveryAddresses] = useState<DeliveryAddress[]>([]);
  const [selectedDeliveryId, setSelectedDeliveryId] = useState<number | null>(null);
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(false);
  const [deliveryError, setDeliveryError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  
  // 注文確定
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);

  // 🆕 ユーザー承認権限情報
  const [userInfo, setUserInfo] = useState<any>(null);

  // 環境変数
  const API_URL = ENV.API_URL;
  const FRONTEND_URL = ENV.FRONTEND_URL;

  // Toast関数
  const addToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info', title?: string) => {
    const newToast: ToastItem = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      message,
      title,
      duration: 5000
    };
    setToasts(prev => [...prev, newToast]);

    setTimeout(() => {
      removeToast(newToast.id);
    }, 5000);
  };

  const removeToast = (id: string | number) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  // カートを開く
  const openCart = () => {
    setIsCartOpen(true);
    setCartStep('cart');
  };

  // カートアイテム数量更新（確認付き）
  const handleUpdateQuantity = async (cartId: number, newQuantity: number) => {
    try {
      await updateQuantity(cartId, newQuantity);
    } catch (error: any) {
      addToast(error.message || '数量の更新に失敗しました', 'error');
    }
  };

  // カートアイテム削除（確認付き）
  const handleRemoveItem = (item: any) => {
    openConfirm({
      title: '商品削除',
      message: `「${item.product?.name || 'Unknown'}」をカートから削除しますか？`,
      type: 'warning',
      confirmText: '削除',
      onConfirm: async () => {
        try {
          await removeFromCart(item.id);
          addToast('商品をカートから削除しました', 'success');
        } catch (error: any) {
          addToast(error.message || '削除に失敗しました', 'error');
        }
      }
    });
  };

  // 配送先選択ステップに移行
  const goToDeliveryStep = async () => {
    setCartStep('delivery');
    if (deliveryAddresses.length === 0 && !isLoadingAddresses) {
      await fetchDeliveryAddresses();
    }
    // 🆕 ユーザー情報も取得
    if (!userInfo) {
      await fetchUserInfo();
    }
  };

  // 🆕 ユーザー情報取得
  const fetchUserInfo = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const response = await fetch(`${API_URL}/api/auth/me_get`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const userData = await response.json();
        setUserInfo(userData.user); // ✅ user プロパティ内にデータがある
      }
    } catch (error) {
      console.error('ユーザー情報取得エラー:', error);
    }
  };

  // 配送先一覧取得
  const fetchDeliveryAddresses = async (isRetry = false) => {
    try {
      if (!isRetry) {
        setIsLoadingAddresses(true);
        setDeliveryError(null);
      }
      
      const token = localStorage.getItem("token");
      
      if (!token) {
        setDeliveryError('認証情報が見つかりません。再ログインしてください。');
        return;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, 30000);

      // 配送先取得API
      const response = await fetch(`${API_URL}/api/delivery-addresses`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 401) {
          setDeliveryError('認証が無効です。再ログインしてください。');
          localStorage.removeItem("token");
          window.location.href = `${FRONTEND_URL}/login`;
          return;
        } else if (response.status === 403) {
          setDeliveryError('配送先情報へのアクセス権限がありません。');
        } else if (response.status === 404) {
          setDeliveryError('配送先APIが見つかりません。');
        } else if (response.status >= 500) {
          setDeliveryError('サーバーエラーが発生しました。');
        } else {
          setDeliveryError('配送先の取得に失敗しました。');
        }
        return;
      }

      const responseText = await response.text();
      if (!responseText) {
        setDeliveryError('サーバーから空の応答が返されました。');
        return;
      }

      const addresses = JSON.parse(responseText);
      if (!Array.isArray(addresses)) {
        setDeliveryError('配送先データの形式が正しくありません。');
        return;
      }

      setDeliveryAddresses(addresses);
      setRetryCount(0);
      
      // デフォルト配送先を自動選択
      const defaultAddress = addresses.find((addr: DeliveryAddress) => addr.isDefault);
      if (defaultAddress) {
        setSelectedDeliveryId(defaultAddress.id);
      } else if (addresses.length > 0) {
        setSelectedDeliveryId(addresses[0].id);
      }

    } catch (error: any) {
      console.error('配送先取得エラー:', error);
      
      if (error.name === 'AbortError') {
        setDeliveryError('配送先の取得がタイムアウトしました。');
      } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
        setDeliveryError('ネットワークエラーが発生しました。');
      } else {
        setDeliveryError('配送先の取得中に予期しないエラーが発生しました。');
      }
    } finally {
      setIsLoadingAddresses(false);
    }
  };

  // リトライ機能付きの配送先取得
  const retryFetchDeliveryAddresses = async () => {
    if (retryCount < 3) {
      setRetryCount(prev => prev + 1);
      await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
      await fetchDeliveryAddresses(true);
    } else {
      setDeliveryError('配送先の取得に3回失敗しました。ページを再読み込みしてください。');
    }
  };

  // 注文確定処理（承認フロー対応）
  const handleConfirmOrder = async () => {
    if (!selectedDeliveryId) {
      addToast('配送先を選択してください', 'error');
      return;
    }

    if (!cartState.items || cartState.items.length === 0) {
      addToast('カートに商品がありません', 'error');
      return;
    }

    try {
      setIsSubmittingOrder(true);
      const token = localStorage.getItem("token");
      if (!token) {
        addToast('認証情報が見つかりません', 'error');
        return;
      }

      // 🆕 承認が必要かチェック
      const requiresApproval = userInfo?.permissions?.orderApproval?.requiresApproval === true;

      // 選択された配送先の詳細情報を取得
      const selectedAddress = deliveryAddresses.find(addr => addr.id === selectedDeliveryId);
      if (!selectedAddress) {
        addToast('配送先の詳細情報が見つかりません', 'error');
        return;
      }

      // 注文データを正しい形式で構築
      const orderItems = cartState.items.map(item => ({
        companyProductId: item.companyProductId, // 重要：companyProductIdを使用
        quantity: item.quantity,
        unitPrice: item.price || 0,
        totalPrice: item.quantity * (item.price || 0)
      }));

      const orderData = {
        deliveryAddressId: selectedDeliveryId,
        deliveryName: selectedAddress.name,
        deliveryCompany: selectedAddress.company || '',
        deliveryZipCode: selectedAddress.zipCode,
        deliveryPrefecture: selectedAddress.prefecture,
        deliveryCity: selectedAddress.city,
        deliveryAddress1: selectedAddress.address1,
        deliveryAddress2: selectedAddress.address2 || '',
        deliveryPhone: selectedAddress.phone || '',
        totalAmount: cartState.totalAmount,
        items: orderItems,
        // 🆕 承認フロー対応
        requiresApproval: requiresApproval
      };

      const response = await fetch(`${API_URL}/api/orders`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderData)
      });

      if (response.ok) {
        const orderResult = await response.json();
        
        // 🆕 承認フローに応じたメッセージ分岐
        if (requiresApproval) {
          addToast(
            `承認申請を送信しました（申請番号: ${orderResult.orderNumber}）`,
            'info',
            '承認申請完了'
          );
        } else {
          addToast(
            `注文が完了しました（注文番号: ${orderResult.orderNumber}）`,
            'success',
            '注文完了'
          );
        }
        
        // カートをクリア
        await clearCart();
        setIsCartOpen(false);
        setCartStep('cart');
        setSelectedDeliveryId(null);
      } else {
        let errorMessage = '注文の送信に失敗しました';
        
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch (parseError) {
          if (response.status === 500) {
            errorMessage = 'サーバーエラーが発生しました。しばらく時間をおいて再度お試しください。';
          } else if (response.status === 400) {
            errorMessage = '注文データに問題があります。商品情報を確認してください。';
          } else if (response.status === 401) {
            errorMessage = '認証が無効です。再ログインしてください。';
          }
        }
        
        throw new Error(errorMessage);
      }
    } catch (error: any) {
      console.error('注文エラー:', error);
      
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        addToast('ネットワークエラーが発生しました。', 'error', 'ネットワークエラー');
      } else {
        addToast(error.message || '注文の送信に失敗しました', 'error', '注文エラー');
      }
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  // 安全なデータ取得
  const cartItems = cartState?.items || [];
  const totalQuantity = cartState?.totalQuantity || 0;
  const totalAmount = cartState?.totalAmount || 0;
  const isLoading = cartState?.isLoading || false;

  return (
    <>
      {/* Toast通知（モーダル外・超高いz-index） */}
      <div style={{ zIndex: 99999 }} className="fixed top-4 right-4 pointer-events-none">
        <ToastContainer 
          toasts={toasts} 
          onClose={removeToast} 
          position="top-right" 
        />
      </div>

      {/* カートボタン */}
      <Button 
        onClick={openCart} 
        className={`
          flex items-center space-x-2 shadow-lg bg-slate-700 hover:bg-slate-800 text-white relative
          transition-all duration-200 hover:shadow-xl font-semibold px-4 py-2 h-10
          ${className}
        `}
        disabled={isLoading}
      >
        <ShoppingCart className="w-4 h-4" />
        <span>カート</span>
        {totalQuantity > 0 && (
          <span className="bg-red-500 text-white rounded-full text-xs px-2 py-1 ml-1">
            {totalQuantity}
          </span>
        )}
      </Button>

      {/* カートモーダル */}
      <Dialog open={isCartOpen} onOpenChange={setIsCartOpen}>
        <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold flex items-center space-x-2 text-slate-800">
              <ShoppingCart className="w-5 h-5" />
              <span>注文カート</span>
              {cartStep === 'delivery' && <span className="text-sm text-slate-500">- 配送先選択</span>}
              {cartStep === 'confirm' && <span className="text-sm text-slate-500">- 注文確認</span>}
            </DialogTitle>
          </DialogHeader>

          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-700 mx-auto mb-4"></div>
              <p className="text-slate-600">読み込み中...</p>
            </div>
          ) : cartItems.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <div className="w-12 h-12 mx-auto mb-4 text-slate-300">
                <ShoppingCart className="w-12 h-12" />
              </div>
              <p className="text-lg mb-2">カートに商品がありません</p>
              <p className="text-sm">商品を選択してカートに追加してください</p>
            </div>
          ) : (
            <>
              {cartStep === 'cart' && (
                <>
                  {/* 商品一覧表示（テーブル形式） */}
                  <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                    <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100">
                      <table className="w-full text-sm min-w-[750px] whitespace-nowrap">
                        <thead>
                        <tr className="bg-slate-50">
                          <th className="p-2 sm:p-3 text-left font-semibold text-slate-700 min-w-[200px]">製品名</th>
                          <th className="p-2 sm:p-3 text-center font-semibold text-slate-700 min-w-[80px]">容量</th>
                          <th className="p-2 sm:p-3 text-center font-semibold text-slate-700 min-w-[80px]">油種</th>
                          <th className="p-2 sm:p-3 text-center font-semibold text-slate-700 min-w-[120px]">数量</th>
                          <th className="p-2 sm:p-3 text-center font-semibold text-slate-700 min-w-[100px]">単価<br className="sm:hidden"/><span className="text-xs">(円・税抜)</span></th>
                          <th className="p-2 sm:p-3 text-center font-semibold text-slate-700 min-w-[100px]">金額<br className="sm:hidden"/><span className="text-xs">(円・税抜)</span></th>
                          </tr>
                        </thead>
                        <tbody>
                          {cartItems.map((item, idx) => (
                            <tr key={`${item.id}-${idx}`} className="border-t border-slate-100 hover:bg-slate-50/50">
                              <td className="p-2 sm:p-3">
                                <div className="flex items-center space-x-1 sm:space-x-2">
                                  <button
                                    onClick={() => handleRemoveItem(item)}
                                    className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded transition-colors flex-shrink-0"
                                    title="削除"
                                  >
                                    <X className="w-3 h-3 sm:w-4 sm:h-4" />
                                  </button>
                                  <div className="min-w-0">
                                    <div className="font-medium text-xs sm:text-sm text-slate-800 truncate">
                                      {item.product?.name || 'Unknown Product'}
                                    </div>
                                    <div className="text-xs text-slate-500 truncate">
                                      {item.product?.manufacturer || 'Unknown Manufacturer'}
                                    </div>
                                    {item.enabled === false && (
                                      <div className="flex items-center gap-1 text-xs text-amber-600 mt-1">
                                        <AlertCircle className="w-3 h-3" />
                                        <span className="text-xs">使用中止</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="p-2 sm:p-3 text-center text-xs sm:text-sm text-slate-600">
                                <div className="truncate">
                                  {item.product?.capacity || 'Unknown'}{item.product?.unit || ''}
                                </div>
                              </td>
                              <td className="p-2 sm:p-3 text-center text-xs sm:text-sm text-slate-600">
                                <div className="truncate">
                                  {item.product?.oilType || 'Unknown'}
                                </div>
                              </td>
                              <td className="p-2 sm:p-3 text-center">
                                <div className="flex items-center justify-center space-x-1 sm:space-x-2">
                                  <button
                                    onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                                    className="hover:bg-slate-100 p-1 rounded transition-colors text-slate-600 flex-shrink-0"
                                    disabled={item.quantity <= 1}
                                  >
                                    <Minus className="w-3 h-3" />
                                  </button>
                                  <input
                                    type="number"
                                    min={1}
                                    value={item.quantity}
                                    onChange={(e) => {
                                      const newQuantity = parseInt(e.target.value);
                                      const safeQuantity = isNaN(newQuantity) || newQuantity < 1 ? 1 : newQuantity;
                                      handleUpdateQuantity(item.id, safeQuantity);
                                    }}
                                    className="w-12 sm:w-16 border border-slate-200 px-1 sm:px-2 py-1 text-center rounded text-xs sm:text-sm focus:border-slate-400"
                                  />
                                  <button
                                    onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                                    className="hover:bg-slate-100 p-1 rounded transition-colors text-slate-600 flex-shrink-0"
                                  >
                                    <Plus className="w-3 h-3" />
                                  </button>
                                </div>
                              </td>
                              <td className="p-2 sm:p-3 text-center text-xs sm:text-sm text-slate-600">
                                <div className="truncate">
                                  {((item.price && item.price > 0) ? item.price : 0).toLocaleString()}
                                </div>
                              </td>
                              <td className="p-2 sm:p-3 text-center font-medium text-xs sm:text-sm text-slate-800">
                                <div className="truncate">
                                  {(item.quantity * ((item.price && item.price > 0) ? item.price : 0)).toLocaleString()}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* 合計とボタン */}
                  <div className="mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-slate-200 bg-slate-50 px-3 sm:px-4 py-3 rounded-lg space-y-3 sm:space-y-0">
                    {/* スマホ：縦並び、デスクトップ：横並び */}
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-2 sm:space-y-0">
                      <div className="text-xs sm:text-sm text-slate-600 order-2 sm:order-1">
                        合計 {totalQuantity} 点
                      </div>
                      <div className="text-center sm:text-right order-1 sm:order-2">
                        <div className="text-base sm:text-xl font-bold text-slate-800 mb-2 sm:mb-3">
                          合計金額: {totalAmount.toLocaleString()} 円 (税抜)
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-center sm:justify-end">
                      <Button 
                        className="bg-slate-700 hover:bg-slate-800 text-white text-sm px-6 py-2 w-full sm:w-auto"
                        onClick={goToDeliveryStep} 
                      >
                        配送先を選択
                      </Button>
                    </div>
                  </div>
                </>
              )}

              {cartStep === 'delivery' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-slate-800">配送先を選択してください</h3>
                  
                  {/* エラー表示 */}
                  {deliveryError && (
                    <div className="border border-red-300 bg-red-50 p-4 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-4 h-4 bg-red-500 rounded-full"></div>
                        <h4 className="font-semibold text-red-800">エラーが発生しました</h4>
                      </div>
                      <p className="text-red-700 text-sm mb-3 whitespace-pre-line">{deliveryError}</p>
                      <div className="flex gap-2">
                        <Button 
                          onClick={retryFetchDeliveryAddresses}
                          disabled={isLoadingAddresses || retryCount >= 3}
                          className="bg-red-600 hover:bg-red-700 text-white text-sm px-4 py-2"
                        >
                          {isLoadingAddresses ? '再試行中...' : `再試行 (${retryCount}/3)`}
                        </Button>
                        <Button 
                          onClick={() => window.location.reload()}
                          variant="outline"
                          className="text-sm px-4 py-2 border-slate-300 text-slate-700 hover:bg-slate-50"
                        >
                          ページを再読み込み
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* ローディング表示 */}
                  {isLoadingAddresses && !deliveryError && (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-700 mx-auto mb-4"></div>
                      <p className="text-slate-600">配送先を取得中...</p>
                    </div>
                  )}

                  {/* 配送先一覧表示 */}
                  {!isLoadingAddresses && !deliveryError && deliveryAddresses.length === 0 && (
                    <div className="text-center py-8 text-slate-500">
                      <p className="mb-4">配送先が登録されていません</p>
                      <p className="text-sm mb-4">配送先を登録してから注文を続けてください</p>
                      <div className="flex justify-center gap-2">
                        <Button 
                          onClick={() => {
                            setIsCartOpen(false);
                            window.location.href = '/settings';
                          }}
                          className="bg-slate-700 hover:bg-slate-800 text-white"
                        >
                          配送先を登録
                        </Button>
                        <Button 
                          onClick={() => fetchDeliveryAddresses()}
                          variant="outline"
                          className="border-slate-300 text-slate-700 hover:bg-slate-50"
                        >
                          再読み込み
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* 配送先一覧（正常時） */}
                  {!isLoadingAddresses && !deliveryError && deliveryAddresses.length > 0 && (
                    <div className="grid gap-3 max-h-96 overflow-y-auto">
                      <div className="text-sm text-teal-600 mb-2">
                        {deliveryAddresses.length}件の配送先が見つかりました
                      </div>
                      {deliveryAddresses.map((address) => (
                        <div
                          key={address.id}
                          className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                            selectedDeliveryId === address.id
                              ? 'border-slate-400 bg-slate-50'
                              : 'border-slate-200 hover:border-slate-300'
                          }`}
                          onClick={() => setSelectedDeliveryId(address.id)}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <input
                              type="radio"
                              checked={selectedDeliveryId === address.id}
                              onChange={() => setSelectedDeliveryId(address.id)}
                              className="text-slate-600"
                            />
                            <h4 className="font-semibold text-slate-800">{address.name}</h4>
                            {address.isDefault && (
                              <span className="bg-teal-600 text-white text-xs px-2 py-1 rounded">
                                デフォルト
                              </span>
                            )}
                          </div>
                          {address.company && (
                            <p className="text-slate-600 mb-1">{address.company}</p>
                          )}
                          <p className="text-slate-700 text-sm">
                            〒{address.zipCode} {address.prefecture}{address.city}
                          </p>
                          <p className="text-slate-700 text-sm">{address.address1}</p>
                          {address.address2 && (
                            <p className="text-slate-700 text-sm">{address.address2}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <div className="flex justify-between pt-4">
                    <Button 
                      onClick={() => setCartStep('cart')}
                      variant="outline"
                      className="border-slate-300 text-slate-700 hover:bg-slate-50"
                    >
                      戻る
                    </Button>
                    <Button 
                      onClick={() => setCartStep('confirm')}
                      disabled={!selectedDeliveryId || isLoadingAddresses}
                      className="bg-slate-700 hover:bg-slate-800 text-white"
                    >
                      注文内容を確認
                    </Button>
                  </div>
                </div>
              )}

              {cartStep === 'confirm' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-slate-800">注文内容確認</h3>
                  
                  {/* 配送先情報 */}
                  <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                    <h4 className="font-semibold mb-2 text-slate-800">配送先</h4>
                    {(() => {
                      const selectedAddress = deliveryAddresses.find(addr => addr.id === selectedDeliveryId);
                      return selectedAddress ? (
                        <div>
                          <p className="font-medium text-slate-800">{selectedAddress.name}</p>
                          {selectedAddress.company && <p className="text-slate-600">{selectedAddress.company}</p>}
                          <p className="text-slate-700">
                            〒{selectedAddress.zipCode} {selectedAddress.prefecture}{selectedAddress.city}
                          </p>
                          <p className="text-slate-700">{selectedAddress.address1}</p>
                          {selectedAddress.address2 && <p className="text-slate-700">{selectedAddress.address2}</p>}
                        </div>
                      ) : null;
                    })()}
                  </div>

                  {/* 注文商品一覧 */}
                  <div className="border border-slate-200 rounded-lg p-4">
                    <h4 className="font-semibold mb-3 text-slate-800">注文商品</h4>
                    <div className="space-y-2">
                      {cartItems.map((item, idx) => (
                        <div key={`${item.id}-${idx}`} className="flex justify-between items-center">
                          <div>
                            <span className="font-medium text-slate-800">
                              {item.product?.name || 'Unknown Product'}
                            </span>
                            <span className="text-slate-500 ml-2">× {item.quantity}</span>
                          </div>
                          <span className="font-medium text-slate-800">
                            {(item.quantity * ((item.price && item.price > 0) ? item.price : 0)).toLocaleString()}円 (税抜)
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="border-t border-slate-200 pt-3 mt-3">
                      <div className="flex justify-between items-center text-lg font-bold">
                        <span className="text-slate-800">合計金額</span>
                        <span className="text-slate-800">
                          {totalAmount.toLocaleString()}円 (税抜)
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between pt-4">
                    <Button 
                      onClick={() => setCartStep('delivery')}
                      variant="outline"
                      className="border-slate-300 text-slate-700 hover:bg-slate-50"
                    >
                      戻る
                    </Button>
                    <Button 
                      onClick={handleConfirmOrder}
                      disabled={isSubmittingOrder}
                      className="bg-teal-600 hover:bg-teal-700 text-white"
                    >
                      {isSubmittingOrder ? '送信中...' : 
                       userInfo?.permissions?.orderApproval?.requiresApproval === true ? 
                       '承認申請を送信' : '注文を確定する'}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}