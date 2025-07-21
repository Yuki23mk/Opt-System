// ファイル: pages/api/data-monitor/category/index.ts (CORS修正版)
import { verifyToken, JWTPayload } from "@/lib/auth/jwt";
import { PrismaClient } from "@prisma/client";
import { NextApiRequest, NextApiResponse } from "next";

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

// グローバルなPrismaインスタンス管理
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// CORS設定関数（強化版）
function setCorsHeaders(res: NextApiResponse) {
  const frontendUrl = getRequiredEnvVar('NEXT_PUBLIC_FRONTEND_URL');
  
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', frontendUrl);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers', 
    'Content-Type, Authorization, Accept, Cache-Control, X-Requested-With, Origin, X-CSRF-Token'
  );
  res.setHeader('Access-Control-Max-Age', '86400'); // 24時間キャッシュ
}

// バリデーション関数
const validateAndSanitize = {
  validateId: (id: any): { isValid: boolean; value: number; error?: string } => {
    const numId = Number(id);
    
    if (isNaN(numId) || !Number.isInteger(numId) || numId <= 0) {
      return { isValid: false, value: 0, error: '無効なIDです' };
    }
    
    if (numId > 2147483647) {
      return { isValid: false, value: 0, error: 'IDが大きすぎます' };
    }
    
    return { isValid: true, value: numId };
  },

  validateString: (input: any, fieldName: string, maxLength: number = 255): { isValid: boolean; sanitized: string; error?: string } => {
    if (!input || typeof input !== 'string') {
      return { isValid: false, sanitized: '', error: `${fieldName}が必要です` };
    }
    
    const trimmed = input.trim();
    
    if (trimmed.length === 0) {
      return { isValid: false, sanitized: '', error: `${fieldName}を入力してください` };
    }
    
    if (trimmed.length > maxLength) {
      return { isValid: false, sanitized: '', error: `${fieldName}は${maxLength}文字以内で入力してください` };
    }
    
    // 危険な文字チェック
    const dangerousPatterns = [
      /[<>'"`;\\]/g,
      /\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|EXEC|EXECUTE)\b/gi,
      /--|\*\/|\*\s*\/|\/\*/,
      /<script|javascript:|data:|vbscript:/gi
    ];
    
    if (dangerousPatterns.some(pattern => pattern.test(trimmed))) {
      return { isValid: false, sanitized: '', error: '使用できない文字が含まれています' };
    }
    
    const sanitized = trimmed
      .replace(/[<>'"`;\\]/g, '')
      .replace(/\s+/g, ' ')
      .substring(0, maxLength);
    
    return { isValid: true, sanitized };
  }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 🔧 全リクエストにCORSヘッダーを最初に設定
  setCorsHeaders(res);

  // OPTIONSリクエストの処理（プリフライト）
  if (req.method === "OPTIONS") {
    console.log("[Category API] OPTIONS プリフライトリクエスト受信");
    return res.status(200).end();
  }

  console.log(`[Category API] ${req.method} ${req.url} リクエスト受信`);

  // 認証チェック
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    console.log("[Category API] 認証トークンなし");
    return res.status(401).json({ error: "No token" });
  }

  let user: JWTPayload;
  try {
    user = verifyToken<JWTPayload>(token);
    console.log("[Category API] ユーザー認証成功:", { id: user.id, companyId: user.companyId });
  } catch (error) {
    console.error("[Category API] JWT検証エラー:", error);
    return res.status(401).json({ error: "Invalid token", details: getErrorMessage(error) });
  }

  try {
    if (req.method === "GET") {
      const { id } = req.query;
      console.log("[Category API] GET id:", id);
      
      if (id) {
        // 特定のカテゴリを取得
        const idValidation = validateAndSanitize.validateId(id);
        if (!idValidation.isValid) {
          return res.status(400).json({ error: idValidation.error });
        }

        const category = await prisma.dataMonitorCategory.findUnique({
          where: { id: idValidation.value },
          include: {
            projects: {
              include: {
                measurements: {
                  orderBy: { date: "asc" },
                },
              },
              orderBy: { createdAt: "desc" },
            },
          },
        });

        if (!category) {
          return res.status(404).json({ 
            error: "Category not found", 
            categoryId: idValidation.value 
          });
        }
        
        console.log("[Category API] カテゴリ取得成功:", category);
        return res.status(200).json(category);
      } else {
        // 全カテゴリを取得
        const categories = await prisma.dataMonitorCategory.findMany({
          where: { companyId: user.companyId },
          include: {
            projects: {
              include: {
                measurements: {
                  orderBy: { date: "asc" },
                },
              },
              orderBy: { createdAt: "desc" },
            },
          },
          orderBy: { createdAt: "desc" },
        });
        
        console.log(`[Category API] カテゴリ一覧取得成功: 会社${user.companyId}, ${categories.length}件`);
        return res.status(200).json(categories);
      }
    }

    if (req.method === "POST") {
      const { name } = req.body;
      console.log("[Category API] POST受信データ:", { name, companyId: user.companyId });
      
      const nameValidation = validateAndSanitize.validateString(name, 'カテゴリ名', 100);
      if (!nameValidation.isValid) {
        return res.status(400).json({ error: nameValidation.error });
      }

      // 同名カテゴリチェック
      const existingCategory = await prisma.dataMonitorCategory.findFirst({
        where: {
          name: nameValidation.sanitized,
          companyId: user.companyId,
        },
      });

      if (existingCategory) {
        return res.status(409).json({ 
          error: "同じ名前のカテゴリが既に存在します",
          existingName: nameValidation.sanitized
        });
      }

      const created = await prisma.dataMonitorCategory.create({
        data: { 
          name: nameValidation.sanitized,
          companyId: user.companyId,
        },
      });
      
      console.log("[Category API] カテゴリ作成成功:", created);
      return res.status(201).json(created);
    }

    if (req.method === "PUT") {
      const { id, name } = req.body;
      console.log("[Category API] PUT受信データ:", { id, name });
      
      const idValidation = validateAndSanitize.validateId(id);
      if (!idValidation.isValid) {
        return res.status(400).json({ error: idValidation.error });
      }
      
      const nameValidation = validateAndSanitize.validateString(name, 'カテゴリ名', 100);
      if (!nameValidation.isValid) {
        return res.status(400).json({ error: nameValidation.error });
      }

      // カテゴリ存在確認
      const existingCategory = await prisma.dataMonitorCategory.findUnique({
        where: { id: idValidation.value }
      });

      if (!existingCategory) {
        return res.status(404).json({ 
          error: "Category not found", 
          categoryId: idValidation.value 
        });
      }

      const updated = await prisma.dataMonitorCategory.update({
        where: { id: idValidation.value },
        data: { name: nameValidation.sanitized },
      });
      
      console.log("[Category API] カテゴリ更新成功:", updated);
      return res.status(200).json(updated);
    }

    if (req.method === "DELETE") {
      const { id } = req.query;
      console.log("[Category API] DELETE受信データ:", { id });
      
      const idValidation = validateAndSanitize.validateId(id);
      if (!idValidation.isValid) {
        return res.status(400).json({ error: idValidation.error });
      }

      // カテゴリ存在確認
      const existingCategory = await prisma.dataMonitorCategory.findUnique({
        where: { id: idValidation.value }
      });

      if (!existingCategory) {
        return res.status(404).json({ 
          error: "Category not found", 
          categoryId: idValidation.value 
        });
      }

      // 関連するプロジェクトと測定データも削除
      const projects = await prisma.dataMonitorProject.findMany({
        where: { categoryId: idValidation.value },
      });

      for (const project of projects) {
        await prisma.dataMonitorMeasurement.deleteMany({
          where: { projectId: project.id },
        });
      }

      await prisma.dataMonitorProject.deleteMany({
        where: { categoryId: idValidation.value },
      });

      await prisma.dataMonitorCategory.delete({
        where: { id: idValidation.value },
      });
      
      console.log("[Category API] カテゴリ削除成功:", idValidation.value);
      return res.status(200).json({ success: true, deletedId: idValidation.value });
    }

    console.log("[Category API] 未対応メソッド:", req.method);
    res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']);
    return res.status(405).json({ error: "Method not allowed", method: req.method });
    
  } catch (err) {
    console.error("[Category API] サーバーエラー:", err);
    
    // Prismaエラーの詳細分析
    if (err && typeof err === 'object' && 'code' in err) {
      if (err.code === 'P2003') {
        return res.status(400).json({ 
          error: "外部キー制約エラー", 
          details: "関連するデータが存在しません"
        });
      }
      
      if (err.code === 'P2002') {
        return res.status(409).json({ 
          error: "重複データエラー", 
          details: "同じ名前のカテゴリが既に存在します"
        });
      }
    }
    
    return res.status(500).json({ 
      error: "Internal Server Error",
      message: process.env.NODE_ENV === 'development' ? getErrorMessage(err) : 'エラーが発生しました'
    });
  } finally {
    // 本番環境では接続を切断
    if (process.env.NODE_ENV === "production") {
      await prisma.$disconnect();
    }
  }
}