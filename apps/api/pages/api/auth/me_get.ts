/**
 * ファイルパス: OptiOil-API/pages/api/auth/me_get.ts
 * ユーザー情報取得API（権限データ対応版）
 */

import { verifyToken } from "../../../lib/auth/jwt";
import { prisma } from "@/lib/prisma";
import { NextApiRequest, NextApiResponse } from "next";
import { runMiddleware } from "../../../lib/cors";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await runMiddleware(req, res); // CORS対応

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Authorizationヘッダー or Cookie からトークン取得
    const bearerToken = req.headers.authorization?.split(" ")[1];
    const cookieToken = req.cookies.token;
    const token = bearerToken || cookieToken;

    if (!token) {
      return res.status(401).json({ error: "No token provided" });
    }

    // トークン検証
    const decoded = verifyToken(token);
    if (!decoded || !decoded.id) {
      return res.status(401).json({ error: "Invalid token" });
    }

    // ユーザー情報を取得
    const userData = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        name: true,
        department: true,
        position: true,
        phone: true,
        systemRole: true,
        companyId: true,
        permissions: true, // ★★★ 重要：権限データを取得
        status: true,
        companyRel: {
          select: { name: true }
        }
      }
    });

    if (!userData) {
      return res.status(404).json({ error: "User not found" });
    }

    // ★★★ 権限データの処理
    let processedPermissions = null;
    if (userData.permissions) {
      try {
        // JSONかオブジェクトかを判定してパース
        processedPermissions = typeof userData.permissions === 'string' 
          ? JSON.parse(userData.permissions) 
          : userData.permissions;
      } catch (e) {
        console.warn('権限データのパースに失敗:', e);
        // パースに失敗した場合はnullにする
        processedPermissions = null;
      }
    }

    // レスポンスデータ
    const responseData = {
      user: {
        id: userData.id,
        email: userData.email,
        name: userData.name,
        department: userData.department,
        position: userData.position,
        phone: userData.phone,
        systemRole: userData.systemRole,
        companyId: userData.companyId,
        company: userData.companyRel?.name || null,
        permissions: processedPermissions, // ★★★ 権限データを追加
        status: userData.status
      }
    };

    // デバッグログ（本番環境では削除推奨）
    console.log('📤 [API] me_get レスポンス:', {
      userId: userData.id,
      email: userData.email,
      systemRole: userData.systemRole,
      permissions: processedPermissions
    });

    return res.status(200).json(responseData);

  } catch (error) {
    console.error('❌ [API] me_get エラー:', error);
    return res.status(500).json({ error: "Internal server error" });
  }
}