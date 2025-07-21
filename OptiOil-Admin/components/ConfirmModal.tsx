// OptiOil-Admin/components/ConfirmModal.tsx

'use client';

import React from 'react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  isLoading?: boolean;
  type?: 'danger' | 'warning' | 'info';
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title = '確認',
  message = '実行してもよろしいですか？',
  confirmText = 'OK',
  cancelText = 'キャンセル',
  isLoading = false,
  type = 'warning'
}) => {
  if (!isOpen) return null;

  const getTypeStyles = () => {
    switch (type) {
      case 'danger':
        return {
          titleColor: 'text-red-700',
          confirmButton: 'bg-red-600 hover:bg-red-700 text-white',
          icon: '⚠️'
        };
      case 'warning':
        return {
          titleColor: 'text-amber-700',
          confirmButton: 'bg-amber-600 hover:bg-amber-700 text-white',
          icon: '⚠️'
        };
      case 'info':
        return {
          titleColor: 'text-blue-700',
          confirmButton: 'bg-blue-600 hover:bg-blue-700 text-white',
          icon: 'ℹ️'
        };
      default:
        return {
          titleColor: 'text-amber-700',
          confirmButton: 'bg-amber-600 hover:bg-amber-700 text-white',
          icon: '⚠️'
        };
    }
  };

  const styles = getTypeStyles();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
        <div className="flex items-center mb-4">
          <span className="text-2xl mr-3">{styles.icon}</span>
          <h3 className={`text-lg font-semibold ${styles.titleColor}`}>
            {title}
          </h3>
        </div>
        
        <p className="text-slate-600 mb-6 leading-relaxed">
          {message}
        </p>
        
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 border border-slate-300 rounded-md text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-4 py-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${styles.confirmButton}`}
          >
            {isLoading ? (
              <div className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                処理中...
              </div>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;