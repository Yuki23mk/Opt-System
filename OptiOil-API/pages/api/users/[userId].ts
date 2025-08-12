/**
 * ファイルパス: OptiOil-API/pages/api/users/[userId].ts
 * ユーザー管理API - 論理削除対応版
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../lib/prisma";
import { verifyToken } from "../../../lib/auth/jwt";
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
  setCorsHeaders(req, res);

  // OPTIONS対応（CORSプリフライト）
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const { userId } = req.query;

  // トークン取得（Bearer or Cookie）
  const bearerToken = req.headers.authorization?.split(" ")[1];
  const cookieToken = req.cookies.token;
  const token = bearerToken || cookieToken;

  if (!token) {
    return res.status(401).json({ message: "トークンがありません" });
  }

  const decoded = verifyToken(token);
  if (!decoded || typeof decoded === "string") {
    return res.status(403).json({ message: "無効なトークンです" });
  }

  const requestingUserId = decoded.id;
  const targetUserId = Number(userId);

  // main 以外のユーザーが他人を更新・削除しようとしたら拒否
  if (requestingUserId !== targetUserId && decoded.systemRole !== "main") {
    return res.status(403).json({ message: "操作が許可されていません" });
  }

  if (req.method === "PUT") {
    try {
      const {
        name,
        phone,
        department,
        position,
        permissions
      } = req.body;
      
      // 🔧 現在のユーザー情報を取得（既存の権限を保持するため）
      const currentUser = await prisma.user.findUnique({
        where: { id: targetUserId },
        select: { permissions: true, systemRole: true }
      });

      if (!currentUser) {
        return res.status(404).json({ message: "ユーザーが見つかりません" });
      }

      // 🔧 permissions の処理を簡素化（FE側で既にJSON.stringify済み）
      let processedPermissions = currentUser.permissions;

      if (permissions !== undefined && permissions !== null) {
        try {
          // 🔧 FE側でJSON.stringify()済みなので、そのままパース
          let parsedPermissions;
          if (typeof permissions === 'string') {
            parsedPermissions = JSON.parse(permissions);
          } else {
            // 既にオブジェクトの場合はそのまま使用
            parsedPermissions = permissions;
          }

          // 🔧 FE側で完全な権限オブジェクトを送信しているので、そのまま使用
          processedPermissions = parsedPermissions;
          
          console.log('🔧 [API] permissions 更新処理:');
          console.log('入力:', permissions);
          console.log('パース後:', parsedPermissions);
          console.log('最終:', processedPermissions);

        } catch (error) {
          console.error('❌ [API] permissions パースエラー:', error);
          return res.status(400).json({ 
            message: "権限データの形式が正しくありません",
            details: process.env.NODE_ENV === 'development' ? getErrorMessage(error) : undefined
          });
        }
      }
      
      const updatedUser = await prisma.user.update({
        where: { id: targetUserId },
        data: {
          ...(name !== undefined && { name }),
          ...(phone !== undefined && { phone }),
          ...(department !== undefined && { department }),
          ...(position !== undefined && { position }),
          // 🔧 Prisma Json型のキャストを追加
          ...(processedPermissions !== undefined && { 
            permissions: processedPermissions as any 
          }),
        },
        select: {
          id: true,
          email: true,
          name: true,
          department: true,
          position: true,
          phone: true,
          permissions: true,
          systemRole: true,
          createdAt: true,
        }
      });

      console.log('✅ [API] ユーザー更新成功:', {
        userId: targetUserId,
        updatedPermissions: updatedUser.permissions,
      });

      return res.status(200).json({ 
        message: "アカウント情報を更新しました", 
        user: updatedUser 
      });
      
    } catch (error) {
      console.error("❌ [API] 更新エラー:", error);
      return res.status(500).json({ 
        message: "更新に失敗しました",
        details: process.env.NODE_ENV === 'development' ? getErrorMessage(error) : undefined
      });
    }
  }

// 削除処理の修正版
  if (req.method === "DELETE") {
    try {
      // ✅ 削除対象がchildアカウントかチェック
      const targetUser = await prisma.user.findUnique({
        where: { id: targetUserId },
        select: { systemRole: true, email: true, name: true }
      });

      if (!targetUser) {
        return res.status(404).json({ message: "対象のユーザーが見つかりません" });
      }

      // ✅ 論理削除：statusを"deleted"に変更 + 削除日時と元メアドでアドレス変更
      const deletionTimestamp = new Date().toISOString().replace(/[:.]/g, '-'); // ISO形式から記号を除去
      const deletedUser = await prisma.user.update({
        where: { id: targetUserId },
        data: {
          status: "deleted",
          // ✅ メールアドレスを「deleted_削除日時_元のメアド」形式に変更
          email: `deleted_${deletionTimestamp}_${targetUser.email}`,
          // ✅ 元のメールアドレスをpermissionsフィールドにも保存（検索用）
          permissions: {
            originalEmail: targetUser.email,
            deletedAt: new Date().toISOString()
          },
        },
      });

      console.log(`✅ ユーザー ${targetUserId} (${targetUser.name}) を論理削除しました（注文履歴・データは保持）`);
      console.log(`📧 元メールアドレス: ${targetUser.email} -> deleted_${deletionTimestamp}_${targetUser.email}`);
      
      return res.status(200).json({ 
        message: "アカウントを削除しました（注文履歴・データは保持されます）",
        deletedUserId: targetUserId,
        deletedUserName: targetUser.name
      });
    } catch (error) {
      console.error("削除エラー:", error);
      return res.status(500).json({ message: "削除に失敗しました" });
    }
  }

  return res.status(405).json({ message: "許可されていないメソッドです" });
}