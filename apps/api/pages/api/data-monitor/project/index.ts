// ファイル: pages/api/data-monitor/project/index.ts
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
  },

  // 🔧 修正：フロントエンドの値に合わせて有効なタイプを更新
  validateFluidType: (fluidType: any): { isValid: boolean; value: string; error?: string } => {
    // フロントエンドから送信される実際の値に合わせて修正
    const validTypes = ['water_soluble_cutting', 'water_soluble_grinding'];
    
    if (!fluidType || typeof fluidType !== 'string') {
      return { isValid: true, value: 'water_soluble_cutting' }; // デフォルト値も修正
    }
    
    if (!validTypes.includes(fluidType)) {
      return { isValid: false, value: '', error: '無効な液体タイプです' };
    }
    
    return { isValid: true, value: fluidType };
  },

  validateMeasurementFields: (fields: any): { isValid: boolean; value: any[]; error?: string } => {
    if (!fields) {
      return { isValid: true, value: [] }; // 空配列を許可
    }

    if (!Array.isArray(fields)) {
      return { isValid: false, value: [], error: 'measurementFieldsは配列である必要があります' };
    }

    if (fields.length > 50) {
      return { isValid: false, value: [], error: '測定項目は50項目以内にしてください' };
    }

    // 各フィールドのバリデーション
    for (let i = 0; i < fields.length; i++) {
      const field = fields[i];
      
      if (!field || typeof field !== 'object') {
        return { isValid: false, value: [], error: `項目${i + 1}が無効です` };
      }

      if (!field.key || typeof field.key !== 'string' || field.key.trim().length === 0) {
        return { isValid: false, value: [], error: `項目${i + 1}のキーが無効です` };
      }

      if (!field.label || typeof field.label !== 'string' || field.label.trim().length === 0) {
        return { isValid: false, value: [], error: `項目${i + 1}のラベルが無効です` };
      }

      if (!field.type || !['text', 'number'].includes(field.type)) {
        return { isValid: false, value: [], error: `項目${i + 1}のタイプが無効です` };
      }

      if (field.required !== undefined && typeof field.required !== 'boolean') {
        return { isValid: false, value: [], error: `項目${i + 1}のrequiredフラグが無効です` };
      }
    }

    return { isValid: true, value: fields };
  }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 🔧 全リクエストにCORSヘッダーを最初に設定
  setCorsHeaders(res);

  // OPTIONSリクエストの処理（プリフライト）
  if (req.method === "OPTIONS") {
    console.log("[Project API] OPTIONS プリフライトリクエスト受信");
    return res.status(200).end();
  }

  console.log(`[Project API] ${req.method} ${req.url} リクエスト受信`);

  // 認証チェック
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    console.log("[Project API] 認証トークンなし");
    return res.status(401).json({ error: "No token" });
  }

  let user: JWTPayload;
  try {
    user = verifyToken<JWTPayload>(token);
    console.log("[Project API] ユーザー認証成功:", { id: user.id, companyId: user.companyId });
  } catch (error) {
    console.error("[Project API] JWT検証エラー:", error);
    return res.status(401).json({ error: "Invalid token", details: getErrorMessage(error) });
  }

  try {
    if (req.method === "GET") {
      const { categoryId, id } = req.query;
      console.log("[Project API] GET受信データ:", { categoryId, id });
      
      if (id) {
        // 特定のプロジェクトを取得
        const idValidation = validateAndSanitize.validateId(id);
        if (!idValidation.isValid) {
          return res.status(400).json({ error: idValidation.error });
        }

        const project = await prisma.dataMonitorProject.findUnique({
          where: { id: idValidation.value },
          include: {
            measurements: {
              orderBy: { date: "asc" },
            },
            category: true,
          },
        });

        if (!project) {
          return res.status(404).json({ 
            error: "Project not found", 
            projectId: idValidation.value 
          });
        }
        
        console.log("[Project API] プロジェクト取得成功:", project);
        return res.status(200).json(project);
      } else if (categoryId) {
        // カテゴリごとのプロジェクト一覧を取得
        const categoryIdValidation = validateAndSanitize.validateId(categoryId);
        if (!categoryIdValidation.isValid) {
          return res.status(400).json({ error: categoryIdValidation.error });
        }

        const projects = await prisma.dataMonitorProject.findMany({
          where: { categoryId: categoryIdValidation.value },
          include: {
            measurements: {
              orderBy: { date: "asc" },
            },
            category: true,
          },
          orderBy: { createdAt: "desc" },
        });
        
        console.log(`[Project API] プロジェクト一覧取得成功: カテゴリ${categoryIdValidation.value}, ${projects.length}件`);
        return res.status(200).json(projects);
      } else {
        // 全プロジェクトを取得（ユーザーの会社内のみ）
        const projects = await prisma.dataMonitorProject.findMany({
          where: {
            category: {
              companyId: user.companyId,
            },
          },
          include: {
            measurements: {
              orderBy: { date: "asc" },
            },
            category: true,
          },
          orderBy: { createdAt: "desc" },
        });
        
        console.log(`[Project API] 全プロジェクト取得成功: 会社${user.companyId}, ${projects.length}件`);
        return res.status(200).json(projects);
      }
    }

    if (req.method === "POST") {
      const { name, categoryId, fluidType, config } = req.body;
      console.log("[Project API] POST受信データ:", { name, categoryId, fluidType, config });
      
      // バリデーション
      const nameValidation = validateAndSanitize.validateString(name, 'プロジェクト名', 100);
      if (!nameValidation.isValid) {
        return res.status(400).json({ error: nameValidation.error });
      }

      const categoryValidation = validateAndSanitize.validateId(categoryId);
      if (!categoryValidation.isValid) {
        return res.status(400).json({ error: categoryValidation.error });
      }

      const fluidTypeValidation = validateAndSanitize.validateFluidType(fluidType);
      if (!fluidTypeValidation.isValid) {
        return res.status(400).json({ error: fluidTypeValidation.error });
      }

      // カテゴリ存在確認
      const category = await prisma.dataMonitorCategory.findUnique({
        where: { id: categoryValidation.value },
      });

      if (!category) {
        return res.status(404).json({ 
          error: "Category not found", 
          categoryId: categoryValidation.value 
        });
      }

      // 同名プロジェクトチェック
      const existingProject = await prisma.dataMonitorProject.findFirst({
        where: {
          name: nameValidation.sanitized,
          categoryId: categoryValidation.value,
        },
      });

      if (existingProject) {
        return res.status(409).json({ 
          error: "同じ名前のプロジェクトが既に存在します",
          existingName: nameValidation.sanitized
        });
      }

      // 🆕 デフォルトの測定項目を設定
      const defaultMeasurementFields = [
        { key: "concentration", label: "濃度(%)", type: "number", required: true },
        { key: "ph", label: "pH", type: "number", required: true },
        { key: "外観", label: "外観", type: "text", required: false },
        { key: "加工性", label: "加工性", type: "text", required: false },
        { key: "工具摩耗", label: "工具摩耗", type: "text", required: false },
        { key: "消泡性", label: "消泡性", type: "text", required: false },
        { key: "防錆性", label: "防錆性", type: "text", required: false },
        { key: "備考", label: "備考", type: "text", required: false }
      ];

      const created = await prisma.dataMonitorProject.create({
        data: {
          name: nameValidation.sanitized,
          categoryId: categoryValidation.value,
          fluidType: fluidTypeValidation.value,
          limitSettings: config || {},
          measurementFields: defaultMeasurementFields // 🆕 デフォルト項目を保存
        },
        include: {
          measurements: {
            orderBy: { date: "asc" },
          },
          category: true,
        },
      });
      
      console.log("[Project API] プロジェクト作成成功:", created);
      return res.status(201).json(created);
    }

    if (req.method === "PUT") {
      const { id, name, limitSettings, measurementFields } = req.body;
      console.log("[Project API] PUT受信データ:", { id, name, limitSettings, measurementFields });
      
      const idValidation = validateAndSanitize.validateId(id);
      if (!idValidation.isValid) {
        return res.status(400).json({ error: idValidation.error });
      }

      // プロジェクト存在確認
      const existingProject = await prisma.dataMonitorProject.findUnique({
        where: { id: idValidation.value }
      });

      if (!existingProject) {
        return res.status(404).json({ 
          error: "Project not found", 
          projectId: idValidation.value 
        });
      }

      const updateData: any = {};
      
      // 名前の更新
      if (name !== undefined) {
        const nameValidation = validateAndSanitize.validateString(name, 'プロジェクト名', 100);
        if (!nameValidation.isValid) {
          return res.status(400).json({ error: nameValidation.error });
        }
        updateData.name = nameValidation.sanitized;
      }
      
      // limitSettingsの更新
      if (limitSettings !== undefined) {
        updateData.limitSettings = limitSettings;
      }
      
      // 🆕 測定項目の更新
      if (measurementFields !== undefined) {
        const fieldsValidation = validateAndSanitize.validateMeasurementFields(measurementFields);
        if (!fieldsValidation.isValid) {
          return res.status(400).json({ error: fieldsValidation.error });
        }
        updateData.measurementFields = fieldsValidation.value;
      }

      const updated = await prisma.dataMonitorProject.update({
        where: { id: idValidation.value },
        data: updateData,
        include: {
          measurements: {
            orderBy: { date: "asc" },
          },
          category: true,
        },
      });
      
      console.log("[Project API] プロジェクト更新成功:", updated);
      return res.status(200).json(updated);
    }

    if (req.method === "DELETE") {
      const { id } = req.query;
      console.log("[Project API] DELETE受信データ:", { id });
      
      const idValidation = validateAndSanitize.validateId(id);
      if (!idValidation.isValid) {
        return res.status(400).json({ error: idValidation.error });
      }

      // プロジェクト存在確認
      const existingProject = await prisma.dataMonitorProject.findUnique({
        where: { id: idValidation.value }
      });

      if (!existingProject) {
        return res.status(404).json({ 
          error: "Project not found", 
          projectId: idValidation.value 
        });
      }

      // 関連する測定データを削除
      await prisma.dataMonitorMeasurement.deleteMany({
        where: { projectId: idValidation.value },
      });

      // プロジェクトを削除
      await prisma.dataMonitorProject.delete({
        where: { id: idValidation.value },
      });
      
      console.log("[Project API] プロジェクト削除成功:", idValidation.value);
      return res.status(200).json({ success: true, deletedId: idValidation.value });
    }

    console.log("[Project API] 未対応メソッド:", req.method);
    res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']);
    return res.status(405).json({ error: "Method not allowed", method: req.method });
    
  } catch (err) {
    console.error("[Project API] サーバーエラー:", err);
    
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
          details: "同じ名前のプロジェクトが既に存在します"
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