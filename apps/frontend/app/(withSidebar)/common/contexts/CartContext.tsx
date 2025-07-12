"use client";

import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { ENV } from '@/lib/env';

// 型定義
interface CartItem {
  id: number; // Cart.id
  companyProductId: number;
  quantity: number;
  product: {
    id: number; // AdminProductMaster.id
    code: string;
    name: string;
    manufacturer: string;
    capacity: string;
    unit: string;
    oilType: string;
  };
  price?: number;
  enabled?: boolean;
  createdAt: string;
}

interface CartState {
  items: CartItem[];
  totalQuantity: number;
  totalAmount: number;
  isLoading: boolean;
  lastSyncTime: number | null;
}

// アクション型
type CartAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ITEMS'; payload: CartItem[] }
  | { type: 'ADD_ITEM'; payload: CartItem }
  | { type: 'UPDATE_ITEM'; payload: { id: number; quantity: number } }
  | { type: 'REMOVE_ITEM'; payload: number }
  | { type: 'CLEAR_CART' }
  | { type: 'SET_SYNC_TIME'; payload: number };

// 初期状態
const initialState: CartState = {
  items: [],
  totalQuantity: 0,
  totalAmount: 0,
  isLoading: false,
  lastSyncTime: null,
};

// リデューサー
function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };

    case 'SET_ITEMS':
      const items = action.payload;
      return {
        ...state,
        items,
        totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
        totalAmount: items.reduce((sum, item) => sum + (item.quantity * (item.price || 0)), 0),
        isLoading: false,
      };

    case 'ADD_ITEM':
      const newItem = action.payload;
        // ★★★ 安全策：数量が異常に大きい場合は1に制限
        if (newItem.quantity > 100) {
            console.warn('⚠️ 異常な数量を検出:', newItem.quantity, '→ 1に制限');
            newItem.quantity = 1;
        }
      const existingIndex = state.items.findIndex(item => item.companyProductId === newItem.companyProductId);
      
      let updatedItems: CartItem[];
      if (existingIndex !== -1) {
        // 既存アイテムの数量を更新
        updatedItems = state.items.map((item, index) =>
          index === existingIndex
            ? { ...item, quantity: newItem.quantity } // ★★★ 加算ではなく置き換え
            : item
        );
      } else {
        // 新規アイテムを追加
        updatedItems = [...state.items, newItem];
      }

      return {
        ...state,
        items: updatedItems,
        totalQuantity: updatedItems.reduce((sum, item) => sum + item.quantity, 0),
        totalAmount: updatedItems.reduce((sum, item) => sum + (item.quantity * (item.price || 0)), 0),
      };

    case 'UPDATE_ITEM':
      const updatedItemsAfterUpdate = state.items.map(item =>
        item.id === action.payload.id
          ? { ...item, quantity: action.payload.quantity }
          : item
      );
      
      return {
        ...state,
        items: updatedItemsAfterUpdate,
        totalQuantity: updatedItemsAfterUpdate.reduce((sum, item) => sum + item.quantity, 0),
        totalAmount: updatedItemsAfterUpdate.reduce((sum, item) => sum + (item.quantity * (item.price || 0)), 0),
      };

    case 'REMOVE_ITEM':
      const filteredItems = state.items.filter(item => item.id !== action.payload);
      
      return {
        ...state,
        items: filteredItems,
        totalQuantity: filteredItems.reduce((sum, item) => sum + item.quantity, 0),
        totalAmount: filteredItems.reduce((sum, item) => sum + (item.quantity * (item.price || 0)), 0),
      };

    case 'CLEAR_CART':
      return {
        ...state,
        items: [],
        totalQuantity: 0,
        totalAmount: 0,
      };

    case 'SET_SYNC_TIME':
      return {
        ...state,
        lastSyncTime: action.payload,
      };

    default:
      return state;
  }
}

