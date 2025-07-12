/**
 * ファイルパス: OptiOil-API/pages/api/users/children.ts (TypeScriptエラー修正版)
 * サブアカウント取得API（既存機能保持 + 論理削除対応版）
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../lib/prisma";
import { verifyToken } from "../../../lib/auth/jwt";
import { runMiddleware } from "../../../lib/cors";

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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // ✅ 既存のCORS対応を保持
  try {
    await runMiddleware(req, res);
  } catch (error) {
    console.error('CORS middleware error:', getErrorMessage(error)); // ✅ 型安全な修正
  }

  // ✅ 既存の手動CORSヘッダー設定を保持（Non-null assertion追加）
  res.setHeader('Access-Control-Allow-Origin', process.env.NEXT_PUBLIC_FRONTEND_URL!); // ✅ Non-null assertion
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // ✅ 既存のプリフライトリクエスト対応を保持
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // ✅ 既存のGETメソッドチェックを保持
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // ✅ 既存の認証チェックを保持
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Authorization header missing" });
    }

    const token = authHeader.split(" ")[1];
    const user = verifyToken(token);

    console.log("🔍 [API] セッション中身:", user);

    if (!user) {
      return res.status(401).json({ error: "Invalid token" });
    }

    // ✅ 既存のメインアカウントチェックを保持
    if (user.systemRole !== "main") {
      return res.status(403).json({ error: "Access denied: Main account required" });
    }

    // ✅ サブアカウント取得（論理削除対応追加）
    const children = await prisma.user.findMany({
      where: {
        createdById: user.userId, // ★ 既存：メインアカウントが作成したサブアカウントのみ
        systemRole: "child",      // ★ 既存：child ロール
        status: {
          not: "deleted"          // ✅ 新規追加：削除済みを除外
        }
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
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`📋 [API] 取得したサブアカウント数: ${children.length}`);

    // ✅ 既存のpermissions処理を保持
    const processedChildren = children.map(child => {
      let permissions;
      try {
        // permissionsがstring型の場合はJSON.parse、objectの場合はそのまま使用
        permissions = child.permissions ? 
          (typeof child.permissions === 'string' ? JSON.parse(child.permissions) : child.permissions) 
          : {};
      } catch (e) {
        console.warn(`⚠️ [API] permissions パースエラー (userId: ${child.id}):`, getErrorMessage(e)); // ✅ 型安全な修正
        permissions = {};
      }
      
      // ✅ 既存のデフォルト権限設定を保持（settingsを追加）
      const defaultPermissions = {
        products: permissions.products ?? true,
        orders: permissions.orders ?? true, 
        equipment: permissions.equipment ?? true,
        settings: permissions.settings ?? true, // ✅ 新規追加
      };

      return {
        ...child,
        permissions: defaultPermissions
      };
    });

    console.log(`✅ [API] 処理済みサブアカウント:`, processedChildren.map(c => ({
      id: c.id,
      email: c.email,
      permissions: c.permissions
    })));

    return res.status(200).json(processedChildren);

  } catch (error) {
    console.error('❌ [API] サブアカウント取得エラー:', getErrorMessage(error)); // ✅ 型安全な修正
    return res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? getErrorMessage(error) : undefined
    });
  } finally {
    await prisma.$disconnect();
  }
}