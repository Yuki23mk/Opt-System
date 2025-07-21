/**
 * ファイルパス: app/(withSidebar)/common/hooks/useNotification.ts
 * 統合通知管理フック（トースト + アラート）
 */

import { useState, useCallback, useRef } from 'react';
import { ToastItem, ToastType } from '../components/Toast';

// アラート用の型定義
export interface AlertItem {
  id: string | number;
  type: ToastType;
  title?: string;
  message: string;
  closable?: boolean;
  actions?: Array<{
    label: string;
    onClick: () => void;
    variant?: 'default' | 'outline' | 'destructive';
  }>;
}

interface UseNotificationOptions {
  defaultToastDuration?: number; // デフォルト4秒
  maxToasts?: number; // 最大表示数（デフォルト5個）
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center';
}

interface UseNotificationReturn {
  // トースト関連
  toasts: ToastItem[];
  showToast: (
    message: string, 
    type?: ToastType, 
    options?: {
      title?: string;
      duration?: number;
      action?: { label: string; onClick: () => void };
    }
  ) => void;
  removeToast: (id: string | number) => void;
  clearAllToasts: () => void;
  
  // アラート関連
  alerts: AlertItem[];
  showAlert: (
    message: string, 
    type?: ToastType, 
    options?: {
      title?: string;
      closable?: boolean;
      actions?: AlertItem['actions'];
    }
  ) => void;
  removeAlert: (id: string | number) => void;
  clearAllAlerts: () => void;
  
  // 便利メソッド - トースト
  success: (message: string, options?: { title?: string; duration?: number }) => void;
  error: (message: string, options?: { title?: string; duration?: number }) => void;
  warning: (message: string, options?: { title?: string; duration?: number }) => void;
  info: (message: string, options?: { title?: string; duration?: number }) => void;
  
  // 便利メソッド - アラート
  successAlert: (message: string, options?: { title?: string; closable?: boolean }) => void;
  errorAlert: (message: string, options?: { title?: string; closable?: boolean }) => void;
  warningAlert: (message: string, options?: { title?: string; closable?: boolean }) => void;
  infoAlert: (message: string, options?: { title?: string; closable?: boolean }) => void;
  
  // 確認ダイアログ（アラートベース）
  confirm: (
    message: string,
    onConfirm: () => void,
    options?: {
      title?: string;
      confirmText?: string;
      cancelText?: string;
      type?: 'warning' | 'error';
    }
  ) => void;
  
  // 設定
  position: string;
}

export function useNotification(options: UseNotificationOptions = {}): UseNotificationReturn {
  const {
    defaultToastDuration = 4000,
    maxToasts = 5,
    position = 'top-right'
  } = options;

  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const idCounter = useRef(0);

  // ID生成
  const generateId = useCallback(() => {
    idCounter.current += 1;
    return `notification-${Date.now()}-${idCounter.current}`;
  }, []);

  // トースト表示
  const showToast = useCallback((
    message: string,
    type: ToastType = 'info',
    options: {
      title?: string;
      duration?: number;
      action?: { label: string; onClick: () => void };
    } = {}
  ) => {
    const id = generateId();
    const duration = options.duration ?? defaultToastDuration;
    
    const newToast: ToastItem = {
      id,
      type,
      message,
      title: options.title,
      duration,
      action: options.action,
    };

    setToasts(prev => {
      const updated = [newToast, ...prev];
      // 最大数を超えた場合は古いものを削除
      return updated.slice(0, maxToasts);
    });

    // 自動削除（duration > 0の場合）
    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [generateId, defaultToastDuration, maxToasts]);

  // トースト削除
  const removeToast = useCallback((id: string | number) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  // 全トースト削除
  const clearAllToasts = useCallback(() => {
    setToasts([]);
  }, []);

  // アラート表示
  const showAlert = useCallback((
    message: string,
    type: ToastType = 'info',
    options: {
      title?: string;
      closable?: boolean;
      actions?: AlertItem['actions'];
    } = {}
  ) => {
    const id = generateId();
    
    const newAlert: AlertItem = {
      id,
      type,
      message,
      title: options.title,
      closable: options.closable ?? true,
      actions: options.actions,
    };

    setAlerts(prev => [newAlert, ...prev]);
  }, [generateId]);

  // アラート削除
  const removeAlert = useCallback((id: string | number) => {
    setAlerts(prev => prev.filter(alert => alert.id !== id));
  }, []);

  // 全アラート削除
  const clearAllAlerts = useCallback(() => {
    setAlerts([]);
  }, []);

  // 便利メソッド - トースト
  const success = useCallback((message: string, options?: { title?: string; duration?: number }) => 
    showToast(message, 'success', options), [showToast]);
  
  const error = useCallback((message: string, options?: { title?: string; duration?: number }) => 
    showToast(message, 'error', options), [showToast]);
  
  const warning = useCallback((message: string, options?: { title?: string; duration?: number }) => 
    showToast(message, 'warning', options), [showToast]);
  
  const info = useCallback((message: string, options?: { title?: string; duration?: number }) => 
    showToast(message, 'info', options), [showToast]);

  // 便利メソッド - アラート
  const successAlert = useCallback((message: string, options?: { title?: string; closable?: boolean }) => 
    showAlert(message, 'success', options), [showAlert]);
  
  const errorAlert = useCallback((message: string, options?: { title?: string; closable?: boolean }) => 
    showAlert(message, 'error', options), [showAlert]);
  
  const warningAlert = useCallback((message: string, options?: { title?: string; closable?: boolean }) => 
    showAlert(message, 'warning', options), [showAlert]);
  
  const infoAlert = useCallback((message: string, options?: { title?: string; closable?: boolean }) => 
    showAlert(message, 'info', options), [showAlert]);

  // 確認ダイアログ
  const confirm = useCallback((
    message: string,
    onConfirm: () => void,
    options: {
      title?: string;
      confirmText?: string;
      cancelText?: string;
      type?: 'warning' | 'error';
    } = {}
  ) => {
    const {
      title = '確認',
      confirmText = '実行',
      cancelText = 'キャンセル',
      type = 'warning'
    } = options;

    const alertId = generateId();

    showAlert(message, type, {
      title,
      closable: false,
      actions: [
        {
          label: cancelText,
          onClick: () => removeAlert(alertId),
          variant: 'outline',
        },
        {
          label: confirmText,
          onClick: () => {
            onConfirm();
            removeAlert(alertId);
          },
          variant: type === 'error' ? 'destructive' : 'default',
        },
      ],
    });
  }, [showAlert, removeAlert, generateId]);

  return {
    // State
    toasts,
    alerts,
    position,
    
    // トースト操作
    showToast,
    removeToast,
    clearAllToasts,
    
    // アラート操作
    showAlert,
    removeAlert,
    clearAllAlerts,
    
    // 便利メソッド
    success,
    error,
    warning,
    info,
    successAlert,
    errorAlert,
    warningAlert,
    infoAlert,
    confirm,
  };
}