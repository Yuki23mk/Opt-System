// OptiOil-API/pages/api/admin/legal/upload.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../../lib/prisma'; // 🔧 修正: legal フォルダから4階層上
import { uploadFile } from '../../../../utils/s3'; // 🔧 修正: 相対パス
import { runMiddleware } from '../../../../lib/cors'; // 🔧 修正: 相対パス
import formidable from 'formidable';
import fs from 'fs';
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

// 管理者トークン検証（自前実装）
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

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 統一されたCORS設定を適用
  try {
    await runMiddleware(req, res);
  } catch (error) {
    console.error('CORS error in legal upload API:', error);
    return res.status(403).json({ error: 'CORS error' });
  }

  const adminUser = await verifyAdminToken(req);
  if (!adminUser) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'POST') {
    try {
      const form = formidable({
        maxFileSize: 10 * 1024 * 1024, // 10MB
        keepExtensions: true,
      });

      const [fields, files] = await form.parse(req);
      
      const type = Array.isArray(fields.type) ? fields.type[0] : fields.type;
      const title = Array.isArray(fields.title) ? fields.title[0] : fields.title;
      const version = Array.isArray(fields.version) ? fields.version[0] : fields.version;
      const uploadedFile = Array.isArray(files.file) ? files.file[0] : files.file;

      if (!uploadedFile || !type || !title || !version) {
        return res.status(400).json({ error: '必要な情報が不足しています' });
      }

      // ファイル読み取り
      const fileBuffer = fs.readFileSync(uploadedFile.filepath);
      const originalName = uploadedFile.originalFilename || 'unknown';
      const mimeType = uploadedFile.mimetype || 'application/octet-stream';

      // バージョンの重複チェック
      const existingDoc = await prisma.legalDocument.findFirst({
        where: {
          type: type as string,
          version: version as string
        }
      });

      if (existingDoc) {
        return res.status(400).json({ 
          error: 'このバージョンは既に存在します。別のバージョン番号を使用してください。' 
        });
      }

      // 既存の有効文書を無効化
      await prisma.legalDocument.updateMany({
        where: { type, isActive: true },
        data: { isActive: false }
      });

      let s3Key: string | null = null;
      let s3Url: string | null = null;
      let content: string | null = null;

      // S3にファイルアップロード
      if (process.env.AWS_S3_BUCKET) {
        try {
          const uploadResult = await uploadFile(
            `legal-docs/${type}`,
            originalName,
            fileBuffer,
            mimeType
          );
          s3Key = uploadResult.s3Key;
          s3Url = uploadResult.s3Url;

          // テキストファイルの場合のみ内容をDBにも保存（フォールバック用）
          if (originalName.endsWith('.md') || originalName.endsWith('.txt')) {
            content = fileBuffer.toString('utf-8');
          }
        } catch (s3Error) {
          console.warn('S3 upload failed:', s3Error);
          // S3失敗時はテキストファイルのみDBに保存
          if (originalName.endsWith('.md') || originalName.endsWith('.txt')) {
            content = fileBuffer.toString('utf-8');
          } else {
            throw new Error('S3アップロードに失敗し、バイナリファイルはDBに保存できません');
          }
        }
      } else {
        // S3未設定時はテキストファイルのみ対応
        if (originalName.endsWith('.md') || originalName.endsWith('.txt')) {
          content = fileBuffer.toString('utf-8');
        } else {
          throw new Error('S3が設定されていないため、バイナリファイルはアップロードできません');
        }
      }

      // データベースに保存
      const newDocument = await prisma.legalDocument.create({
        data: {
          type,
          title,
          content,
          s3Key,
          s3Url,
          version,
          isActive: true,
          publishedAt: new Date(),
          createdBy: adminUser.id,
          // ファイル情報を追加
          metadata: {
            originalFileName: originalName,
            fileSize: uploadedFile.size,
            mimeType: mimeType,
            uploadMethod: 'file'
          }
        }
      });

      // 一時ファイル削除
      fs.unlinkSync(uploadedFile.filepath);

      res.status(201).json({
        message: 'ファイルが正常にアップロードされました',
        document: newDocument
      });

    } catch (error) {
      console.error('File upload error:', error);
      res.status(500).json({ 
        error: getErrorMessage(error)
      });
    } finally {
      await prisma.$disconnect();
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}