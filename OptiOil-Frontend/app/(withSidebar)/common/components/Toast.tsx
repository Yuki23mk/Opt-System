/**
 * ファイルパス: app/(withSidebar)/common/components/Toast.tsx
 * 改良版トーストコンポーネント（複数対応・アニメーション付き）
 */

import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from "lucide-react";

export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface ToastItem {
  id: string | number;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number; // ms, 0 = 自動消去なし
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastProps {
  toast: ToastItem;
  onClose: (id: string | number) => void;
}

interface ToastContainerProps {
  toasts: ToastItem[];
  onClose: (id: string | number) => void;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center';
}

const toastConfig = {
  info: {
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    textColor: 'text-blue-800',
    titleColor: 'text-blue-900',
    iconColor: 'text-blue-600',
    Icon: Info,
  },
  success: {
    bgColor: 'bg-teal-50',
    borderColor: 'border-teal-200',
    textColor: 'text-teal-800',
    titleColor: 'text-teal-900',
    iconColor: 'text-teal-600',
    Icon: CheckCircle,
  },
  warning: {
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    textColor: 'text-amber-800',
    titleColor: 'text-amber-900',
    iconColor: 'text-amber-600',
    Icon: AlertTriangle,
  },
  error: {
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    textColor: 'text-red-800',
    titleColor: 'text-red-900',
    iconColor: 'text-red-600',
    Icon: AlertCircle,
  },
};

const positionClasses = {
  'top-right': 'top-4 right-4',
  'top-left': 'top-4 left-4',
  'bottom-right': 'bottom-4 right-4',
  'bottom-left': 'bottom-4 left-4',
  'top-center': 'top-4 left-1/2 transform -translate-x-1/2',
};

// 単一トーストコンポーネント
export function Toast({ toast, onClose }: ToastProps) {
  const config = toastConfig[toast.type];
  const Icon = config.Icon;

  return (
    <div className={`
      ${config.bgColor} ${config.borderColor} ${config.textColor}
      border rounded-lg shadow-lg p-4 min-w-80 max-w-md
      animate-in slide-in-from-right-2 duration-300
      data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right-2
    `}>
      <div className="flex items-start gap-3">
        {/* アイコン */}
        <div className={`flex-shrink-0 ${config.iconColor}`}>
          <Icon className="w-5 h-5 mt-0.5" />
        </div>

        {/* コンテンツ */}
        <div className="flex-1 min-w-0">
          {toast.title && (
            <h4 className={`font-semibold mb-1 ${config.titleColor}`}>
              {toast.title}
            </h4>
          )}
          <p className={`text-sm ${config.textColor} break-words whitespace-pre-line`}>
            {toast.message}
          </p>

          {/* アクションボタン */}
          {toast.action && (
            <button
              onClick={toast.action.onClick}
              className={`
                mt-2 text-sm font-medium ${config.titleColor} 
                underline hover:no-underline transition-all
              `}
            >
              {toast.action.label}
            </button>
          )}
        </div>

        {/* 閉じるボタン */}
        <button
          onClick={() => onClose(toast.id)}
          className={`
            flex-shrink-0 ${config.textColor} opacity-70 hover:opacity-100
            transition-opacity p-1 hover:bg-black hover:bg-opacity-10 rounded
          `}
          title="閉じる"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// トーストコンテナ（複数トースト管理）
export function ToastContainer({ 
  toasts, 
  onClose, 
  position = 'top-right' 
}: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className={`
      fixed z-[9999] ${positionClasses[position]}
      flex flex-col gap-2 pointer-events-none
    `}>
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <Toast toast={toast} onClose={onClose} />
        </div>
      ))}
    </div>
  );
}

// 後方互換性のための旧Toast（既存コードが動くように）
interface LegacyToastProps {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
}

export function LegacyToast({ message, type, onClose }: LegacyToastProps) {
  const toastItem: ToastItem = {
    id: 'legacy',
    type: type === 'success' ? 'success' : 'error',
    message,
  };

  return <Toast toast={toastItem} onClose={onClose} />;
}