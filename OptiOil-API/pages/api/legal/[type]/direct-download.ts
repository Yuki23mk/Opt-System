// OptiOil-API/pages/api/legal/[type]/direct-download.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { generateDownloadUrl, extractS3KeyFromUrl } from '@/utils/s3';

const prisma = new PrismaClient();

interface DocumentMetadata {
  originalFileName?: string;
  fileSize?: number;
  mimeType?: string;
  [key: string]: any;
}

function isValidMetadata(metadata: unknown): metadata is DocumentMetadata {
  return metadata !== null && typeof metadata === 'object';
}

function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || '';
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return String(error);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { type } = req.query;

  // HEADメソッドとGETメソッドの両方を許可
  if (req.method === 'GET' || req.method === 'HEAD') {
    try {
      const document = await prisma.legalDocument.findFirst({
        where: {
          type: type as string,
          isActive: true
        },
        orderBy: { publishedAt: 'desc' }
      });

      if (!document) {
        return res.status(404).end();
      }

      // S3キーの取得（s3Keyがない場合はs3Urlから抽出）
      let s3Key = document.s3Key;
      if (!s3Key && document.s3Url) {
        s3Key = extractS3KeyFromUrl(document.s3Url);
      }

      if (!s3Key) {
        console.error('❌ S3 key not found');
        return res.status(404).end();
      }

      let originalFileName = `${type}.pdf`;
      let fileExtension = 'pdf';
      
      if (isValidMetadata(document.metadata)) {
        const metadata = document.metadata as DocumentMetadata;
        if (metadata.originalFileName && typeof metadata.originalFileName === 'string') {
          originalFileName = metadata.originalFileName;
          fileExtension = getFileExtension(originalFileName);
        }
      }

      // プレビューモードの判定
      const isPreview = req.query.preview === 'true';
 
      // PDFファイル以外はプレビューを無効化（強制的にダウンロード）
      const effectiveIsPreview = isPreview && fileExtension === 'pdf';
      
      if (isPreview && fileExtension !== 'pdf') {
        console.log('⚠️ Non-PDF file, forcing download mode');
      }

      const downloadUrl = generateDownloadUrl(
        s3Key,
        originalFileName,
        3600,
        effectiveIsPreview
      );


      // HEADメソッドの場合はヘッダーのみ返す
      if (req.method === 'HEAD') {
        res.status(200).end();
        return;
      }

      // GETメソッドの場合はリダイレクト
      res.redirect(302, downloadUrl);

    } catch (error) {
      console.error('Direct download error:', error);
      
      if (req.method === 'HEAD') {
        res.status(500).end();
        return;
      }
      
      res.status(500).send(`
        <html>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1>エラー</h1>
            <p>ダウンロードに失敗しました。</p>
            <p style="color: #666; font-size: 14px;">${process.env.NODE_ENV === 'development' ? getErrorMessage(error) : ''}</p>
            <button onclick="history.back()">戻る</button>
          </body>
        </html>
      `);
    }
  } else {
    res.setHeader('Allow', ['GET', 'HEAD']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}