// コンテキスト型
interface CartContextType {
  state: CartState;
  addToCart: (product: any, quantity?: number) => Promise<void>;
  updateQuantity: (cartId: number, quantity: number) => Promise<void>;
  removeFromCart: (cartId: number) => Promise<void>;
  clearCart: () => Promise<void>;
  refreshCart: () => Promise<void>;
  syncWithServer: () => Promise<void>;
}

// コンテキスト作成
const CartContext = createContext<CartContextType | undefined>(undefined);

// プロバイダーコンポーネント
interface CartProviderProps {
  children: ReactNode;
}

export function CartProvider({ children }: CartProviderProps) {
  const [state, dispatch] = useReducer(cartReducer, initialState);
  
  // 環境変数
  const API_URL = ENV.API_URL;

  // APIヘルパー
  const getAuthHeaders = () => {
    const token = localStorage.getItem("token");
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  };

  // サーバーからカートデータを取得
  const refreshCart = async () => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      
      const token = localStorage.getItem("token");
      if (!token) {
        dispatch({ type: 'SET_ITEMS', payload: [] });
        return;
      }

      const response = await fetch(`${API_URL}/api/cart`, {
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        const cartData = await response.json();
        
        // APIレスポンスをCartItem形式に変換
        const cartItems: CartItem[] = cartData.map((item: any) => ({
          id: item.id,
          companyProductId: item.companyProduct.id,
          quantity: item.quantity,
          product: {
            id: item.companyProduct.productMaster.id,
            code: item.companyProduct.productMaster.code,
            name: item.companyProduct.productMaster.name,
            manufacturer: item.companyProduct.productMaster.manufacturer,
            capacity: item.companyProduct.productMaster.capacity,
            unit: item.companyProduct.productMaster.unit,
            oilType: item.companyProduct.productMaster.oilType,
          },
          price: item.companyProduct.price,
          enabled: item.companyProduct.enabled,
          createdAt: item.createdAt,
        }));

        dispatch({ type: 'SET_ITEMS', payload: cartItems });
        dispatch({ type: 'SET_SYNC_TIME', payload: Date.now() });
      } else if (response.status === 401) {
        // 認証エラーの場合はカートをクリア
        dispatch({ type: 'SET_ITEMS', payload: [] });
      } else {
        console.error('カート取得エラー:', response.status);
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    } catch (error) {
      console.error('カート取得エラー:', error);
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  // カートに追加
  const addToCart = async (product: any, quantity: number = 1) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error('認証が必要です');
      }

      // 使用中止チェック
      if (product.enabled === false) {
        throw new Error('使用中止のため注文できません');
      }

      const companyProductId = product.companyProductId || product.id;
      if (!companyProductId) {
        throw new Error('商品情報に問題があります');
      }

    // ★★★ 緊急修正：数量を絶対に1に固定（カートアイコンクリック時）
    const safeQuantity = Math.max(1, Math.min(quantity, 1)); // 最小1、最大1に制限

    console.log('📦 カート追加リクエスト:', {
      companyProductId,
      quantity: safeQuantity,
      productName: product.name
    });

    const response = await fetch(`${API_URL}/api/cart`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        companyProductId,
        quantity: safeQuantity, // ★★★ 必ず1個
      }),
    });

      if (response.ok) {
        // サーバーレスポンスを取得してローカル状態を更新
        const result = await response.json();

        console.log('📦 カート追加レスポンス:', result);

        const newCartItem: CartItem = {
          id: result.data.id,
          companyProductId: result.data.companyProduct.id,
          quantity: result.data.quantity,
          product: {
            id: result.data.companyProduct.productMaster.id,
            code: result.data.companyProduct.productMaster.code,
            name: result.data.companyProduct.productMaster.name,
            manufacturer: result.data.companyProduct.productMaster.manufacturer,
            capacity: result.data.companyProduct.productMaster.capacity,
            unit: result.data.companyProduct.productMaster.unit,
            oilType: result.data.companyProduct.productMaster.oilType,
          },
          price: result.data.companyProduct.price,
          enabled: result.data.companyProduct.enabled,
          createdAt: result.data.createdAt,
        };

      // ★★★ 修正：既存アイテムのチェックを削除（サーバーで管理）
      // 既存アイテムの数量更新ではなく、完全に新しいアイテムとして追加
      const existingItemIndex = state.items.findIndex(item => item.companyProductId === companyProductId);
      
      if (existingItemIndex !== -1) {
        // 既存アイテムを置き換え（数量はサーバーで管理されている）
        const updatedItems = [...state.items];
        updatedItems[existingItemIndex] = newCartItem;
        dispatch({ type: 'SET_ITEMS', payload: updatedItems });
      } else {
        // 新規アイテム追加
        dispatch({ type: 'ADD_ITEM', payload: newCartItem });
      }
      
      dispatch({ type: 'SET_SYNC_TIME', payload: Date.now() });
    } else {
      const errorData = await response.json();
      throw new Error(errorData.message || 'カートへの追加に失敗しました');
    }
  } catch (error: any) {
    console.error('カート追加エラー:', error);
    throw error;
  }
};

  // 数量更新
  const updateQuantity = async (cartId: number, quantity: number) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error('認証が必要です');
      }

      if (quantity < 1) {
        // 数量が1未満の場合は削除
        await removeFromCart(cartId);
        return;
      }

      const response = await fetch(`${API_URL}/api/cart/${cartId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ quantity }),
      });

      if (response.ok) {
        dispatch({ type: 'UPDATE_ITEM', payload: { id: cartId, quantity } });
        dispatch({ type: 'SET_SYNC_TIME', payload: Date.now() });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || '数量の更新に失敗しました');
      }
    } catch (error: any) {
      console.error('数量更新エラー:', error);
      throw error;
    }
  };

  // カートから削除
  const removeFromCart = async (cartId: number) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error('認証が必要です');
      }

      const response = await fetch(`${API_URL}/api/cart/${cartId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        dispatch({ type: 'REMOVE_ITEM', payload: cartId });
        dispatch({ type: 'SET_SYNC_TIME', payload: Date.now() });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || '削除に失敗しました');
      }
    } catch (error: any) {
      console.error('カート削除エラー:', error);
      throw error;
    }
  };

