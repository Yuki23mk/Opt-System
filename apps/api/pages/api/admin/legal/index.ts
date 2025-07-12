// OptiOil-API/pages/api/admin/legal/index.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../../lib/prisma'; // 🔧 修正: legal フォルダから4階層上
import { uploadLegalDocument } from '../../../../utils/s3'; // 🔧 修正: 相対パス
import { runMiddleware } from '../../../../lib/cors'; // 🔧 修正: 相対パス
import jwt from 'jsonwebtoken';

interface AdminTokenPayload {
  id: number;
  username: string;
  role: string;
  email: string;
}

// エラーメッセージを安全に取得するヘルパー関数
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown error occurred';
}

// 管理者トークン検証
async function verifyAdminToken(req: NextApiRequest): Promise<AdminTokenPayload | null> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);
    
    // ダミートークンの場合（開発用）
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
      console.error('ADMIN_JWT_SECRET not configured');
      return null;
    }

    const decoded = jwt.verify(token, jwtSecret) as AdminTokenPayload;
    
    const adminUser = await prisma.adminUser.findFirst({
      where: {
        id: decoded.id,
        status: 'active'
      }
    });

    if (!adminUser) {
      return null;
    }

    return decoded;
  } catch (error) {
    console.error('Admin token verification error:', error);
    return null;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // CORS設定を適用
  try {
    await runMiddleware(req, res);
  } catch (error) {
    console.error('CORS error in legal index API:', error);
    return res.status(403).json({ error: 'CORS error' });
  }

  const adminUser = await verifyAdminToken(req);
  if (!adminUser) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // GET メソッドの処理
  if (req.method === 'GET') {
    try {
      // 法的文書の一覧を取得
      const documents = await prisma.legalDocument.findMany({
        orderBy: { publishedAt: 'desc' },
        include: {
          creator: {
            select: {
              id: true,
              username: true
            }
          }
        }
      });

      res.status(200).json(documents);
    } catch (error) {
      console.error('Legal documents fetch error:', error);
      res.status(500).json({ 
        error: '文書の取得に失敗しました',
        details: process.env.NODE_ENV === 'development' ? getErrorMessage(error) : undefined
      });
    } finally {
      await prisma.$disconnect();
    }
  }
  // POST メソッドの処理（既存）
  else if (req.method === 'POST') {
    const { type, title, content, version } = req.body;

    try {
      // 既存の有効文書を無効化
      await prisma.legalDocument.updateMany({
        where: { type, isActive: true },
        data: { isActive: false }
      });

      let s3Key: string | null = null;
      let s3Url: string | null = null;

      // S3にアップロード（設定がある場合）
      if (process.env.AWS_S3_BUCKET) {
        try {
          const uploadResult = await uploadLegalDocument(type, version, content);
          s3Key = uploadResult.s3Key;
          s3Url = uploadResult.s3Url;
        } catch (s3Error) {
          console.warn('S3 upload failed, using database fallback:', s3Error);
        }
      }

      // データベースに保存
      const newDocument = await prisma.legalDocument.create({
        data: {
          type,
          title,
          content: s3Key ? null : content, // S3にある場合はDBに保存しない
          s3Key,
          s3Url,
          version,
          isActive: true,
          publishedAt: new Date(),
          createdBy: adminUser.id
        }
      });

      res.status(201).json(newDocument);
    } catch (error) {
      console.error('Document creation error:', error);
      res.status(500).json({ 
        error: '文書の作成に失敗しました',
        details: process.env.NODE_ENV === 'development' ? getErrorMessage(error) : undefined
      });
    } finally {
      await prisma.$disconnect();
    }
  } 
  else {
    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).json({ error: 'Method not allowed' });
  }
}