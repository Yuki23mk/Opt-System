/**
 * ファイルパス: app/(withSidebar)/common/index.ts
 * 共通コンポーネント・フック一括エクスポート
 */

// コンポーネント
export { Alert } from './components/Alert';
export type { AlertType } from './components/Alert';

export { 
  Toast, 
  ToastContainer, 
  LegacyToast 
} from './components/Toast';
export type { ToastItem, ToastType } from './components/Toast';

export { 
  ConfirmModal, 
  useConfirmModal 
} from './components/ConfirmModal';
export type { ConfirmType, ConfirmModalProps } from './components/ConfirmModal';

// フック
export { useNotification } from './hooks/useNotification';
export type { AlertItem } from './hooks/useNotification';

// 型定義
export type NotificationType = 'info' | 'success' | 'warning' | 'error';