// カートクリア（修正版）
const clearCart = async () => {
  try {
    const token = localStorage.getItem("token");
    if (!token) {
      dispatch({ type: 'CLEAR_CART' });
      return;
    }

    // ★★★ 修正：個別削除でカートクリアを実現
    // clearエンドポイントが存在しない場合のフォールバック
    if (state.items.length === 0) {
      dispatch({ type: 'CLEAR_CART' });
      return;
    }

    // 全アイテムを個別に削除
    const deletePromises = state.items.map(item => 
      fetch(`${API_URL}/api/cart/${item.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      })
    );

    try {
      await Promise.all(deletePromises);
      dispatch({ type: 'CLEAR_CART' });
      dispatch({ type: 'SET_SYNC_TIME', payload: Date.now() });
    } catch (deleteError) {
      console.error('個別削除エラー:', deleteError);
      // エラーでもローカルはクリア
      dispatch({ type: 'CLEAR_CART' });
    }

  } catch (error) {
    console.error('カートクリアエラー:', error);
    // エラーでもローカルはクリア
    dispatch({ type: 'CLEAR_CART' });
  }
};

  // サーバーとの同期
  const syncWithServer = async () => {
    await refreshCart();
  };

  // 初回ログイン時とページリロード時にカートを取得
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      refreshCart();
    }
  }, []);

  // 定期的にサーバーと同期（5分毎）
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    const interval = setInterval(() => {
      const currentTime = Date.now();
      const lastSync = state.lastSyncTime || 0;
      
      // 5分以上経過していたら同期
      if (currentTime - lastSync > 5 * 60 * 1000) {
        syncWithServer();
      }
    }, 60 * 1000); // 1分毎にチェック

    return () => clearInterval(interval);
  }, [state.lastSyncTime]);

  const value: CartContextType = {
    state,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    refreshCart,
    syncWithServer,
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
}

// カスタムフック
export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}