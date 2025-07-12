// ファイル: /pages/api/data-monitor/limit-settings/index.ts
import { NextApiRequest, NextApiResponse } from "next";
import { verifyToken } from "@/lib/auth/jwt";
import { PrismaClient, Prisma } from "@prisma/client";

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

// CORS設定関数
function setCorsHeaders(res: NextApiResponse) {
  const frontendUrl = getRequiredEnvVar('NEXT_PUBLIC_FRONTEND_URL');
  
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', frontendUrl);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers', 
    'Content-Type, Authorization, Accept, Cache-Control, X-Requested-With, Origin'
  );
}

interface LimitSettings {
  key: string;
  targetValue: number;
}

// 🔧 Prisma Json型のヘルパー関数
const createJsonValue = (value: any): Prisma.JsonValue => {
  if (value === null || value === undefined) {
    return null;
  }
  return value as Prisma.JsonValue;
};

async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 🔧 全リクエストにCORSヘッダーを設定
  setCorsHeaders(res);

  // OPTIONSリクエストの処理（プリフライト）
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "No token" });
  }

  try {
    const user = verifyToken(token);
    if (!user || !user.id || !user.companyId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    switch (req.method) {
      case "GET": {
        const { projectId } = req.query;
        
        if (!projectId) {
          return res.status(400).json({ error: "Missing projectId" });
        }

        const projectIdNum = Number(projectId);
        if (isNaN(projectIdNum) || projectIdNum <= 0) {
          return res.status(400).json({ error: "Invalid projectId" });
        }

        // プロジェクトが存在し、アクセス権限があることを確認
        const project = await prisma.dataMonitorProject.findFirst({
          where: { 
            id: projectIdNum,
            category: {
              companyId: user.companyId
            }
          },
          include: {
            category: true
          }
        });

        if (!project) {
          return res.status(404).json({ error: "Project not found or access denied" });
        }

        // 管理限界値設定を取得（JSON型のlimitSettingsフィールドから）
        const limitSettings = project.limitSettings || [];
        return res.status(200).json(limitSettings);
      }

      case "POST": 
      case "PUT": {
        const { projectId, limitSettings } = req.body;
        
        if (!projectId || !Array.isArray(limitSettings)) {
          return res.status(400).json({ error: "Missing projectId or invalid limitSettings" });
        }

        const projectIdNum = Number(projectId);
        if (isNaN(projectIdNum) || projectIdNum <= 0) {
          return res.status(400).json({ error: "Invalid projectId" });
        }

        // バリデーション（簡素化）
        for (const setting of limitSettings) {
          if (!setting.key || typeof setting.targetValue !== 'number') {
            return res.status(400).json({ error: "Invalid limit setting format - key and targetValue required" });
          }
          
          // 数値型の項目のみ許可
          const allowedKeys = ['concentration', 'ph'];
          if (!allowedKeys.includes(setting.key)) {
            return res.status(400).json({ error: `Invalid key: ${setting.key}. Allowed: ${allowedKeys.join(', ')}` });
          }

          // 数値範囲の基本チェック
          if (setting.targetValue < 0 || setting.targetValue > 1000) {
            return res.status(400).json({ error: `Invalid targetValue: ${setting.targetValue}. Must be between 0 and 1000` });
          }
        }

        // プロジェクトのアクセス権限確認
        const project = await prisma.dataMonitorProject.findFirst({
          where: { 
            id: projectIdNum,
            category: {
              companyId: user.companyId
            }
          }
        });

        if (!project) {
          return res.status(404).json({ error: "Project not found or access denied" });
        }

        // 管理限界値を更新（Prisma Json型の型安全な設定）
        const updatedProject = await prisma.dataMonitorProject.update({
          where: { id: projectIdNum },
          data: { 
            limitSettings: limitSettings
          }
        });

        return res.status(200).json(updatedProject.limitSettings);
      }

      case "DELETE": {
        const { projectId } = req.query;
        
        if (!projectId) {
          return res.status(400).json({ error: "Missing projectId" });
        }

        const projectIdNum = Number(projectId);
        if (isNaN(projectIdNum) || projectIdNum <= 0) {
          return res.status(400).json({ error: "Invalid projectId" });
        }

        // プロジェクトのアクセス権限確認
        const project = await prisma.dataMonitorProject.findFirst({
          where: { 
            id: projectIdNum,
            category: {
              companyId: user.companyId
            }
          }
        });

        if (!project) {
          return res.status(404).json({ error: "Project not found or access denied" });
        }

        // 管理限界値をクリア（Prisma Json型の適切なnull設定）
        await prisma.dataMonitorProject.update({
          where: { id: projectIdNum },
          data: { 
            limitSettings: Prisma.JsonNull
          }
        });

        return res.status(204).end();
      }

      default:
        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']);
        return res.status(405).json({ error: "Method not allowed", method: req.method });
    }
  } catch (err) {
    console.error("Limit settings API error:", getErrorMessage(err));
    return res.status(500).json({ 
      error: "Internal server error",
      message: process.env.NODE_ENV === 'development' ? getErrorMessage(err) : 'エラーが発生しました'
    });
  } finally {
    // 本番環境では接続を切断
    if (process.env.NODE_ENV === "production") {
      await prisma.$disconnect();
    }
  }
}

export default handler;