// OptiOil-API/pages/api/equipments/[id].ts (GET・PUT・DELETE対応版 - TypeScriptエラー修正)
import { NextApiRequest, NextApiResponse } from "next";
import { PrismaClient } from "@prisma/client";
import { verifyToken, JWTPayload } from "@/lib/auth/jwt";

// グローバルなPrismaインスタンス管理
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

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

// 🆕 Prismaエラー判定用の型ガード
function isPrismaError(error: unknown): error is { code?: string; message?: string } {
  return typeof error === 'object' && error !== null && 'code' in error;
}

// CORS設定関数（拡張版）
function setCorsHeaders(res: NextApiResponse) {
  const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL;
  
  if (!frontendUrl) {
    throw new Error('NEXT_PUBLIC_FRONTEND_URL環境変数が設定されていません。本番環境では必須です。');
  }
  
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', frontendUrl);
  res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,DELETE,OPTIONS'); // 🆕 GET・PUT追加
  res.setHeader(
    'Access-Control-Allow-Headers', 
    'Content-Type, Authorization, Accept, Cache-Control, X-Requested-With, Origin, X-CSRF-Token'
  );
  res.setHeader('Access-Control-Max-Age', '86400'); // 24時間キャッシュ
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 🔧 全リクエストにCORSヘッダーを最初に設定
  setCorsHeaders(res);

  // OPTIONSリクエストの処理（プリフライト）
  if (req.method === "OPTIONS") {
    console.log("[Equipment API] OPTIONS プリフライトリクエスト受信");
    return res.status(200).end();
  }

  console.log(`[Equipment API] ${req.method} ${req.url} リクエスト受信`);

  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    console.log("[Equipment API] Bearer認証ヘッダーなし");
    return res.status(401).json({ message: "Unauthorized" });
  }

  const token = authHeader.split(" ")[1];
  let payload: JWTPayload;
  
  try {
    payload = verifyToken<JWTPayload>(token);
    console.log("[Equipment API] ユーザー認証成功:", { id: payload.id, companyId: payload.companyId });
  } catch (error) {
    console.error("[Equipment API] JWT検証エラー:", error);
    return res.status(403).json({ message: "Invalid token" });
  }

  if (!payload || !payload.companyId) {
    console.log("[Equipment API] トークンペイロードが不正");
    return res.status(403).json({ message: "Invalid token payload" });
  }

  const id = parseInt(req.query.id as string, 10);
  if (isNaN(id)) {
    return res.status(400).json({ message: "Invalid equipment ID" });
  }

  try {
    if (req.method === "GET") {
      // 🆕 個別設備取得
      console.log("[Equipment API] GET リクエスト:", { equipmentId: id, companyId: payload.companyId });
      
      const equipment = await prisma.equipment.findFirst({
        where: {
          id: Number(id),
          companyId: payload.companyId,
        },
        select: {
          id: true,
          code: true,
          name: true,
          category: true,
          manufacturer: true,
          location: true,
          manager: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!equipment) {
        return res.status(404).json({ message: "設備が見つからないか、アクセス権限がありません" });
      }

      console.log("[Equipment API] 設備取得成功:", equipment.name);
      return res.status(200).json(equipment);

    } else if (req.method === "PUT") {
      // 🆕 設備更新
      const { code, category, name, manufacturer, location, manager } = req.body;
      console.log("[Equipment API] PUT リクエストボディ:", req.body);

      // 必須項目チェック
      if (!code || !category || !name || !manufacturer) {
        return res.status(400).json({ 
          message: "必須項目が不足しています", 
          required: ["code", "category", "name", "manufacturer"] 
        });
      }

      // 設備の存在確認と権限チェック
      const existingEquipment = await prisma.equipment.findFirst({
        where: {
          id: Number(id),
          companyId: payload.companyId,
        },
      });

      if (!existingEquipment) {
        return res.status(404).json({ message: "設備が見つからないか、編集権限がありません" });
      }

      // 同じコードの他の設備がないかチェック（自分以外）
      const duplicateEquipment = await prisma.equipment.findFirst({
        where: {
          code: code.trim(),
          companyId: payload.companyId,
          NOT: {
            id: Number(id)
          }
        },
      });

      if (duplicateEquipment) {
        return res.status(409).json({ 
          message: "同じコードの設備が既に存在します",
          existingCode: code.trim()
        });
      }

      // 設備更新
      const updatedEquipment = await prisma.equipment.update({
        where: { id: Number(id) },
        data: {
          code: code.trim(),
          category: category.trim(),
          name: name.trim(),
          manufacturer: manufacturer.trim(),
          location: location?.trim() || "",
          manager: manager?.trim() || "",
        },
      });

      console.log("[Equipment API] 設備更新成功:", updatedEquipment);
      return res.status(200).json(updatedEquipment);

    } else if (req.method === "DELETE") {
      // 🔄 既存のDELETE機能（完全保持）
      console.log("[Equipment Delete API] 削除開始:", { equipmentId: id, companyId: payload.companyId });

      // 🔥 修正：正しい削除順序（外部キー制約を考慮）
      
      // 1. EquipmentMaterial（使用資材）を削除
      const materialDeleteResult = await prisma.equipmentMaterial.deleteMany({
        where: {
          equipmentId: Number(id),
          companyId: payload.companyId,
        }
      });
      console.log("[Equipment Delete API] 関連資材削除:", materialDeleteResult.count, "件");

      // 2. EquipmentDocument（関連書類）を削除
      const documentDeleteResult = await prisma.equipmentDocument.deleteMany({
        where: {
          equipmentId: Number(id),
          companyId: payload.companyId,
        }
      });
      console.log("[Equipment Delete API] 関連ドキュメント削除:", documentDeleteResult.count, "件");

      // 3. 最後にEquipment本体を削除
      const deleteResult = await prisma.equipment.deleteMany({
        where: {
          id: Number(id),
          companyId: payload.companyId,
        }
      });

      console.log("[Equipment Delete API] 設備削除結果:", deleteResult.count, "件");

      if (deleteResult.count === 0) {
        return res.status(404).json({ message: "設備が見つからないか、削除権限がありません" });
      }

      console.log("[Equipment Delete API] 削除成功");
      return res.status(200).json({ 
        message: "設備を削除しました",
        deletedCounts: {
          materials: materialDeleteResult.count,
          documents: documentDeleteResult.count,
          equipment: deleteResult.count
        }
      });

    } else {
      // 🆕 許可メソッドを拡張
      res.setHeader("Allow", ["GET", "PUT", "DELETE", "OPTIONS"]);
      return res.status(405).json({ 
        message: `Method ${req.method} Not Allowed`,
        allowedMethods: ["GET", "PUT", "DELETE", "OPTIONS"]
      });
    }
  } catch (error) {
    console.error("[Equipment API] サーバーエラー:", error);
    
    // ✅ 修正：型安全なエラー処理
    if (isPrismaError(error)) {
      if (error.code === 'P2002') {
        return res.status(409).json({ 
          message: "データの重複エラー",
          details: "既に同じ情報の設備が存在します"
        });
      }
      
      if (error.code === 'P2003') {
        return res.status(400).json({ 
          message: "関連データが存在するため削除できません",
          details: "この設備に関連する資材や書類を先に削除してください"
        });
      }
    }
    
    return res.status(500).json({ 
      message: "設備処理に失敗しました",
      details: process.env.NODE_ENV === 'development' ? getErrorMessage(error) : undefined
    });
  } finally {
    // 本番環境では接続を切断
    if (process.env.NODE_ENV === "production") {
      await prisma.$disconnect();
    }
  }
}