//ファイルの削除API
import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from "../../../../../lib/prisma";
import fs from "fs";
import path from "path";
import { verifyToken } from "../../../../../lib/auth/jwt";

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

export const config = {
  api: {
    bodyParser: false,
  },
};

// CORS対応関数を追加
function setCorsHeaders(res: NextApiResponse) {
  const frontendUrl = getRequiredEnvVar('NEXT_PUBLIC_FRONTEND_URL');
  
  res.setHeader('Access-Control-Allow-Origin', frontendUrl);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // CORS対応
  setCorsHeaders(res);

  // OPTIONSリクエスト（プリフライト）への対応
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== "DELETE") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }
    
    const user = verifyToken(token);
    if (!user || !user.id || !user.companyId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const documentId = parseInt(req.query.documentId as string);
    const equipmentId = parseInt(req.query.id as string);
    
    if (isNaN(documentId) || isNaN(equipmentId)) {
      return res.status(400).json({ message: "Invalid document or equipment ID" });
    }

    // 文書の存在確認と権限チェック強化
    const doc = await prisma.equipmentDocument.findFirst({
      where: { 
        id: documentId,
        equipmentId: equipmentId,
        companyId: user.companyId // 権限チェック追加
      },
    });

    if (!doc) {
      return res.status(404).json({ message: "Document not found" });
    }

    // ファイルを物理削除
    if (doc.storedFilename) {
      const filePath = path.join(process.cwd(), "public", "uploads", doc.storedFilename);
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (fileError) {
        console.warn("ファイルの物理削除に失敗:", getErrorMessage(fileError));
        // ファイルが存在しない場合も処理を続行
      }
    }

    // DBから削除
    await prisma.equipmentDocument.delete({
      where: { id: documentId },
    });

    res.status(200).json({ message: "Document deleted successfully" });

  } catch (error) {
    console.error("Delete API Error:", getErrorMessage(error));
    return res.status(500).json({ 
      message: getErrorMessage(error),
      details: process.env.NODE_ENV === 'development' ? getErrorMessage(error) : undefined
    });
  } finally {
    await prisma.$disconnect();
  }
}