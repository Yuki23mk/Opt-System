// OptiOil-API/pages/api/admin/product-documents/index.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import { uploadFile, generateDownloadUrlFromS3Url, deleteFile, extractS3KeyFromUrl } from '../../../../utils/s3';
import { sendEmail, getEmailConfig } from '../../../../utils/email';

const prisma = new PrismaClient();

interface AuthenticatedAdmin {
  id: number;
  username: string;
  role: string;
}

// 🆕 型安全エラーハンドリング関数を追加
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown error occurred';
}

// 🔧 環境変数の型安全な取得
const getRequiredEnvVar = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name}環境変数が設定されていません`);
  }
  return value;
};

// 環境変数
const ADMIN_JWT_SECRET = getRequiredEnvVar('ADMIN_JWT_SECRET');
const JWT_SECRET = getRequiredEnvVar('JWT_SECRET');
const UPLOAD_DIR = path.join(process.cwd(), 'uploads/product-documents');

// 🔧 CORS設定を環境変数ベースに変更
const getAllowedOrigins = (): string[] => {
  const origins = [];
  if (process.env.NEXT_PUBLIC_FRONTEND_URL) {
    origins.push(process.env.NEXT_PUBLIC_FRONTEND_URL);
  }
  if (process.env.NEXT_PUBLIC_ADMIN_URL) {
    origins.push(process.env.NEXT_PUBLIC_ADMIN_URL);
  }
  if (process.env.NEXT_PUBLIC_API_URL) {
    origins.push(process.env.NEXT_PUBLIC_API_URL);
  }
  // フォールバック用のローカル開発環境
  if (origins.length === 0) {
    origins.push('http://localhost:3000', 'http://localhost:3002', 'http://localhost:3001');
  }
  return origins;
};

// アップロードディレクトリ作成
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// 🔧 メール通知関数を修正（email.tsの関数を使用）
const sendDocumentNotification = async (uploadDetails: {
  filenames: string[]; // 複数ファイル対応
  productName: string;
  companyName: string;
  companyId: number;
}) => {
  try {
    const emailEnabled = process.env.EMAIL_ENABLED === 'true';
    
    if (!emailEnabled) {
      console.log('📧 メール送信が無効化されています');
      return;
    }

    // 会社の全ユーザーを取得
    const companyUsers = await prisma.user.findMany({
      where: { companyId: uploadDetails.companyId },
      select: {
        id: true,
        email: true,
        name: true,
        systemRole: true,
      },
    });

    if (!companyUsers || companyUsers.length === 0) {
      console.log('📧 通知対象のユーザーが見つかりません');
      return;
    }

    const config = getEmailConfig();
    
    // 複数ファイル名を整形
    const fileListHtml = uploadDetails.filenames
      .map(filename => `<li>${filename}</li>`)
      .join('');

    // 各ユーザーに個別にメール送信
    for (const user of companyUsers) {
      try {
        const subject = `【${uploadDetails.productName}】新しい資料がアップロードされました`;
        const html = `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <h2 style="color: #14b8a6;">製品資料アップロード通知</h2>
            
            <p><strong>${user.name}</strong> 様<br>
            いつもお世話になっております。<br>
            ${config.companyName}です。</p>
            
            <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #475569;">アップロード詳細</h3>
              <p style="margin: 8px 0;"><strong>商品:</strong> ${uploadDetails.productName}</p>
              <p style="margin: 8px 0;"><strong>アップロードされたファイル:</strong></p>
              <ul style="margin: 8px 0;">
                ${fileListHtml}
              </ul>
              <p style="margin: 8px 0;"><strong>アップロード者:</strong> 管理者</p>
            </div>
            
            <p>資料は「Opt.」システムにてご確認いただけます。<br>
            ご不明な点がございましたらお気軽にお問い合わせください。</p>
            
            <hr style="border: none; height: 1px; background-color: #e2e8f0; margin: 30px 0;">
            <p style="font-size: 0.9em; color: #64748b;">
              有限会社丸一機料商会<br>
              このメールは自動送信されています。
            </p>
          </div>
        `;

        await sendEmail(user.email, subject, html);
        
      } catch (emailError) {
        console.error(`❌ メール送信エラー (${user.email}):`, getErrorMessage(emailError));
        // 個別のエラーは継続処理
      }
    }

  } catch (error) {
    console.error('❌ メール通知エラー:', getErrorMessage(error));
    // エラーでも処理を継続
  }
};

// 認証関数（既存のまま維持）
function verifyToken(req: NextApiRequest): AuthenticatedAdmin {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('認証ヘッダーが無効です');
  }

  const token = authHeader.replace('Bearer ', '');
  
  try {
    // まず管理者トークンで試行
    try {
      const decoded = jwt.verify(token, ADMIN_JWT_SECRET) as any;
      return {
        id: decoded.id,
        username: decoded.username || 'admin',
        role: decoded.role || 'admin',
      };
    } catch (adminError) {
      // 管理者トークンで失敗した場合、通常のJWTトークンで試行
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      return {
        id: decoded.id,
        username: 'admin',
        role: 'admin',
      };
    }
  } catch (jwtError) {
    throw new Error('無効な認証トークンです');
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // CORS設定（既存のまま維持）
    const allowedOrigins = getAllowedOrigins();
    const origin = req.headers.origin;
    
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
      // 環境変数が設定されていない場合のフォールバック
      const corsOrigin = allowedOrigins.length > 0 ? allowedOrigins.join(',') : '*';
      res.setHeader('Access-Control-Allow-Origin', corsOrigin);
    }
    
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, Cache-Control, X-Requested-With');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '86400');

    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

    const admin = verifyToken(req);

    if (req.method === 'GET') {
      // ドキュメント一覧取得
      const { productMasterId, companyId } = req.query;

      const documents = await prisma.productDocument.findMany({
        where: {
          productMasterId: productMasterId ? parseInt(productMasterId as string) : undefined,
          companyId: companyId ? parseInt(companyId as string) : undefined,
        },
        include: {
          productMaster: {
            select: { id: true, code: true, name: true, manufacturer: true }
          },
          company: {
            select: { id: true, name: true }
          },
          uploadedBy: {
            select: { id: true, name: true, status: true }
          },
          uploadedByAdmin: {
            select: { id: true, username: true, status: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      // 🔧 S3 URLからダウンロードURL生成（s3Keyを使わない）
      const formattedDocuments = documents.map(doc => {
        let fileUrl = null;
        
        // S3 URLがある場合はダウンロードURLを生成
        if (doc.s3Url && process.env.USE_S3_STORAGE === 'true') {
          fileUrl = generateDownloadUrlFromS3Url(doc.s3Url, doc.filename, 3600, false);
        }

        return {
          ...doc,
          fileUrl,
          uploadedBy: doc.uploadedByAdmin ? {
            id: doc.uploadedByAdmin.id,
            name: doc.uploadedByAdmin.username,
            isAdmin: true,
            isDeleted: doc.uploadedByAdmin.status === "deleted",
            displayName: doc.uploadedByAdmin.status === "deleted" ? "削除済み管理者" : `${doc.uploadedByAdmin.username} (管理者)`
          } : doc.uploadedBy ? {
            id: doc.uploadedBy.id,
            name: doc.uploadedBy.name,
            isAdmin: false,
            isDeleted: doc.uploadedBy.status === "deleted",
            displayName: doc.uploadedBy.status === "deleted" ? "削除済みアカウント" : doc.uploadedBy.name
          } : null
        };
      });

      res.status(200).json(formattedDocuments);
      return;

    } else if (req.method === 'POST') {
      // 🔧 複数ファイルアップロード対応を修正
      const form = formidable({
        uploadDir: UPLOAD_DIR,
        keepExtensions: true,
        maxFileSize: 10 * 1024 * 1024,
        multiples: true,
      });

      const [fields, files] = await form.parse(req);
      
      // 🔧 ファイル配列の取得を修正
      let fileArray: formidable.File[] = [];
      if (files.file) {
        if (Array.isArray(files.file)) {
          fileArray = files.file;
        } else {
          fileArray = [files.file];
        }
      }
      
      const productMasterId = parseInt(Array.isArray(fields.productMasterId) ? fields.productMasterId[0] : fields.productMasterId || '1');
      const companyId = parseInt(Array.isArray(fields.companyId) ? fields.companyId[0] : fields.companyId || '3');

      if (fileArray.length === 0) {
        res.status(400).json({ error: 'ファイルが選択されていません' });
        return;
      }

      console.log(`📁 アップロードファイル数: ${fileArray.length}`);

      // 商品・会社情報取得
      const [productMaster, company] = await Promise.all([
        prisma.adminProductMaster.findUnique({ where: { id: productMasterId } }),
        prisma.company.findUnique({ where: { id: companyId } })
      ]);

      if (!productMaster || !company) {
        res.status(400).json({ error: '商品または会社が見つかりません' });
        return;
      }

      // 🆕 S3使用フラグ
      const useS3 = process.env.USE_S3_STORAGE === 'true';

      // 🔧 複数ファイルを順次処理（修正版）
      const results = [];
      const uploadedFilenames = [];
      
      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];
        if (!file) {
          console.log(`⚠️ ファイル ${i + 1} はnullです`);
          continue;
        }

        console.log(`📤 ファイル ${i + 1}/${fileArray.length} を処理中: ${file.originalFilename}`);

        let s3Url = null;
        let storedFilename = path.basename(file.filepath);

        // 🆕 S3アップロード処理（s3.tsのuploadFile関数を使用）
        if (useS3) {
          try {
            const fileBuffer = await fs.promises.readFile(file.filepath);
            const uploadResult = await uploadFile(
              'product-docs',
              file.originalFilename || 'unknown',
              fileBuffer,
              file.mimetype || 'application/octet-stream'
            );
            s3Url = uploadResult.s3Url;
            storedFilename = uploadResult.s3Key; // storedFilenameにはs3Keyを保存（互換性のため）
          } catch (s3Error) {
            console.error(`❌ S3アップロードエラー (ファイル ${i + 1}):`, getErrorMessage(s3Error));
            // S3エラーの場合はスキップ
            continue;
          }
        }

        // データベースに保存（s3Keyフィールドは使わない）
        try {
          const document = await prisma.productDocument.create({
            data: {
              productMasterId,
              companyId,
              uploadedByAdminId: admin.id,
              uploadedById: null,
              filename: file.originalFilename || 'unknown',
              storedFilename,
              s3Url,     // 🔧 S3URLのみ保存
              mimeType: file.mimetype || 'application/octet-stream',
              size: file.size,
              category: 'manual',
              isPublic: false,
            }
          });

          results.push(document);
          uploadedFilenames.push(file.originalFilename || 'unknown');

          // 🆕 S3使用時は一時ファイルを削除
          if (useS3 && file.filepath) {
            try {
              await fs.promises.unlink(file.filepath);
            } catch {
              // エラーは無視
            }
          }
        } catch (dbError) {
          console.error(`❌ DB保存エラー (ファイル ${i + 1}):`, getErrorMessage(dbError));
        }
      }

      // 🔧 メール通知（まとめて1回送信）
      if (uploadedFilenames.length > 0) {
        await sendDocumentNotification({
          filenames: uploadedFilenames,
          productName: productMaster.name,
          companyName: company.name,
          companyId
        });
      }

      console.log(`📊 アップロード結果: 成功 ${results.length}/${fileArray.length} ファイル`);

      res.status(201).json({
        message: `${results.length}件のドキュメントがアップロードされました`,
        count: results.length,
        documents: results
      });

    } else if (req.method === 'DELETE') {
      const { id } = req.query;
      
      if (!id || isNaN(Number(id))) {
        return res.status(400).json({ error: '有効なドキュメントIDが必要です' });
      }

      const documentId = Number(id);

      // ドキュメント取得（権限チェック含む）
      const document = await prisma.productDocument.findUnique({
        where: { id: documentId },
        include: {
          productMaster: { select: { name: true, code: true } },
          company: { select: { id: true, name: true } },
          uploadedBy: { select: { id: true, name: true, status: true } },
          uploadedByAdmin: { select: { id: true, username: true, status: true } }
        }
      });

      if (!document) {
        return res.status(404).json({ error: 'ドキュメントが見つかりません' });
      }

      // ユーザーがアップロードしたファイルは削除禁止
      if (document.uploadedById && !document.uploadedByAdminId) {
        return res.status(403).json({ 
          error: 'ユーザーがアップロードしたファイルは管理者からは削除できません',
          uploaderInfo: {
            type: 'user',
            name: document.uploadedBy?.name || '不明なユーザー'
          }
        });
      }

      // 🔧 S3 URLからKeyを抽出して削除
      if (document.s3Url && process.env.USE_S3_STORAGE === 'true') {
        try {
          const s3Key = extractS3KeyFromUrl(document.s3Url);
          if (s3Key) {
            await deleteFile(s3Key);
          }
        } catch (s3Error) {
          console.error('❌ S3削除エラー:', getErrorMessage(s3Error));
          // S3削除エラーでもDB削除は続行
        }
      } else {
        // 既存のファイルシステムからの削除
        try {
          const filePath = path.join(UPLOAD_DIR, document.storedFilename || '');
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`✅ ローカルファイル削除成功: ${filePath}`);
          }
        } catch (fileError) {
          console.error('❌ ファイル削除エラー:', getErrorMessage(fileError));
          // ファイル削除エラーでもDB削除は続行
        }
      }

      // データベースから削除
      await prisma.productDocument.delete({
        where: { id: documentId },
      });

      return res.status(200).json({ 
        message: 'ドキュメントが削除されました',
        success: true 
      });

    } else {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

  } catch (error) {
    const errorMessage = getErrorMessage(error);
    console.error('🚨 APIエラー:', errorMessage);
    
    if (errorMessage.includes('認証')) {
      res.status(401).json({ error: errorMessage });
      return;
    }
    
    res.status(500).json({ 
      error: 'サーバーエラーが発生しました',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined 
    });
    return;
  } finally {
    await prisma.$disconnect();
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
};