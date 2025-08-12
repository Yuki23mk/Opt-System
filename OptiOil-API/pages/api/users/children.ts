/**
 * ファイルパス: OptiOil-API/pages/api/users/children.ts
 * サブアカウント取得API - セキュリティ修正版（会社分離対応と承認権限追加）
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "../../../lib/auth/jwt";
import { runMiddleware } from "../../../lib/cors";

// エラーメッセージ取得用のヘルパー関数
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return String(error);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // CORS対応
  try {
    await runMiddleware(req, res);
  } catch (error) {
    console.error('CORS middleware error:', getErrorMessage(error));
  }

  // CORSヘッダー設定
  res.setHeader('Access-Control-Allow-Origin', process.env.NEXT_PUBLIC_FRONTEND_URL!);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // プリフライトリクエスト対応
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // GETメソッドチェック
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 認証チェック
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Authorization header missing" });
    }

    const token = authHeader.split(" ")[1];
    const tokenData = verifyToken(token);

    if (!tokenData) {
      return res.status(401).json({ error: "Invalid token" });
    }

    // 現在のユーザー情報を取得
    const currentUser = await prisma.user.findUnique({
      where: { id: tokenData.id },
      select: {
        id: true,
        email: true,
        companyId: true,
        systemRole: true,
        companyRel: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (!currentUser) {
      console.error("❌ [API] User not found:", tokenData.id);
      return res.status(404).json({ error: "User not found" });
    }

    // メインアカウントチェック
    if (currentUser.systemRole !== "main") {
      return res.status(403).json({ error: "Access denied: Main account required" });
    }

    // 🔥 修正: companyIdで絞り込んでサブアカウントを取得
    const children = await prisma.user.findMany({
      where: {
        companyId: currentUser.companyId,  // ✅ 同じ会社のアカウントのみ
        systemRole: "child",               // ✅ サブアカウントのみ
        status: {
          not: "deleted"                   // ✅ 削除済みを除外
        },
        createdById: currentUser.id        // ✅ このメインアカウントが作成したもののみ
      },
      select: {
        id: true,
        email: true,
        name: true,
        department: true,
        position: true,
        phone: true,
        permissions: true,
        createdAt: true,
        status: true,
        companyId: true,  // デバッグ用に追加
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

     // permissions処理
    const processedChildren = children.map(child => {
  let permissions;
  try {
    permissions = child.permissions ? 
      (typeof child.permissions === 'string' ? JSON.parse(child.permissions) : child.permissions) 
      : {};
  } catch (e) {
    console.warn(`⚠️ [API] permissions parse error (userId: ${child.id}):`, e);
    permissions = {};
  }
  
  // 🔧 承認権限を含むデフォルト権限設定
  const defaultPermissions = {
    // 既存の画面表示権限
    products: permissions.products ?? true,
    orders: permissions.orders ?? true, 
    equipment: permissions.equipment ?? true,
    settings: permissions.settings ?? true,
    
    // 🆕 承認権限のデフォルト設定
    orderApproval: {
      canApprove: permissions.orderApproval?.canApprove ?? false,
      requiresApproval: permissions.orderApproval?.requiresApproval ?? false,
    }
  };

  const { companyId, ...childWithoutCompanyId } = child;
  return {
    ...childWithoutCompanyId,
    permissions: defaultPermissions
  };
 });

    return res.status(200).json(processedChildren);

  } catch (error) {
    console.error('❌ [API] Sub-accounts fetch error:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    return res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? getErrorMessage(error) : undefined
    });
  } finally {
    await prisma.$disconnect();
  }
}