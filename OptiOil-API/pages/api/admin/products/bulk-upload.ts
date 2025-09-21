/**
 * ファイルパス: OptiOil-API/pages/api/admin/products/bulk-upload.ts
 * 管理者用 - 商品マスターCSV一括アップロードAPI（荷姿項目対応版）
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { verifyTokenEnhanced, handleSecurityError } from '../../../../utils/authSecurity';
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
// 🔧 csv-parser の正しいインポート方法（型定義削除）
const csv = require('csv-parser');

const prisma = new PrismaClient();

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
  return origins;
};

// 環境変数の取得
const ADMIN_JWT_SECRET = getRequiredEnvVar('ADMIN_JWT_SECRET');
    
function verifyAdminToken(req: NextApiRequest) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('管理者認証ヘッダーが無効です');
  }

  const token = authHeader.replace('Bearer ', '');
  
  if (!token) {
    throw new Error('管理者認証トークンがありません');
  }

  try {
    const decoded = jwt.verify(token, ADMIN_JWT_SECRET) as any;
    
    if (!decoded.isAdmin || !['admin', 'super_admin'].includes(decoded.role)) {
      throw new Error('管理者権限が不足しています');
    }
    
    return decoded;
  } catch (jwtError) {
    console.error('🚫 管理者JWT検証エラー:', getErrorMessage(jwtError));
    throw new Error('無効な管理者トークンです');
  }
}

// CSVデータの型定義（荷姿項目追加）
interface CsvProductData {
  code: string;
  name: string;
  manufacturer: string;
  capacity: string;
  unit: string;
  oilType: string;
  packageType?: string; // 🆕 荷姿項目追加（任意）
}

// バリデーション関数
function validateProductData(data: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!data.code || typeof data.code !== 'string' || data.code.trim() === '') {
    errors.push('商品コードは必須です');
  }
  
  if (!data.name || typeof data.name !== 'string' || data.name.trim() === '') {
    errors.push('商品名は必須です');
  }
  
  if (!data.manufacturer || typeof data.manufacturer !== 'string' || data.manufacturer.trim() === '') {
    errors.push('メーカーは必須です');
  }
  
  if (!data.capacity || typeof data.capacity !== 'string' || data.capacity.trim() === '') {
    errors.push('容量は必須です');
  }
  
  if (!data.unit || typeof data.unit !== 'string' || data.unit.trim() === '') {
    errors.push('単位は必須です');
  }
  
  if (!data.oilType || typeof data.oilType !== 'string' || data.oilType.trim() === '') {
    errors.push('油種は必須です');
  }
  
  // 🆕 荷姿は任意項目なのでバリデーションしない
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// CSVファイルを解析する関数
function parseCSVFile(filePath: string): Promise<CsvProductData[]> {
  return new Promise((resolve, reject) => {
    const results: CsvProductData[] = [];
    
    // ファイルの存在確認
    if (!fs.existsSync(filePath)) {
      reject(new Error(`ファイルが見つかりません: ${filePath}`));
      return;
    }
       
    fs.createReadStream(filePath, { encoding: 'utf8' })
      .pipe(csv())
      .on('data', (data: any) => {
        // カラム名を正規化（空白を削除）
        const normalizedData: any = {};
        Object.keys(data).forEach(key => {
          const normalizedKey = key.trim().toLowerCase();
          normalizedData[normalizedKey] = data[key] ? data[key].toString().trim() : '';
        });
        
        // マッピング（柔軟な列名対応）
        const mappedData = {
          code: normalizedData.code || normalizedData['商品コード'] || '',
          name: normalizedData.name || normalizedData['商品名'] || '',
          manufacturer: normalizedData.manufacturer || normalizedData['メーカー'] || '',
          capacity: normalizedData.capacity || normalizedData['容量'] || '',
          unit: normalizedData.unit || normalizedData['単位'] || '',
          oilType: normalizedData.oiltype || normalizedData.oil_type || normalizedData['油種'] || '',
          // 🆕 荷姿項目のマッピング追加
          packageType: normalizedData.packagetype || normalizedData.package_type || normalizedData['荷姿'] || normalizedData['包装'] || '',
        };
        
        results.push(mappedData);
      })
      .on('end', () => {
        console.log(`✅ CSV解析完了: ${results.length}行`);
        resolve(results);
      })
      .on('error', (error: any) => {
        console.error('❌ CSV解析エラー:', getErrorMessage(error));
        reject(error);
      });
  });
}

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  let tempFilePath: string | null = null;
  
  try {
    // 🔧 CORS設定（環境変数ベース）
    const allowedOrigins = getAllowedOrigins();
    const origin = req.headers.origin;
    
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
      const corsOrigin = allowedOrigins.length > 0 ? allowedOrigins.join(',') : '*';
      res.setHeader('Access-Control-Allow-Origin', corsOrigin);
    }
    
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST']);
      return res.status(405).json({ 
        error: `メソッド ${req.method} は許可されていません`
      });
    }

    const admin = verifyAdminToken(req);

    // アップロードディレクトリを確保
    const uploadDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // formidableでファイルを解析
    const form = formidable({
      uploadDir: uploadDir,
      keepExtensions: true,
      maxFileSize: 10 * 1024 * 1024, // 10MB
    });

    const [fields, files] = await form.parse(req);
    const file = Array.isArray(files.file) ? files.file[0] : files.file;

    if (!file) {
      return res.status(400).json({ error: 'ファイルがアップロードされていません' });
    }

    tempFilePath = file.filepath;

    // CSVファイルかチェック
    if (file.mimetype !== 'text/csv' && !file.originalFilename?.endsWith('.csv')) {
      return res.status(400).json({ error: 'CSVファイルをアップロードしてください' });
    }

    // CSVファイルを解析
    const csvData = await parseCSVFile(tempFilePath);
    
    if (csvData.length === 0) {
      return res.status(400).json({ error: 'CSVファイルにデータが含まれていません' });
    }

    let successCount = 0;
    let errorCount = 0;
    const errors: Array<{ row: number; errors: string[] }> = [];

    // 各行を処理
    for (let i = 0; i < csvData.length; i++) {
      const rowData = csvData[i];
      const rowNumber = i + 2; // ヘッダー行を考慮

      try {
        // 空行をスキップ
        if (!rowData.code && !rowData.name && !rowData.manufacturer) {
          continue;
        }

        // バリデーション
        const validation = validateProductData(rowData);
        if (!validation.isValid) {
          errors.push({ row: rowNumber, errors: validation.errors });
          errorCount++;
          continue;
        }

        // 重複チェック
        const existingProduct = await prisma.adminProductMaster.findUnique({
          where: { code: rowData.code.trim() }
        });

        if (existingProduct) {
          errors.push({ 
            row: rowNumber, 
            errors: [`商品コード "${rowData.code}" は既に存在します`] 
          });
          errorCount++;
          continue;
        }

        // 🆕 荷姿の処理（空文字列の場合はnullに変換）
        const packageType = rowData.packageType && rowData.packageType.trim() !== '' 
          ? rowData.packageType.trim() 
          : null;

        // 商品を作成
        await prisma.adminProductMaster.create({
          data: {
            code: rowData.code.trim(),
            name: rowData.name.trim(),
            manufacturer: rowData.manufacturer.trim(),
            capacity: rowData.capacity.trim(),
            unit: rowData.unit.trim(),
            oilType: rowData.oilType.trim(),
            packageType: packageType, // 🆕 荷姿フィールド追加
            active: true,
          }
        });

        successCount++;

      } catch (error) {
        console.error(`❌ 行 ${rowNumber} の処理エラー:`, getErrorMessage(error));
        errors.push({ 
          row: rowNumber, 
          errors: [`データベースエラー: ${getErrorMessage(error)}`] 
        });
        errorCount++;
      }
    }

    // 操作ログを記録
    try {
      await prisma.adminOperationLog.create({
        data: {
          adminId: admin.id,
          action: 'BULK_UPLOAD_PRODUCTS',
          targetType: 'AdminProductMaster',
          details: `CSV一括アップロード: 成功${successCount}件, エラー${errorCount}件`
        }
      });
    } catch (logError) {
      console.error('⚠️ 操作ログ記録エラー:', getErrorMessage(logError));
    }

    return res.status(200).json({
      message: 'CSV一括アップロードが完了しました',
      successCount,
      errorCount,
      errors: errorCount > 0 ? errors.slice(0, 10) : undefined // 最初の10件のエラーのみ表示
    });

  } catch (error) {
    console.error('❌ CSV一括アップロードAPI エラー:', getErrorMessage(error));
    
    const errorMessage = getErrorMessage(error);
    if (errorMessage.includes('管理者')) {
      return res.status(401).json({ 
        error: errorMessage
      });
    }
    
    return res.status(500).json({ 
      error: 'サーバーエラーが発生しました',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
    });
  } finally {
    // 一時ファイルを削除
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
        console.log('🗑️ 一時ファイル削除完了:', tempFilePath);
      } catch (unlinkError) {
        console.error('⚠️ 一時ファイル削除エラー:', getErrorMessage(unlinkError));
      }
    }
    
    await prisma.$disconnect();
  }
}