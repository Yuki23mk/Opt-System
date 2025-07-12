// ファイル: pages/api/data-monitor/measurement/index.ts (完全修正版)
import { verifyToken, JWTPayload } from "@/lib/auth/jwt";
import { PrismaClient, Prisma } from "@prisma/client";
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

// 🔧 Prisma Json型のヘルパー関数
const safeJsonToObject = (jsonValue: any): Record<string, any> => {
  if (jsonValue === null || jsonValue === undefined) {
    return {};
  }
  
  if (typeof jsonValue === 'object' && !Array.isArray(jsonValue)) {
    return jsonValue as Record<string, any>;
  }
  
  // フォールバック: 文字列の場合はパースを試みる
  if (typeof jsonValue === 'string') {
    try {
      const parsed = JSON.parse(jsonValue);
      if (typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch (error) {
      console.error('JSON parse error:', error);
    }
  }
  
  return {};
};

const createJsonValue = (value: any): Prisma.JsonValue | null => {
  if (value === null || value === undefined) {
    return null;  // ✅ 単純なnullを返す
  }
  return value as Prisma.JsonValue;
};

// 🔧 Prisma InputJsonValue用のヘルパー関数（update操作用）
const createInputJsonValue = (value: any): Prisma.InputJsonValue | null => {
  if (value === null || value === undefined) {
    return null;  // ✅ 戻り値型にnullを明示的に含める
  }
  
  // Record<string, any>型の場合は、そのまま返す
  if (typeof value === 'object' && !Array.isArray(value) && value !== null) {
    return value as Prisma.InputJsonObject;
  }
  
  return value as Prisma.InputJsonValue;
};

// グローバルなPrismaインスタンス管理
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// CORS設定関数
function setCorsHeaders(res: NextApiResponse) {
  const frontendUrl = getRequiredEnvVar('NEXT_PUBLIC_FRONTEND_URL');
  
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', frontendUrl);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, Cache-Control, X-Requested-With');
}

// SQLインジェクション対策関数
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

  validateDate: (dateInput: any): { isValid: boolean; value: Date; error?: string } => {
    if (!dateInput) {
      return { isValid: false, value: new Date(), error: '日付が必要です' };
    }
    
    if (typeof dateInput === 'string') {
      const dateRegex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/;
      if (!dateRegex.test(dateInput)) {
        return { isValid: false, value: new Date(), error: '無効な日付形式です' };
      }
    }
    
    const date = new Date(dateInput);
    
    if (isNaN(date.getTime())) {
      return { isValid: false, value: new Date(), error: '無効な日付です' };
    }
    
    return { isValid: true, value: date };
  },

  validateValues: (values: any): { isValid: boolean; sanitized: Record<string, any>; error?: string } => {
    if (!values || typeof values !== 'object' || Array.isArray(values)) {
      return { isValid: false, sanitized: {}, error: '測定値は有効なオブジェクトである必要があります' };
    }
    
    const sanitized: Record<string, any> = {};
    const maxFields = 20;
    let fieldCount = 0;
    
    for (const [key, value] of Object.entries(values)) {
      fieldCount++;
      
      if (fieldCount > maxFields) {
        return { isValid: false, sanitized: {}, error: '測定項目が多すぎます' };
      }
      
      const sanitizedKey = key
        .replace(/[<>'"`;\\]/g, '')
        .replace(/\s+/g, '_')
        .substring(0, 50);
      
      if (sanitizedKey.length === 0) continue;
      
      if (typeof value === 'number') {
        if (Number.isFinite(value) && value >= -1000000 && value <= 1000000) {
          sanitized[sanitizedKey] = Math.round(value * 100) / 100;
        }
      } else if (typeof value === 'string') {
        const sanitizedValue = value
          .replace(/[<>'"`;\\]/g, '')
          .trim()
          .substring(0, 500);
        
        if (sanitizedValue.length > 0) {
          sanitized[sanitizedKey] = sanitizedValue;
        }
      }
    }
    
    return { isValid: true, sanitized };
  }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 全リクエストにCORSヘッダーを設定
  setCorsHeaders(res);

  // OPTIONSリクエストの処理（プリフライト）
  if (req.method === "OPTIONS") {
    console.log("[Measurement API] OPTIONS プリフライトリクエスト受信");
    return res.status(200).end();
  }

  console.log(`[Measurement API] ${req.method} ${req.url} リクエスト受信`);

  // 認証チェック
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    console.log("[Measurement API] 認証トークンなし");
    return res.status(401).json({ error: "No token" });
  }

  let user: JWTPayload;
  try {
    user = verifyToken<JWTPayload>(token);
    console.log("[Measurement API] ユーザー認証成功:", { id: user.id, companyId: user.companyId });
  } catch (error) {
    console.error("[Measurement API] JWT検証エラー:", error);
    return res.status(401).json({ error: "Invalid token", details: getErrorMessage(error) });
  }

  try {
    if (req.method === "GET") {
      const { projectId } = req.query;
      console.log("[Measurement API] GET projectId:", projectId);
      
      const projectValidation = validateAndSanitize.validateId(projectId);
      if (!projectValidation.isValid) {
        return res.status(400).json({ error: projectValidation.error });
      }

      const measurements = await prisma.dataMonitorMeasurement.findMany({
        where: { projectId: projectValidation.value },
        orderBy: { date: "asc" },
      });
      
      console.log(`[Measurement API] 測定データ取得成功: プロジェクト${projectValidation.value}, ${measurements.length}件`);
      return res.status(200).json(measurements);
    }

    if (req.method === "POST") {
      const { projectId, date, values, note } = req.body;
      console.log("[Measurement API] POST受信データ:", { projectId, date, values, note });
      
      // validateAndSanitizeを使用
      const projectValidation = validateAndSanitize.validateId(projectId);
      if (!projectValidation.isValid) {
        return res.status(400).json({ error: projectValidation.error });
      }
      
      const dateValidation = validateAndSanitize.validateDate(date);
      if (!dateValidation.isValid) {
        return res.status(400).json({ error: dateValidation.error });
      }
      
      const valuesValidation = validateAndSanitize.validateValues(values);
      if (!valuesValidation.isValid) {
        return res.status(400).json({ error: valuesValidation.error });
      }

      // プロジェクト存在確認
      const project = await prisma.dataMonitorProject.findUnique({
        where: { id: projectValidation.value }
      });

      if (!project) {
        return res.status(404).json({ 
          error: "Project not found", 
          projectId: projectValidation.value 
        });
      }

      const created = await prisma.dataMonitorMeasurement.create({
        data: { 
          projectId: projectValidation.value,
          date: dateValidation.value, 
          values: valuesValidation.sanitized as Prisma.InputJsonObject, 
          note: note ? note.trim().substring(0, 500) : undefined, 
        },
      });
      
      console.log("[Measurement API] データ作成成功:", created);
      return res.status(201).json(created);
    }

    if (req.method === "PUT") {
      const { id, values, note } = req.body;
      console.log("[Measurement API] PUT受信データ:", { id, values, note });
      
      const idValidation = validateAndSanitize.validateId(id);
      if (!idValidation.isValid) {
        return res.status(400).json({ error: idValidation.error });
      }
      
      const valuesValidation = validateAndSanitize.validateValues(values);
      if (!valuesValidation.isValid) {
        return res.status(400).json({ error: valuesValidation.error });
      }

      const updated = await prisma.dataMonitorMeasurement.update({
        where: { id: idValidation.value },
        data: { 
          values: valuesValidation.sanitized as Prisma.InputJsonObject, 
          note: note ? note.trim().substring(0, 500) : undefined 
        },
      });
      
      console.log("[Measurement API] データ更新成功:", updated);
      return res.status(200).json(updated);
    }

    if (req.method === "DELETE") {
      const { projectId, date, key } = req.body;
      console.log("[Measurement API] DELETE受信データ:", { projectId, date, key });
      
      const projectValidation = validateAndSanitize.validateId(projectId);
      if (!projectValidation.isValid) {
        return res.status(400).json({ error: projectValidation.error });
      }
      
      const dateValidation = validateAndSanitize.validateDate(date);
      if (!dateValidation.isValid) {
        return res.status(400).json({ error: dateValidation.error });
      }

      if (key) {
        const sanitizedKey = typeof key === 'string' 
          ? key.replace(/[<>'"`;\\]/g, '').trim().substring(0, 50)
          : '';
        
        if (!sanitizedKey) {
          return res.status(400).json({ error: "無効なキー名です" });
        }
        
        const record = await prisma.dataMonitorMeasurement.findFirst({
          where: {
            projectId: projectValidation.value,
            date: dateValidation.value,
          },
        });

        if (!record) {
          return res.status(404).json({ error: "Measurement not found" });
        }

        // 🔧 Prisma Json型の安全なオブジェクト操作
        const currentValues = safeJsonToObject(record.values);
        const newValues = { ...currentValues };
        delete newValues[sanitizedKey];

        await prisma.dataMonitorMeasurement.update({
          where: { id: record.id },
          data: { values: newValues as Prisma.InputJsonObject },
        });

        console.log("[Measurement API] キー削除成功:", sanitizedKey);
        return res.status(200).json({ success: true, deletedKey: sanitizedKey });
      } else {
        const result = await prisma.dataMonitorMeasurement.deleteMany({
          where: {
            projectId: projectValidation.value,
            date: dateValidation.value,
          },
        });

        console.log("[Measurement API] データ削除成功:", result.count, "件");
        return res.status(200).json({ success: true, deletedCount: result.count });
      }
    }

    if (req.method === "PATCH") {
      const { projectId, date, note } = req.body;
      console.log("[Measurement API] PATCH受信データ:", { projectId, date, note });

      const projectValidation = validateAndSanitize.validateId(projectId);
      if (!projectValidation.isValid) {
        return res.status(400).json({ error: projectValidation.error });
      }
      
      const dateValidation = validateAndSanitize.validateDate(date);
      if (!dateValidation.isValid) {
        return res.status(400).json({ error: dateValidation.error });
      }

      const record = await prisma.dataMonitorMeasurement.findFirst({
        where: {
          projectId: projectValidation.value,
          date: dateValidation.value,
        },
      });

      if (!record) {
        return res.status(404).json({ error: "対象データが見つかりません" });
      }

      const updated = await prisma.dataMonitorMeasurement.update({
        where: { id: record.id },
        data: { note: note ? note.trim().substring(0, 500) : undefined },
      });

      console.log("[Measurement API] ノート更新成功:", updated);
      return res.status(200).json(updated);
    }

    console.log("[Measurement API] 未対応メソッド:", req.method);
    res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']);
    return res.status(405).json({ error: "Method not allowed", method: req.method });
    
  } catch (err) {
    console.error("[Measurement API] サーバーエラー:", err);
    
    // Prismaエラーの詳細分析
    if (err && typeof err === 'object' && 'code' in err) {
      if (err.code === 'P2003') {
        return res.status(400).json({ 
          error: "外部キー制約エラー", 
          details: "関連するプロジェクトが存在しません"
        });
      }
      
      if (err.code === 'P2002') {
        return res.status(409).json({ 
          error: "重複データエラー", 
          details: "同じ日付のデータが既に存在します"
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