// OptiOil-API/pages/api/product-documents/index.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { verifyTokenEnhanced, handleSecurityError } from '../../../utils/authSecurity';
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import { uploadFile } from '../../../utils/s3'; // ✅ S3ユーティリティをインポート

const prisma = new PrismaClient();

interface AuthenticatedUser {
  id: number;
  companyId: number;
  email: string;
}

// 🆕 エラーメッセージ取得用のヘルパー関数
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return String(error);
}

// 🆕 認証エラー判定用の関数
function isAuthError(error: unknown): boolean {
  const message = getErrorMessage(error);
  return message.includes('認証');
}

// ✅ 削除済みユーザー表示用のフォーマット関数（修正版）
const formatUserForDisplay = (uploadedBy: any, uploadedByAdmin: any) => {
  if (uploadedByAdmin) {
    // 管理者がアップロードした場合
    return {
      id: uploadedByAdmin.id,
      name: uploadedByAdmin.username,
      isAdmin: true,
      isDeleted: uploadedByAdmin.status === "deleted",
      displayName: uploadedByAdmin.status === "deleted" ? "削除済み管理者" : `${uploadedByAdmin.username} (管理者)`
    };
  } else if (uploadedBy) {
    // ユーザーがアップロードした場合
    return {
      id: uploadedBy.id,
      name: uploadedBy.name,
      isAdmin: false,
      isDeleted: uploadedBy.status === "deleted",
      displayName: uploadedBy.status === "deleted" ? "削除済みアカウント" : uploadedBy.name
    };
  }
  return null;
};

// 環境変数の取得
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET環境変数が設定されていません');
}
const FRONTEND_URL = process.env.NEXT_PUBLIC_FRONTEND_URL;
    
if (!FRONTEND_URL) {
  throw new Error('NEXT_PUBLIC_FRONTEND_URL環境変数が設定されていません。本番環境では必須です。');
}
const API_URL = process.env.NEXT_PUBLIC_API_URL;
const UPLOAD_DIR = path.join(process.cwd(), 'uploads/product-documents');

// ✅ S3使用フラグ
const USE_S3 = process.env.USE_S3_STORAGE === 'true';
const S3_BUCKET = process.env.AWS_S3_BUCKET;

// S3使用時の設定確認
if (USE_S3) {
  if (!S3_BUCKET) {
    console.error('⚠️ S3ストレージが有効ですが、AWS_S3_BUCKETが設定されていません');
  } else {
    console.log('✅ S3ストレージモード: バケット名 =', S3_BUCKET);
  }
}

// アップロードディレクトリの作成
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  console.log('📁 アップロードディレクトリを作成:', UPLOAD_DIR);
}

function verifyToken(req: NextApiRequest): AuthenticatedUser {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('認証ヘッダーが無効です');
  }

  const token = authHeader.replace('Bearer ', '');
  
  if (!token) {
    throw new Error('認証トークンがありません');
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET!) as any;
    return {
      id: decoded.id || decoded.userId,
      companyId: decoded.companyId,
      email: decoded.email,
    };
  } catch (jwtError) {
    console.error('🚫 JWT検証エラー:', jwtError);
    throw new Error('無効な認証トークンです');
  }
}

