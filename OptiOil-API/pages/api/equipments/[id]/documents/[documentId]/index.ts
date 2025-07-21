import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from "../../../../../../lib/prisma";
import { verifyToken } from "../../../../../../lib/auth/jwt";
import { deleteFile } from "../../../../../../utils/s3";

// 型安全エラーハンドリング関数
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown error occurred';
}

export const config = {
  api: {
    bodyParser: false,
  },
};

// CORS対応関数
function setCorsHeaders(res: NextApiResponse) {
  res.setHeader('Access-Control-Allow-Origin', process.env.NEXT_PUBLIC_FRONTEND_URL!);
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

    // 文書の存在確認と権限チェック
    const doc = await prisma.equipmentDocument.findFirst({
      where: { 
        id: documentId,
        equipmentId: equipmentId,
        companyId: user.companyId
      },
    });

    if (!doc) {
      return res.status(404).json({ message: "Document not found" });
    }

    console.log('📋 設備文書削除:', {
      documentId,
      filename: doc.filename,
      equipmentId,
      s3Url: doc.s3Url
    });

    // S3ファイルの削除処理
    if (doc.s3Url) {
      try {
        // S3 URLからキーを抽出
        const url = new URL(doc.s3Url);
        const s3Key = decodeURIComponent(url.pathname.substring(1));
        
        console.log('🗑️ S3削除開始:', s3Key);
        await deleteFile(s3Key);
        console.log('✅ S3ファイル削除完了:', s3Key);
      } catch (s3Error) {
        console.error('❌ S3ファイル削除エラー:', s3Error);
        // S3削除に失敗してもDBからは削除する
      }
    }

    // DBから削除
    await prisma.equipmentDocument.delete({
      where: { id: documentId },
    });

    console.log('✅ DB削除完了');

    res.status(200).json({ 
      message: "Document deleted successfully",
      success: true 
    });

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