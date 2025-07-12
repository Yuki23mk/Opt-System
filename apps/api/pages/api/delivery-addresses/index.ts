// ファイル: OptiOil-API/pages/api/delivery-addresses/index.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

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

// グローバルなPrismaインスタンス管理
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// CORS設定関数
function setCorsHeaders(res: NextApiResponse) {
  const frontendUrl = getRequiredEnvVar('NEXT_PUBLIC_FRONTEND_URL');
  
  res.setHeader('Access-Control-Allow-Origin', frontendUrl);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, Cache-Control, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24時間キャッシュ
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // 🔧 統一されたCORS設定
    setCorsHeaders(res);

    // プリフライトリクエストの処理
    if (req.method === 'OPTIONS') {
      console.log('🔄 CORS プリフライトリクエスト処理');
      return res.status(200).end();
    }

    console.log('🚚 配送先API呼び出し:', { 
      method: req.method, 
      origin: req.headers.origin,
      userAgent: req.headers['user-agent']?.substring(0, 50) 
    });

    // JWT認証
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('🚫 認証ヘッダーが無効:', authHeader);
      return res.status(401).json({ error: 'Bearer トークンが必要です' });
    }

    const token = authHeader.replace('Bearer ', '');
    if (!token) {
      console.log('🚫 トークンが空です');
      return res.status(401).json({ error: 'トークンが必要です' });
    }

    const JWT_SECRET = getRequiredEnvVar('JWT_SECRET');
    let decoded: any;
    
    try {
      decoded = jwt.verify(token, JWT_SECRET) as any;
      console.log('✅ JWT認証成功:', { userId: decoded.id, companyId: decoded.companyId });
    } catch (jwtError) {
      console.error('🚫 JWT認証失敗:', jwtError);
      return res.status(401).json({ error: 'トークンが無効です' });
    }

    const userId = decoded.id;
    const companyId = decoded.companyId;

    if (req.method === 'GET') {
      try {
        console.log('📋 配送先一覧取得開始:', { userId, companyId });
        
        // ★★★ 変更: 会社レベルで配送先を共有 ★★★
        const addresses = await prisma.address.findMany({
          where: {
            User: {
              companyId: companyId  // 同じ会社の全ユーザーの配送先を取得
            }
          },
          include: {
            User: {
              select: {
                id: true,
                name: true,
                status: true  // 削除済みユーザー判定用
              }
            }
          },
          orderBy: [
            { isDefault: 'desc' }, // デフォルトを最初に
            { createdAt: 'desc' }
          ]
        });

        console.log(`✅ 配送先取得完了: ${addresses.length}件`);
        console.log('📋 取得データ:', addresses.map(addr => ({ 
          id: addr.id, 
          name: addr.name, 
          isDefault: addr.isDefault,
          createdBy: addr.User.name
        })));

        return res.status(200).json(addresses);

      } catch (dbError) {
        console.error('❌ データベースエラー:', getErrorMessage(dbError));
        return res.status(500).json({ error: 'データベースエラーが発生しました' });
      }

    } else if (req.method === 'POST') {
      try {
        // 配送先追加
        const { name, company, zipCode, prefecture, city, address1, address2, phone, isDefault } = req.body;

        console.log('📝 配送先追加開始:', { name, zipCode, isDefault });

        if (!name || !zipCode || !address1) {
          return res.status(400).json({ error: '必須項目が不足しています（name, zipCode, address1）' });
        }

        // ★★★ 変更: デフォルト設定の場合、同じ会社の他のデフォルトを解除 ★★★
        if (isDefault) {
          console.log('🔄 他のデフォルト設定を解除中...');
          await prisma.address.updateMany({
            where: { 
              User: {
                companyId: companyId
              }
            },
            data: { isDefault: false }
          });
        }

        const newAddress = await prisma.address.create({
          data: {
            userId: userId,  // 作成者として記録
            name,
            company: company || null,
            zipCode,
            prefecture: prefecture || '',
            city: city || '',
            address1,
            address2: address2 || null,
            phone: phone || null,
            isDefault: isDefault || false,
          },
        });

        console.log('✅ 配送先追加成功:', { id: newAddress.id, name: newAddress.name });
        return res.status(201).json(newAddress);

      } catch (dbError) {
        console.error('❌ 配送先追加エラー:', getErrorMessage(dbError));
        return res.status(500).json({ error: '配送先の追加に失敗しました' });
      }

    } else {
      console.log('🚫 許可されていないメソッド:', req.method);
      res.setHeader('Allow', ['GET', 'POST']);
      return res.status(405).json({ error: `メソッド ${req.method} は許可されていません` });
    }

  } catch (error) {
    console.error('❌ 配送先API 予期しないエラー:', getErrorMessage(error));
    return res.status(500).json({ 
      error: 'サーバーエラーが発生しました',
      details: process.env.NODE_ENV === 'development' ? getErrorMessage(error) : undefined
    });
  } finally {
    // 本番環境では接続を切断
    if (process.env.NODE_ENV === "production") {
      await prisma.$disconnect();
    }
  }
}