// ✅ 修正：型安全なエラーハンドリング関数
function handleError(res: NextApiResponse, error: unknown) {
  console.error('❌ Product Documents API Error:', error);
  
  if (isAuthError(error)) {
    return res.status(401).json({ 
      error: getErrorMessage(error),
      message: getErrorMessage(error) 
    });
  }
  
  res.status(500).json({ 
    error: 'サーバーエラーが発生しました',
    message: 'サーバーエラーが発生しました',
    details: process.env.NODE_ENV === 'development' ? getErrorMessage(error) : undefined
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // 強化されたCORS設定
    res.setHeader('Access-Control-Allow-Origin', FRONTEND_URL!);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, Cache-Control, X-Requested-With');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '86400');

    // プリフライトリクエストの処理
    if (req.method === 'OPTIONS') {
      console.log('🔄 CORS プリフライトリクエスト処理');
      return res.status(200).end();
    }

    console.log('📋 製品関連資料API呼び出し:', { 
      method: req.method, 
      origin: req.headers.origin,
      userAgent: req.headers['user-agent']?.substring(0, 50) 
    });

    const user = verifyTokenEnhanced(req);
    console.log('✅ 認証成功 - ユーザー:', user.id, '会社:', user.companyId);
    
    if (req.method === 'GET') {
      const { productMasterId } = req.query; // ★★★ 変更：productId → productMasterId
      console.log('📋 関連資料取得リクエスト:', {
        productMasterId,
        typeof: typeof productMasterId,
        query: req.query,
        url: req.url
      });
      
      if (!productMasterId || isNaN(Number(productMasterId))) {
        console.log('🚫 無効なproductMasterId:', {
          productMasterId,
          typeof: typeof productMasterId,
          isArray: Array.isArray(productMasterId),
          query: req.query
        });
        return res.status(400).json({ 
          error: '有効な製品マスターIDが必要です',
          message: '有効な製品マスターIDが必要です',
          received: productMasterId,
          typeof: typeof productMasterId
        });
      }

      const productMasterIdNum = Number(productMasterId);
      console.log('📋 変換後のproductMasterIdNum:', productMasterIdNum);

      // AdminProductMasterの存在確認
      console.log('📋 製品マスターの存在確認開始:', productMasterIdNum);
      const productMaster = await prisma.adminProductMaster.findFirst({
        where: {
          id: productMasterIdNum,
          active: true, // アクティブな製品のみ
        },
        include: {
          userTags: {
            where: {
              companyId: user.companyId
            }
          }
        }
      });

      if (!productMaster) {
        console.log('🚫 製品マスターが見つかりません:', {
          searchId: productMasterIdNum,
          companyId: user.companyId
        });
        
        // デバッグ用：存在する製品マスターを確認
        const existingMasters = await prisma.adminProductMaster.findMany({
          where: { active: true },
          select: { id: true, name: true, code: true }
        });
        console.log('📋 存在するアクティブな製品マスター:', existingMasters.map(m => ({ id: m.id, name: m.name })));
        
        return res.status(404).json({ 
          error: '製品が見つかりません',
          message: '製品が見つかりません',
          searchId: productMasterIdNum,
          companyId: user.companyId
        });
      }

      console.log('✅ 製品マスター確認完了:', {
        productMasterId: productMaster.id,
        productName: productMaster.name,
        productCode: productMaster.code,
        active: productMaster.active
      });

      // 製品に関連する資料を取得
      console.log('📋 関連資料検索開始');
      const documents = await prisma.productDocument.findMany({
        where: {
          productMasterId: productMasterIdNum,
          companyId: user.companyId,
        },
        include: {
          uploadedBy: {
            select: {
              id: true,
              name: true,
              status: true  // ✅ 削除済み判定用のstatusを追加
            }
          },
          uploadedByAdmin: { // ★★★ 追加：管理者情報も取得
            select: {
              id: true,
              username: true,
              status: true
            }
          },
          productMaster: {
            select: {
              id: true,
              name: true,
              code: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      console.log('📋 取得した関連資料数:', documents.length);

      // ✅ ファイルURLを付与（ダウンロードAPIを経由）
      const documentsWithUrls = documents.map(doc => ({
        ...doc,
        uploadedBy: formatUserForDisplay(doc.uploadedBy, doc.uploadedByAdmin),
        fileUrl: `${API_URL}/api/product-documents/${doc.id}/download`
      }));

      return res.status(200).json(documentsWithUrls);

    } else if (req.method === 'POST') {
      console.log('📋 製品関連資料アップロード開始');
      
      try {
        // ファイルアップロード処理
        const form = formidable({
          uploadDir: UPLOAD_DIR,
          keepExtensions: true,
          maxFileSize: 10 * 1024 * 1024, // 10MB
          allowEmptyFiles: false,
        });

        console.log('📋 formidable設定完了 - アップロードディレクトリ:', UPLOAD_DIR);

        const [fields, files] = await form.parse(req);
        console.log('📋 フォーム解析完了:', {
          fieldsKeys: Object.keys(fields),
          filesKeys: Object.keys(files)
        });

        const file = Array.isArray(files.file) ? files.file[0] : files.file;
        
        if (!file) {
          console.log('🚫 ファイルが選択されていません');
          return res.status(400).json({ 
            error: 'ファイルが選択されていません',
            message: 'ファイルが選択されていません' 
          });
        }

        const productMasterIdField = fields.productMasterId;
        console.log('📋 受信したproductMasterIdField:', {
          productMasterIdField,
          typeof: typeof productMasterIdField,
          isArray: Array.isArray(productMasterIdField),
          fields: Object.keys(fields)
        });
        
        const productMasterId = productMasterIdField ? 
          parseInt(Array.isArray(productMasterIdField) ? productMasterIdField[0] : productMasterIdField) : 
          null;

        console.log('📋 変換後のproductMasterId:', {
          productMasterId,
          typeof: typeof productMasterId,
          isValid: !isNaN(productMasterId!)
        });

        if (!productMasterId || isNaN(productMasterId)) {
          console.log('🚫 無効な製品マスターID:', {
            original: productMasterIdField,
            converted: productMasterId,
            fields: fields
          });
          return res.status(400).json({ 
            error: '有効な製品マスターIDが必要です',
            message: '有効な製品マスターIDが必要です',
            received: productMasterIdField,
            converted: productMasterId
          });
        }

        console.log('📋 アップロード詳細:', {
          filename: file.originalFilename,
          productMasterId,
          size: file.size,
          mimetype: file.mimetype,
          filepath: file.filepath
        });

        // AdminProductMasterの存在確認
        console.log('📋 アップロード用製品マスター確認開始:', productMasterId);
        const productMaster = await prisma.adminProductMaster.findFirst({
          where: {
            id: productMasterId,
            active: true, // アクティブな製品のみ
          }
        });

        if (!productMaster) {
          console.log('🚫 アップロード用製品マスターが見つかりません:', {
            searchId: productMasterId,
            typeof: typeof productMasterId
          });
          
          // デバッグ用：存在する製品マスターを確認
          const existingMasters = await prisma.adminProductMaster.findMany({
            where: { active: true },
            select: { id: true, name: true, code: true }
          });
          console.log('📋 存在するアクティブな製品マスター:', existingMasters.map(m => ({ id: m.id, name: m.name })));
          
          return res.status(404).json({ 
            error: '指定された製品が見つかりません',
            message: '指定された製品が見つかりません',
            searchId: productMasterId
          });
        }

        console.log('✅ アップロード用製品マスター確認完了:', {
          productMasterId: productMaster.id,
          productName: productMaster.name,
          productCode: productMaster.code,
          active: productMaster.active
        });

        let s3Key: string | null = null;
        let s3Url: string | null = null;
        let storedFilename = path.basename(file.filepath);

        // ✅ S3アップロード処理を追加
        if (USE_S3) {
          try {
            console.log('📤 S3へのアップロード開始...');
            
            // ファイルを読み込み
            const fileBuffer = fs.readFileSync(file.filepath);
            
            // S3にアップロード
            const s3Result = await uploadFile(
              'product-docs', // フォルダ名
              file.originalFilename || 'unknown',
              fileBuffer,
              file.mimetype || 'application/octet-stream'
            );
            
            s3Key = s3Result.s3Key;
            s3Url = s3Result.s3Url;
            
            console.log('✅ S3アップロード成功:', {
              s3Key,
              s3Url,
              originalName: file.originalFilename
            });
            
            // S3アップロード成功後、ローカルファイルを削除
            try {
              fs.unlinkSync(file.filepath);
              console.log('🗑️ ローカル一時ファイル削除完了');
            } catch (deleteError) {
              console.error('⚠️ ローカル一時ファイル削除エラー:', deleteError);
              // エラーでも処理は継続
            }
            
          } catch (s3Error) {
            console.error('❌ S3アップロードエラー:', s3Error);
            // S3アップロードに失敗した場合は、ローカル保存にフォールバック
            console.log('⚠️ ローカル保存にフォールバック');
            s3Key = null;
            s3Url = null;
          }
        }

        // ファイル情報を保存
        console.log('📋 ドキュメント情報をDBに保存開始');
        const newDocument = await prisma.productDocument.create({
          data: {
            filename: file.originalFilename || 'unknown',
            storedFilename: USE_S3 && s3Url ? null : storedFilename, // S3使用時はnull
            s3Url: s3Url || null,           // ✅ S3 URLのみ保存（s3Keyは削除）
            mimeType: file.mimetype || undefined,
            size: file.size,
            productMasterId,
            companyId: user.companyId,
            uploadedById: user.id,
            uploadedByAdminId: null,
          },
          include: {
            uploadedBy: {
              select: {
                id: true,
                name: true,
                status: true
              }
            },
            uploadedByAdmin: {
              select: {
                id: true,
                username: true,
                status: true
              }
            },
            productMaster: {
              select: {
                id: true,
                name: true,
                code: true
              }
            }
          }
        });

        console.log('✅ 関連資料保存成功:', {
          documentId: newDocument.id,
          filename: newDocument.filename,
          productName: newDocument.productMaster.name,
          storageType: USE_S3 && s3Key ? 'S3' : 'ローカル'
        });

        const responseDocument = {
          ...newDocument,
          uploadedBy: formatUserForDisplay(newDocument.uploadedBy, newDocument.uploadedByAdmin),
          fileUrl: `${API_URL}/api/product-documents/${newDocument.id}/download`
        };

        return res.status(201).json({
          message: '関連資料がアップロードされました',
          document: responseDocument
        });

      } catch (uploadError) {
        console.error('❌ ファイルアップロードエラー:', uploadError);
        return res.status(500).json({
          error: 'ファイルのアップロードに失敗しました',
          message: 'ファイルのアップロードに失敗しました',
          details: process.env.NODE_ENV === 'development' ? getErrorMessage(uploadError) : undefined
        });
      }

    } else {
      console.log('🚫 許可されていないメソッド:', req.method);
      res.setHeader('Allow', ['GET', 'POST']);
      return res.status(405).json({ 
        error: `メソッド ${req.method} は許可されていません`,
        message: `メソッド ${req.method} は許可されていません` 
      });
    }

  } catch (error) {
    console.error('❌ 製品関連資料API 予期しないエラー:', error);
    return handleSecurityError(res, error, req);
  } finally {
    await prisma.$disconnect();
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
};