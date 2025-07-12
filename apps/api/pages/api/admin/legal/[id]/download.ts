// OptiOil-API/pages/api/admin/legal/[id]/download.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../../../lib/prisma'; // 🔧 修正: [id] フォルダから5階層上
import { runMiddleware } from '../../../../../lib/cors'; // 🔧 修正: 5階層上
import { generateDownloadUrl } from '../../../../../utils/s3'; // 🔧 修正: 5階層上
import jwt from 'jsonwebtoken';

interface AdminTokenPayload {
  id: number;
  username: string;
  role: string;
  email: string;
}

// メタデータ型定義
interface DocumentMetadata {
  originalFileName?: string;
  fileSize?: number;
  mimeType?: string;
}

// 管理者トークン検証
async function verifyAdminToken(req: NextApiRequest): Promise<AdminTokenPayload | null> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);
    
    if (token === 'dummy-token') {
      if (process.env.NODE_ENV === 'development') {
        return {
          id: 1,
          username: 'admin',
          role: 'super_admin',
          email: 'admin@example.com'
        };
      }
      return null;
    }

    const jwtSecret = process.env.ADMIN_JWT_SECRET;
    if (!jwtSecret) {
      return null;
    }

    const decoded = jwt.verify(token, jwtSecret) as AdminTokenPayload;
    
    const adminUser = await prisma.adminUser.findFirst({
      where: {
        id: decoded.id,
        status: 'active'
      }
    });

    return adminUser ? decoded : null;
  } catch (error) {
    return null;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await runMiddleware(req, res);
  } catch (error) {
    return res.status(403).json({ error: 'CORS error' });
  }

  const adminUser = await verifyAdminToken(req);
  if (!adminUser) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;
  const documentId = parseInt(id as string);

  if (isNaN(documentId)) {
    return res.status(400).json({ error: 'Invalid document ID' });
  }

  try {
    const document = await prisma.legalDocument.findUnique({
      where: { id: documentId }
    });

    if (!document) {
      return res.status(404).json({ error: '文書が見つかりません' });
    }

    if (!document.s3Key) {
      return res.status(404).json({ error: 'ダウンロード可能なファイルがありません' });
    }

    // 型安全なメタデータアクセス
    const metadata = document.metadata as DocumentMetadata | null;
    const originalFileName = metadata?.originalFileName || 'document.pdf';

    // 署名付きダウンロードURLを生成
    const downloadUrl = generateDownloadUrl(
      document.s3Key,
      originalFileName,
      3600 // 1時間有効
    );

    res.status(200).json({
      downloadUrl
    });
  } catch (error) {
    console.error('Admin download error:', error);
    res.status(500).json({ error: 'ダウンロードURLの取得に失敗しました' });
  } finally {
    await prisma.$disconnect();
  }
}