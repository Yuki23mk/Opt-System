/**
 * ファイルパス: OptiOil-API/pages/api/users/me_put.ts
 * プロフィール更新API（品質向上版）
 */

import { verifyToken } from "@/lib/auth/jwt";
import { prisma } from "@/lib/prisma";
import { NextApiRequest, NextApiResponse } from "next";
import { runMiddleware } from "../../../lib/cors";

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

// 🔧 CORS設定関数を直接定義
const setCorsHeaders = (req: NextApiRequest, res: NextApiResponse) => {
  const allowedOrigins = getAllowedOrigins();
  const origin = req.headers.origin;
  
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    const corsOrigin = allowedOrigins.length > 0 ? allowedOrigins.join(',') : '*';
    res.setHeader('Access-Control-Allow-Origin', corsOrigin);
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // ✅ CORS対応追加
  setCorsHeaders(req, res);

  // ✅ OPTIONS対応（CORSプリフライト）
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "PUT") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // ✅ トークン取得（Bearer or Cookie）- [userId].tsと統一
    const bearerToken = req.headers.authorization?.split(" ")[1];
    const cookieToken = req.cookies.token;
    const token = bearerToken || cookieToken;

    if (!token) {
      return res.status(401).json({ error: "No token provided" });
    }

    // ✅ トークン検証
    const decoded = verifyToken(token);
    if (!decoded || typeof decoded === "string") {
      return res.status(401).json({ error: "Invalid token" });
    }

    const data = req.body;

    // 🔍 デバッグログ
    console.log('📥 [API] users/me_put リクエスト:', {
      userId: decoded.id,
      companyId: decoded.companyId,
      updateData: data
    });

    // ✅ 会社名更新（元のロジック維持）
    if (data.company && decoded.companyId) {
      try {
        await prisma.company.update({
          where: { id: decoded.companyId },
          data: { name: data.company },
        });
      } catch (companyError) {
        console.error('❌ 会社情報更新エラー:', companyError);
        // 会社更新失敗でもユーザー情報更新は続行
      }
    }

    // ✅ ユーザー情報更新
    const updated = await prisma.user.update({
      where: { id: decoded.id },
      data: {
        name: data.name,
        department: data.department,
        position: data.position,
        phone: data.phone,
      },
      include: { 
        companyRel: {
          select: { name: true }
        }
      },
    });

    // ✅ レスポンス形式（元の形式を維持）
    const responseData = {
      user: {
        id: updated.id,
        email: updated.email,
        name: updated.name,
        department: updated.department,
        position: updated.position,
        phone: updated.phone,
        systemRole: updated.systemRole,
        companyId: updated.companyId,
        companyRel: updated.companyRel,
        status: updated.status
      }
    };

    // 🔍 デバッグログ
    console.log('📤 [API] users/me_put レスポンス:', {
      userId: updated.id,
      email: updated.email,
      updated: true
    });

    return res.status(200).json(responseData);

  } catch (err: any) {
    console.error("❌ User update error:", err);
    
    // ✅ 詳細なエラーハンドリング
    if (err.code === 'P2002') {
      return res.status(400).json({ error: "データの重複エラーが発生しました" });
    }
    
    return res.status(500).json({ 
      error: "プロフィール更新に失敗しました",
      details: err.message 
    });
  }
}