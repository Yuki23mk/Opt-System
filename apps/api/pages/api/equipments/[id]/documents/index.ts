//ファイル: /api/equipments/[id]/documents/index.ts
// ファイル取得,登録のAPI
import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from "../../../../../lib/prisma";
import { verifyToken } from "../../../../../lib/auth/jwt";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import busboy from "busboy";
import iconv from "iconv-lite";

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

// ✅ Busboy型定義の修正
interface BusboyFileInfo {
  filename: string;
  encoding: string;
  mimeType: string;
}

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

  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }
    
    const user = verifyToken(token);
    if (!user || !user.id || !user.companyId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const equipmentId = parseInt(req.query.id as string, 10);
    if (isNaN(equipmentId)) {
      return res.status(400).json({ message: "Invalid equipment ID" });
    }

    // 設備の存在確認と権限チェックを追加
    const equipment = await prisma.equipment.findFirst({
      where: {
        id: equipmentId,
        companyId: user.companyId
      }
    });

    if (!equipment) {
      return res.status(404).json({ message: "Equipment not found" });
    }

    // ✅ 削除済みユーザー表示用のフォーマット関数
    const formatUserForDisplay = (user: any) => {
      if (!user) return null;
      
      return {
        ...user,
        isDeleted: user.status === "deleted",
        displayName: user.status === "deleted" ? "削除済みアカウント" : user.name
      };
    };

    if (req.method === "GET") {
      // 一覧取得
      const documents = await prisma.equipmentDocument.findMany({
        where: { 
          equipmentId,
          companyId: user.companyId // 権限チェック追加
        },
        include: { 
          uploadedBy: {
            select: {
              id: true,
              name: true,
              status: true  // ✅ 削除済み判定用のstatusを追加
            }
          }
        },
        orderBy: { createdAt: "desc" },
      });

      return res.status(200).json(
        documents.map(doc => ({
          id: doc.id,
          fileName: doc.filename, 
          storedFilename: doc.storedFilename,
          uploadedBy: formatUserForDisplay(doc.uploadedBy), // ✅ フォーマット関数を適用
          uploadedAt: doc.createdAt.toISOString(), // ✅ 修正: createdAtを使用          
          fileUrl: `/uploads/${doc.storedFilename}`,
          size: doc.size, // 追加
          mimeType: doc.mimeType, // 追加
        }))
      );
    }

    if (req.method === "POST") {
      // ✅ アップロード処理 ※開発環境では、BEのpublic/uploadsのファイルをFEのpublic/uploadsへ移す必要あり（閲覧とDLを動作させるため）
      const bb = busboy({ headers: req.headers }); // ✅ 修正: busboyの初期化方法を修正
      const uploadsDir = path.join(process.cwd(), "public", "uploads");
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      let savedFileInfo: { 
        filename: string; 
        storedFilename: string; 
        size: number; 
        mimeType: string; 
      } = {
        filename: "",
        storedFilename: "",
        size: 0,
        mimeType: "",
      };

      bb.on("file", (fieldname: string, file: NodeJS.ReadableStream, info: BusboyFileInfo) => { // ✅ 型定義を追加
        // 以下、日本語の文字化け防止。info.filename が Buffer型 or 文字化けしたstringの場合
        let filename = info.filename;
        // もしlatin1っぽかったら強制変換
        if (typeof filename === "string") {
          // latin1→utf8で再デコード
          filename = iconv.decode(Buffer.from(filename, "binary"), "utf-8");
        }

        const ext = path.extname(filename);
        const storedFilename = uuidv4() + ext;
        const savePath = path.join(uploadsDir, storedFilename);

        savedFileInfo = { 
          filename, 
          storedFilename,
          size: 0,
          mimeType: info.mimeType || 'application/octet-stream'
        };

        const writeStream = fs.createWriteStream(savePath);
        file.pipe(writeStream);

        // ファイルサイズを計算
        file.on('data', (chunk: Buffer) => {
          savedFileInfo.size += chunk.length;
        });
      });

      bb.on("finish", async () => {
        if (!savedFileInfo.filename) {
          return res.status(400).json({ message: "No file uploaded" });
        }

        try {
          const newDoc = await prisma.equipmentDocument.create({
            data: {
              filename: savedFileInfo.filename,
              storedFilename: savedFileInfo.storedFilename,
              uploadedById: user.id,
              equipmentId,
              companyId: user.companyId,
              size: savedFileInfo.size, // 追加
              mimeType: savedFileInfo.mimeType, // 追加
            },
            include: {
              uploadedBy: true,
              equipment: true,
              company: true,
            },
          });

          return res.status(200).json({
            id: newDoc.id,
            fileName: newDoc.filename,
            storedFilename: newDoc.storedFilename,
            uploadedBy: { name: newDoc.uploadedBy.name },
            uploadedAt: newDoc.createdAt.toISOString(), // ✅ 修正: toISOString()を追加
            fileUrl: `/uploads/${newDoc.storedFilename}`,
            size: newDoc.size,
            mimeType: newDoc.mimeType,
          });
        } catch (err) {
          console.error("DB保存失敗:", getErrorMessage(err));
          return res.status(500).json({ message: "DB error" });
        }
      });

      req.pipe(bb); // ✅ 修正: bbを使用
      return;
    }

    return res.status(405).json({ message: "Method Not Allowed" });

  } catch (error) {
    console.error("API Error:", getErrorMessage(error));
    return res.status(500).json({ 
      message: getErrorMessage(error),
      details: process.env.NODE_ENV === 'development' ? getErrorMessage(error) : undefined
    });
  } finally {
    await prisma.$disconnect();
  }
}