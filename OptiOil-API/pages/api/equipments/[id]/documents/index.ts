//ファイル: /api/equipments/[id]/documents/index.ts
// ファイル取得,登録のAPI
import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from "../../../../../lib/prisma";
import { verifyToken } from "../../../../../lib/auth/jwt";
import busboy from "busboy";
import iconv from "iconv-lite";
import { uploadFile } from "../../../../../utils/s3";

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

// Busboy型定義
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

    // 設備の存在確認と権限チェック
    const equipment = await prisma.equipment.findFirst({
      where: {
        id: equipmentId,
        companyId: user.companyId
      }
    });

    if (!equipment) {
      return res.status(404).json({ message: "Equipment not found" });
    }

    // 削除済みユーザー表示用のフォーマット関数
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
          companyId: user.companyId
        },
        include: { 
          uploadedBy: {
            select: {
              id: true,
              name: true,
              status: true
            }
          }
        },
        orderBy: { createdAt: "desc" },
      });

      // ダウンロードURLを付与
      const documentsWithUrls = documents.map(doc => ({
        id: doc.id,
        fileName: doc.filename,
        storedFilename: doc.storedFilename,
        uploadedBy: formatUserForDisplay(doc.uploadedBy),
        uploadedAt: doc.createdAt.toISOString(),
        fileUrl: `${process.env.NEXT_PUBLIC_API_URL}/api/equipments/${equipmentId}/documents/${doc.id}/download`,
        size: doc.size,
        mimeType: doc.mimeType,
        s3Url: doc.s3Url
      }));

      return res.status(200).json(documentsWithUrls);
    }

    if (req.method === "POST") {
      // アップロード処理
      const bb = busboy({ headers: req.headers });

      let fileBuffer: Buffer[] = [];
      let fileInfo: BusboyFileInfo | null = null;

      bb.on("file", (fieldname: string, file: NodeJS.ReadableStream, info: BusboyFileInfo) => {
        // 日本語の文字化け防止処理
        let filename = info.filename;
        
        // latin1エンコーディングされている場合の対処
        if (typeof filename === "string") {
          // latin1→utf8で再デコード
          filename = iconv.decode(Buffer.from(filename, "binary"), "utf-8");
        }

        fileInfo = {
          ...info,
          filename // 修正されたファイル名を使用
        };
        
        // ファイルをバッファに読み込む
        file.on('data', (chunk: Buffer) => {
          fileBuffer.push(chunk);
        });
      });

      bb.on("finish", async () => {
        if (!fileInfo || fileBuffer.length === 0) {
          return res.status(400).json({ message: "No file uploaded" });
        }

        try {
          const fullBuffer = Buffer.concat(fileBuffer);
          
          let s3Url: string | null = null;

          // S3アップロード処理
          try {
            console.log('📤 S3へのアップロード開始:', {
              filename: fileInfo.filename,
              size: fullBuffer.length,
              mimeType: fileInfo.mimeType
            });
            
            const s3Result = await uploadFile(
              'equipment-docs',
              fileInfo.filename,
              fullBuffer,
              fileInfo.mimeType || 'application/octet-stream'
            );
            
            s3Url = s3Result.s3Url;
            
            console.log('✅ S3アップロード成功:', {
              s3Url,
              originalName: fileInfo.filename
            });
            
          } catch (s3Error) {
            console.error('❌ S3アップロードエラー:', s3Error);
            throw new Error('ファイルのアップロードに失敗しました');
          }

          // データベースに保存
          const newDoc = await prisma.equipmentDocument.create({
            data: {
              filename: fileInfo.filename,
              storedFilename: null, // S3使用時はnull
              s3Url: s3Url,
              mimeType: fileInfo.mimeType || 'application/octet-stream',
              size: fullBuffer.length,
              uploadedById: user.id,
              equipmentId,
              companyId: user.companyId,
            },
            include: {
              uploadedBy: {
                select: {
                  id: true,
                  name: true,
                  status: true
                }
              },
              equipment: true,
              company: true,
            },
          });

          return res.status(200).json({
            id: newDoc.id,
            fileName: newDoc.filename,
            storedFilename: newDoc.storedFilename,
            uploadedBy: formatUserForDisplay(newDoc.uploadedBy),
            uploadedAt: newDoc.createdAt.toISOString(),
            fileUrl: `${process.env.NEXT_PUBLIC_API_URL}/api/equipments/${equipmentId}/documents/${newDoc.id}/download`,
            size: newDoc.size,
            mimeType: newDoc.mimeType,
          });
        } catch (err) {
          console.error("アップロード処理エラー:", getErrorMessage(err));
          return res.status(500).json({ 
            message: getErrorMessage(err) 
          });
        }
      });

      bb.on('error', (error) => {
        console.error('Busboy エラー:', error);
        return res.status(500).json({ 
          message: 'ファイル処理中にエラーが発生しました' 
        });
      });

      req.pipe(bb);
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