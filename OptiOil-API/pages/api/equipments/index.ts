// pages/api/equipment/index.ts (セキュリティ強化完全版)
import { NextApiRequest, NextApiResponse } from "next";
import { PrismaClient } from "@prisma/client";
import { verifyTokenEnhanced, handleSecurityError } from "../../../utils/authSecurity";

// グローバルなPrismaインスタンス管理
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};
const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// ✅ 削除済みユーザー表示用のフォーマット関数を追加（ファイル上部に追加）
const formatUserForDisplay = (user: any) => {
  if (!user) return null;
  
  return {
    ...user,
    isDeleted: user.status === "deleted",
    displayName: user.status === "deleted" ? "削除済みアカウント" : user.name
  };
};

// 🔒 セキュリティ強化版 CORS設定関数
function setCorsHeaders(res: NextApiResponse) {
  // 🚨 環境変数の必須チェック
  const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL;
  
  if (!frontendUrl) {
    throw new Error('NEXT_PUBLIC_FRONTEND_URL環境変数が設定されていません。本番環境では必須です。');
  }
  
  if (!frontendUrl) {
    throw new Error('NEXT_PUBLIC_FRONTEND_URL環境変数が設定されていません。本番環境では必須です。');
  }
  
  // 🌐 CORS ヘッダーの設定
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', frontendUrl);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
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

  try {
    // 🔒 セキュリティ強化された認証チェック
    const user = verifyTokenEnhanced(req);
    console.log("[Equipment API] ユーザー認証成功:", { id: user.id, companyId: user.companyId });

    if (req.method === "POST") {
      const { code, category, name, manufacturer, location, manager } = req.body;
      console.log("[Equipment API] POST リクエストボディ:", req.body);

      // 必須項目チェック
      if (!code || !category || !name || !manufacturer) {
        return res.status(400).json({ 
          message: "必須項目が不足しています", 
          required: ["code", "category", "name", "manufacturer"] 
        });
      }

      // 重複チェック
      const existingEquipment = await prisma.equipment.findFirst({
        where: {
          code: code.trim(),
          companyId: user.companyId, // userオブジェクトを使用
        },
      });

      if (existingEquipment) {
        return res.status(409).json({ 
          message: "同じコードの設備が既に存在します",
          existingCode: code.trim()
        });
      }

      const equipment = await prisma.equipment.create({
        data: {
          code: code.trim(),
          category: category.trim(),
          name: name.trim(),
          manufacturer: manufacturer.trim(),
          location: location?.trim() || "",
          manager: manager?.trim() || "",
          userId: user.id, // userオブジェクトを使用
          companyId: user.companyId, // userオブジェクトを使用
        },
      });

      console.log("[Equipment API] 設備作成成功:", equipment);
      return res.status(201).json(equipment);

    } else if (req.method === "GET") {
      console.log("[Equipment API] GET リクエスト - companyId:", user.companyId);
      
      const equipments = await prisma.equipment.findMany({
        where: { companyId: user.companyId }, // userオブジェクトを使用
        orderBy: { createdAt: "desc" },
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
          // ✅ 担当者情報を追加
          user: {
            select: {
              id: true,
              name: true,
              status: true  // 削除済み判定用
            }
          }
        },
      });

      // ✅ レスポンスで担当者情報をフォーマット
      const formattedEquipments = equipments.map(equipment => ({
        ...equipment,
        user: formatUserForDisplay(equipment.user) // 担当者情報をフォーマット
      }));

      console.log("[Equipment API] 設備データ取得成功:", formattedEquipments.length, "件");
      return res.status(200).json(formattedEquipments);

    } else {
      res.setHeader("Allow", ["GET", "POST", "OPTIONS"]);
      return res.status(405).json({ 
        message: `Method ${req.method} Not Allowed`,
        allowedMethods: ["GET", "POST", "OPTIONS"]
      });
    }
  } catch (error) {
    // 🔒 セキュリティ強化されたエラーハンドリング
    return handleSecurityError(res, error, req);
  } finally {
    // 本番環境では接続を切断
    if (process.env.NODE_ENV === "production") {
      await prisma.$disconnect();
    }
  }
}