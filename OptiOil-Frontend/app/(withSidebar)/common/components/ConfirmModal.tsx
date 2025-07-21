/**
 * ファイルパス: app/(withSidebar)/common/components/ConfirmModal.tsx
 * 確認モーダル共有コンポーネント（グローバル対応版 + ×ボタン重複修正）
 */

import React, { createContext, useContext, useState, ReactNode } from "react";
import { AlertTriangle, AlertCircle, Info, HelpCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export type ConfirmType = 'warning' | 'danger' | 'info' | 'question';

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: ConfirmType;
  loading?: boolean;
  // ✅ 外側クリック・ESCキーの制御
  preventClose?: boolean;
}

// 🎯 グローバルな確認モーダルの状態管理
interface ConfirmModalState {
  isOpen: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: ConfirmType;
  onConfirm?: () => void | Promise<void>;
  loading?: boolean;
  preventClose?: boolean;
}

interface ConfirmModalContextType {
  openConfirm: (options: {
    title?: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    type?: ConfirmType;
    onConfirm: () => void | Promise<void>;
    preventClose?: boolean;
  }) => void;
  closeConfirm: () => void;
  setLoading: (loading: boolean) => void;
  modalState: ConfirmModalState;
}

const ConfirmModalContext = createContext<ConfirmModalContextType | null>(null);

const typeConfig = {
  warning: {
    icon: AlertTriangle,
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    iconColor: 'text-amber-600',
    titleColor: 'text-amber-900',
    textColor: 'text-amber-800',
    confirmButtonColor: 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500',
  },
  danger: {
    icon: AlertCircle,
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    iconColor: 'text-red-600',
    titleColor: 'text-red-900',
    textColor: 'text-red-800',
    confirmButtonColor: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
  },
  info: {
    icon: Info,
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    iconColor: 'text-blue-600',
    titleColor: 'text-blue-900',
    textColor: 'text-blue-800',
    confirmButtonColor: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
  },
  question: {
    icon: HelpCircle,
    bgColor: 'bg-slate-50',
    borderColor: 'border-slate-200',
    iconColor: 'text-slate-600',
    titleColor: 'text-slate-900',
    textColor: 'text-slate-800',
    confirmButtonColor: 'bg-slate-600 hover:bg-slate-700 focus:ring-slate-500',
  },
};

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = '確認',
  cancelText = 'キャンセル',
  type = 'question',
  loading = false,
  preventClose = false,
}: ConfirmModalProps) {
  const config = typeConfig[type];
  const Icon = config.icon;

  const handleConfirm = async () => {
    try {
      await onConfirm();
    } catch (error) {
      console.error('Confirm action failed:', error);
    }
  };

  const handleClose = () => {
    if (!loading && !preventClose) {
      onClose();
    }
  };

  return (
    <Dialog 
      open={isOpen} 
      onOpenChange={(open) => {
        // ✅ preventClose が有効な場合は外側クリックを無視
        if (preventClose && !open) {
          return;
        }
        if (!loading) {
          onClose();
        }
      }}
    >
      <DialogContent 
        className="max-w-md border border-slate-200 rounded-lg p-0 overflow-hidden"
        // ✅ preventClose が有効な場合は外側クリック・ESCキーを無効化
        onInteractOutside={preventClose ? (e) => e.preventDefault() : undefined}
        onEscapeKeyDown={preventClose ? (e) => e.preventDefault() : undefined}
      >
        <div className={`${config.bgColor} ${config.borderColor} border-b px-6 py-4`}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className={`${config.iconColor} flex-shrink-0`}>
                <Icon className="w-6 h-6" />
              </div>
              <span className={`${config.titleColor} text-lg font-semibold`}>
                {title || '確認'}
              </span>
            </DialogTitle>
          </DialogHeader>
        </div>

        <div className="px-6 py-5">
          <div className={`${config.textColor} leading-relaxed whitespace-pre-line`}>
            {message}
          </div>
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200">
          <div className="flex gap-3 justify-end">
            <Button
              
              onClick={handleClose}
              disabled={loading}
              className="border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {cancelText}
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={loading}
              className={`
                ${config.confirmButtonColor} text-white border-0
                disabled:opacity-50 disabled:cursor-not-allowed
                focus:ring-2 focus:ring-offset-2
                ${loading ? 'cursor-wait' : ''}
              `}
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="animate-spin h-4 w-4" />
                  <span>処理中...</span>
                </div>
              ) : (
                confirmText
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// 🎯 グローバルプロバイダー
export function ConfirmModalProvider({ children }: { children: ReactNode }) {
  const [modalState, setModalState] = useState<ConfirmModalState>({
    isOpen: false,
    message: '',
    loading: false,
    preventClose: false,
  });

  const openConfirm = (options: {
    title?: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    type?: ConfirmType;
    onConfirm: () => void | Promise<void>;
    preventClose?: boolean;
  }) => {
    setModalState({
      isOpen: true,
      loading: false,
      preventClose: false,    // デフォルト値
      ...options,
    });
  };

  const closeConfirm = () => {
    if (!modalState.loading && !modalState.preventClose) {
      setModalState(prev => ({ ...prev, isOpen: false, loading: false }));
    }
  };

  const setLoading = (loading: boolean) => {
    setModalState(prev => ({ ...prev, loading }));
  };

  const handleConfirm = async () => {
    if (!modalState.onConfirm) return;

    setLoading(true);
    
    try {
      await modalState.onConfirm();
      setModalState(prev => ({ ...prev, isOpen: false, loading: false }));
    } catch (error) {
      console.error('Confirm action failed:', error);
      setLoading(false);
      throw error;
    }
  };

  return (
    <ConfirmModalContext.Provider value={{
      openConfirm,
      closeConfirm,
      setLoading,
      modalState
    }}>
      {children}
      
      {/* 🎯 グローバルに1つだけ存在するモーダル */}
      <ConfirmModal
        isOpen={modalState.isOpen}
        onClose={closeConfirm}
        onConfirm={handleConfirm}
        title={modalState.title}
        message={modalState.message}
        confirmText={modalState.confirmText}
        cancelText={modalState.cancelText}
        type={modalState.type}
        loading={modalState.loading}
        preventClose={modalState.preventClose}
      />
    </ConfirmModalContext.Provider>
  );
}

// 🎯 簡単に使えるフック
export function useConfirmModal() {
  const context = useContext(ConfirmModalContext);
  
  if (!context) {
    throw new Error('useConfirmModal must be used within ConfirmModalProvider');
  }

  return {
    openConfirm: context.openConfirm,
    closeConfirm: context.closeConfirm,
    setLoading: context.setLoading,
    isOpen: context.modalState.isOpen,
    isLoading: context.modalState.loading,
  };
}