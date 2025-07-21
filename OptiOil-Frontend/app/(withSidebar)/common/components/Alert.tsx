/**
 * ファイルパス: app/(withSidebar)/common/components/Alert.tsx
 * 共通アラートコンポーネント
 */

import { X, AlertCircle, CheckCircle, AlertTriangle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";

export type AlertType = 'info' | 'success' | 'warning' | 'error';

interface AlertAction {
  label: string;
  onClick: () => void;
  variant?: 'default' | 'outline' | 'destructive';
}

interface AlertProps {
  type: AlertType;
  title?: string;
  message: string;
  closable?: boolean;
  actions?: AlertAction[];
  onClose?: () => void;
  className?: string;
}

const alertConfig = {
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

export function Alert({
  type,
  title,
  message,
  closable = false,
  actions = [],
  onClose,
  className = '',
}: AlertProps) {
  const config = alertConfig[type];
  const Icon = config.Icon;

  return (
    <div className={`
      ${config.bgColor} ${config.borderColor} ${config.textColor}
      border rounded-lg p-4 ${className}
    `}>
      <div className="flex items-start gap-3">
        {/* アイコン */}
        <div className={`flex-shrink-0 ${config.iconColor}`}>
          <Icon className="w-5 h-5 mt-0.5" />
        </div>

        {/* コンテンツ */}
        <div className="flex-1 min-w-0">
          {title && (
            <h4 className={`font-semibold mb-1 ${config.titleColor}`}>
              {title}
            </h4>
          )}
          <div className={`text-sm ${config.textColor} break-words`}>
            {typeof message === 'string' ? (
              <p className="whitespace-pre-line">{message}</p>
            ) : (
              message
            )}
          </div>

          {/* アクションボタン */}
          {actions.length > 0 && (
            <div className="flex gap-2 mt-3">
              {actions.map((action, index) => (
                <Button
                  key={index}
                  size="sm"
                  variant={action.variant || 'outline'}
                  onClick={action.onClick}
                  className={`text-xs ${
                    action.variant === 'destructive' 
                      ? '' 
                      : `border-current hover:bg-current hover:text-white`
                  }`}
                >
                  {action.label}
                </Button>
              ))}
            </div>
          )}
        </div>

        {/* 閉じるボタン */}
        {closable && onClose && (
          <button
            onClick={onClose}
            className={`
              flex-shrink-0 ${config.textColor} opacity-70 hover:opacity-100 
              transition-opacity p-1 hover:bg-black hover:bg-opacity-10 rounded
            `}
            title="閉じる"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}