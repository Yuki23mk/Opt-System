// OptiOil-Frontend/app/legal/[type]/page.tsx - UI調整版
"use client";

import { useEffect, useState } from 'react';
import { Download, FileText, ArrowLeft, Calendar, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { use } from 'react';

interface LegalDocument {
  id: number;
  title: string;
  version: string;
  publishedAt: string;
  metadata?: {
    originalFileName: string;
    fileSize: number;
    mimeType: string;
  };
}

export default function LegalDocumentPage({ params }: { params: Promise<{ type: string }> }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const [document, setDocument] = useState<LegalDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const fetchDocument = async () => {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_API_URL;
        const res = await fetch(`${baseUrl}/api/legal/${resolvedParams.type}`);
        
        if (res.ok) {
          const data = await res.json();
          setDocument(data);
        } else {
          if (res.status === 404) {
            setError('文書が見つかりませんでした。まだアップロードされていない可能性があります。');
          } else {
            setError('文書の読み込みに失敗しました');
          }
        }
      } catch (error) {
        console.error('Fetch error:', error);
        setError('サーバーとの通信に失敗しました。しばらく待ってから再度お試しください。');
      } finally {
        setLoading(false);
      }
    };

    fetchDocument();
  }, [resolvedParams.type]);

  const handleDownload = async () => {
    if (!document) return;
    
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL;
      const downloadUrl = `${baseUrl}/api/legal/${resolvedParams.type}/direct-download`;
      
      // 直接window.openでダウンロード（HEADリクエストを避ける）
      window.open(downloadUrl, '_blank');
      
    } catch (error) {
      console.error('Download error:', error);
      setError('ダウンロード処理でエラーが発生しました。');
    }
  };

  const getTitle = (type: string) => {
    switch (type) {
      case 'terms': return '利用規約';
      case 'privacy': return 'プライバシーポリシー';
      case 'beta-terms': return 'ベータ版利用規約';
      default: return '文書';
    }
  };

  const getFileTypeColor = (fileName: string) => {
    const extension = fileName?.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'pdf': return 'bg-red-100 text-red-800';
      case 'docx': return 'bg-blue-100 text-blue-800';
      case 'md': return 'bg-green-100 text-green-800';
      case 'txt': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-600"></div>
          <span className="text-gray-600">読み込み中...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">エラー</h1>
          <p className="text-gray-600 mb-6 text-sm leading-relaxed">{error}</p>
          
          <Button 
            onClick={() => router.push('/login')}
            className="w-full"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            ログイン画面に戻る
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-lg w-full">
        {/* ヘッダー */}
        <div className="text-center mb-6">
          <div className="w-20 h-20 bg-gradient-to-br from-teal-100 to-teal-50 rounded-full flex items-center justify-center mx-auto mb-4 shadow-md">
            <FileText className="w-10 h-10 text-teal-600" />
          </div>
          
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {getTitle(resolvedParams.type)}
          </h1>
          
          {document && (
            <div className="flex items-center justify-center gap-4 text-sm text-gray-600">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-teal-500 rounded-full"></span>
                バージョン {document.version}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {new Date(document.publishedAt).toLocaleDateString('ja-JP')}
              </span>
            </div>
          )}
        </div>

        {/* ファイル情報（幅を狭めて、ファイル名を削除） */}
        {document?.metadata && (
          <div className="bg-gray-50 rounded-lg p-4 mb-6 mx-auto max-w-xs">
            <h3 className="font-semibold text-gray-800 mb-3 text-center">ファイル情報</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">形式</span>
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                  getFileTypeColor(document.metadata.originalFileName)
                }`}>
                  {document.metadata.originalFileName.split('.').pop()?.toUpperCase()}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">サイズ</span>
                <span className="text-sm font-medium text-gray-900">
                  {formatFileSize(document.metadata.fileSize)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ダウンロードボタン */}
        <div className="space-y-4">
          <Button 
            onClick={handleDownload}
            className="w-full bg-teal-600 hover:bg-teal-700 text-white shadow-md hover:shadow-lg transition-all duration-200"
            size="lg"
            disabled={!document}
          >
            <Download className="w-5 h-5 mr-2" />
            ファイルをダウンロード
          </Button>
          
          <Button 
            onClick={() => router.push('/login')}
            variant="outline"
            className="w-full"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            ログイン画面に戻る
          </Button>
        </div>

        {/* 注意書き */}
        <div className="mt-6 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-xs text-blue-800 text-center">
            <strong>ご注意:</strong> ファイルをダウンロードしてご確認ください。<br />
            ブラウザによってはファイルが直接開かれる場合があります。
          </p>
        </div>
      </div>
    </div>
  );
}