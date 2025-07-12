// OptiOil-API/pages/api/users/me.ts (TypeScriptエラー修正版)
import { verifyToken } from "@/lib/auth/jwt";
import { prisma } from "@/lib/prisma";
import { NextApiRequest, NextApiResponse } from "next";

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

// 🆕 環境変数の取得
const FRONTEND_URL = process.env.NEXT_PUBLIC_FRONTEND_URL;
if (!FRONTEND_URL) {
  throw new Error('NEXT_PUBLIC_FRONTEND_URL環境変数が設定されていません。本番環境では必須です。');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 🆕 CORS設定を追加
  res.setHeader('Access-Control-Allow-Origin', FRONTEND_URL!);
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const authHeader = req.headers.authorization;
  const token = authHeader?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  try {
    const decoded = verifyToken(token); // JWT → { id, companyId, ... }

    // GET: 自分のプロフィール情報取得
    if (req.method === "GET") {
      const user = await prisma.user.findUnique({
        where: { id: decoded.id }, // ✅ 修正：userId → decoded.id
        include: {
          companyRel: {
            select: { name: true }, // ← ここが重要！
          },
        },
      });

      if (!user) return res.status(404).json({ error: "User not found" });

      return res.status(200).json({
        user: {
          ...user,
          company: user.companyRel?.name || "", // ← フロントが期待する形式に整形
        },
      });
    }
    
    // PUT: プロフィール更新（会社名含む）
    if (req.method === "PUT") {
      const data = req.body;

      // 会社名の更新（Companyテーブル）
      if (data.company) {
        await prisma.company.update({
          where: { id: decoded.companyId },
          data: { name: data.company },
        });
      }

      // ユーザーのプロフィール情報更新
      const updated = await prisma.user.update({
        where: { id: decoded.id },
        data: {
          name: data.name,
          department: data.department,
          position: data.position,
          phone: data.phone,
        },
        include: { companyRel: true },
      });

      return res.status(200).json({ user: updated });
    }

    return res.status(405).json({ error: "Method not allowed" });

  } catch (err) { // ✅ 修正：err: any → err (unknown型)
    console.error("User update error:", getErrorMessage(err)); // ✅ 型安全なエラーログ
    return res.status(401).json({ 
      error: "Invalid token or update failed",
      details: process.env.NODE_ENV === 'development' ? getErrorMessage(err) : undefined
    });
  } finally {
    await prisma.$disconnect(); // ✅ 追加：Prisma接続の切断
  }
}