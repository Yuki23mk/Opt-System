//プレビュー機能の共有コンポーネント化（カスタムフック化）　設備情報と製品情報、利用規約とプライバシーポリシーで利用予定
//OptiOil-Frontend/app/(withSidebar)/common/hooks/useDocumentPreview.ts

import { useState } from 'react';
import { useNotification } from './useNotification';

interface PreviewOptions {
  onError?: (error: Error) => void;
  onSuccess?: () => void;
}

// ドキュメントプレビュー用のカスタムフック
// このフックは、ドキュメントのプレビューとダウンロード機能
export const useDocumentPreview = () => {
  const [isLoading, setIsLoading] = useState(false);
  const notification = useNotification();

  const previewDocument = async (
    fileUrl: string,
    options?: PreviewOptions
  ) => {
    try {
      setIsLoading(true);
      
      const token = localStorage.getItem('token');
      if (!token) {
        const error = new Error('認証トークンが見つかりません');
        notification.errorAlert(error.message, {
          title: '認証エラー'
        });
        options?.onError?.(error);
        return;
      }

      // APIからJSONレスポンスを取得
      const response = await fetch(
        `${fileUrl}?preview=true&token=${encodeURIComponent(token)}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('プレビューの取得に失敗しました');
      }

      const data = await response.json();
      
      // 取得したURLを別タブで開く
      if (data.url) {
        window.open(data.url, '_blank');
        options?.onSuccess?.();
      } else {
        throw new Error('プレビューURLが取得できませんでした');
      }
    } catch (error) {
      console.error('プレビューエラー:', error);
      const errorMessage = error instanceof Error ? error.message : 'ファイルのプレビューに失敗しました';
      notification.errorAlert(errorMessage, {
        title: 'プレビューエラー'
      });
      options?.onError?.(error as Error);
    } finally {
      setIsLoading(false);
    }
  };

    // ダウンロード機能
  const downloadDocument = async (
    fileUrl: string,
    fileName?: string,
    options?: PreviewOptions
  ) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        const error = new Error('認証トークンが見つかりません');
        notification.errorAlert(error.message, {
          title: '認証エラー'
        });
        options?.onError?.(error);
        return;
      }

      // ダウンロード用URLにトークンを含める
      const downloadUrl = `${fileUrl}?token=${encodeURIComponent(token)}`;
      
      // 新しいタブで開く（自動的にダウンロードされる）
      window.open(downloadUrl, '_blank');
      
      options?.onSuccess?.();
    } catch (error) {
      console.error('ダウンロードエラー:', error);
      const errorMessage = error instanceof Error ? error.message : 'ファイルのダウンロードに失敗しました';
      notification.errorAlert(errorMessage, {
        title: 'ダウンロードエラー'
      });
      options?.onError?.(error as Error);
    }
  };

  return {
    previewDocument,
    downloadDocument,
    isLoading,
  };
};