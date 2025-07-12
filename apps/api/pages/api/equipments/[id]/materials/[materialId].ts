import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

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

// ✅ 削除済みユーザー表示用のフォーマット関数を追加
const formatUserForDisplay = (user: any) => {
  if (!user) return null;
  
  return {
    ...user,
    isDeleted: user.status === "deleted",
    displayName: user.status === "deleted" ? "削除済みアカウント" : user.name
  };
};

interface AuthRequest extends NextApiRequest {
  user?: {
    id: number;
    companyId: number;
  };
}

// CORS設定関数（他のAPIと統一）
function setCorsHeaders(res: NextApiResponse) {
  const frontendUrl = getRequiredEnvVar('NEXT_PUBLIC_FRONTEND_URL');
  
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', frontendUrl);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, Cache-Control, X-Requested-With, Origin, X-CSRF-Token');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24時間キャッシュ
}

// 認証ミドルウェア（統一版）
const authenticateUser = (req: AuthRequest): { id: number; companyId: number } => {
  const token = req.headers.authorization?.split(" ")[1];
  
  if (!token) {
    throw new Error('認証トークンがありません');
  }

  const JWT_SECRET = getRequiredEnvVar('JWT_SECRET');

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    return {
      id: decoded.id,
      companyId: decoded.companyId,
    };
  } catch (jwtError) {
    console.error('🚫 JWT検証エラー:', getErrorMessage(jwtError));
    throw new Error('無効な認証トークンです');
  }
};

export default async function handler(req: AuthRequest, res: NextApiResponse) {
  const { id: equipmentId, materialId } = req.query;

  // 🔧 CORS設定を統一
  setCorsHeaders(res);

  // OPTIONSリクエスト（プリフライト）への対応
  if (req.method === 'OPTIONS') {
    console.log("[Material Delete/Update API] OPTIONS プリフライトリクエスト受信");
    return res.status(200).end();
  }

  console.log(`[Material Delete/Update API] ${req.method} ${req.url} リクエスト受信`);

  if (!equipmentId || isNaN(Number(equipmentId)) || !materialId || isNaN(Number(materialId))) {
    return res.status(400).json({ message: '無効なIDです' });
  }

  try {
    // 統一認証
    const user = authenticateUser(req);
    req.user = user;

    // 使用資材の存在確認と権限チェック
    const material = await prisma.equipmentMaterial.findFirst({
      where: {
        id: Number(materialId),
        equipmentId: Number(equipmentId),
        companyId: user.companyId
      },
      include: {
        companyProduct: {
          include: {
            productMaster: true
          }
        },
        equipment: true
      }
    });

    if (!material) {
      return res.status(404).json({ message: '使用資材が見つかりません' });
    }

    if (req.method === 'PUT') {
      return await updateMaterial(req, res, material);
    } else if (req.method === 'DELETE') {
      return await deleteMaterial(req, res, material);
    } else {
      res.setHeader('Allow', ['PUT', 'DELETE']);
      return res.status(405).json({ message: 'Method Not Allowed' });
    }
  } catch (error) {
    console.error('[Material Delete/Update API] エラー:', getErrorMessage(error));
    
    const errorMessage = getErrorMessage(error);
    if (errorMessage.includes('認証') || errorMessage.includes('トークン')) {
      return res.status(401).json({ message: errorMessage });
    }
    
    return res.status(500).json({ 
      message: 'サーバーエラーが発生しました',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
    });
  } finally {
    await prisma.$disconnect();
  }
}

// 使用資材更新関数（既存機能完全保持）
async function updateMaterial(req: AuthRequest, res: NextApiResponse, material: any) {
  try {
    const { usagePriority, defaultQty, unit } = req.body;

    const updatedMaterial = await prisma.equipmentMaterial.update({
      where: {
        id: material.id
      },
      data: {
        usagePriority: usagePriority || null,
        defaultQty: defaultQty || null,
        unit: unit || null
      },
      include: {
        companyProduct: {
          include: {
            productMaster: true
          }
        },
        addedBy: {
          select: {
            id: true,
            name: true,
            status: true  // ✅ 削除済み判定用のstatusを追加
          }
        }
      }
    });

    const formattedMaterial = {
      id: updatedMaterial.id,
      product: {
        id: updatedMaterial.companyProduct.productMaster.id,
        code: updatedMaterial.companyProduct.productMaster.code,
        name: updatedMaterial.companyProduct.productMaster.name,
        manufacturer: updatedMaterial.companyProduct.productMaster.manufacturer,
        capacity: updatedMaterial.companyProduct.productMaster.capacity,
        unit: updatedMaterial.companyProduct.productMaster.unit,
        oilType: updatedMaterial.companyProduct.productMaster.oilType
      },
      usagePriority: updatedMaterial.usagePriority,
      defaultQty: updatedMaterial.defaultQty,
      unit: updatedMaterial.unit,
      addedBy: formatUserForDisplay(updatedMaterial.addedBy), // ✅ フォーマット関数を適用
      createdAt: updatedMaterial.createdAt.toISOString()
    };

    res.status(200).json(formattedMaterial);
  } catch (error) {
    console.error('Update material error:', getErrorMessage(error));
    res.status(500).json({ message: '使用資材の更新に失敗しました' });
  }
}

// 使用資材削除（既存機能完全保持）
async function deleteMaterial(req: AuthRequest, res: NextApiResponse, material: any) {
  try {
    await prisma.equipmentMaterial.delete({
      where: {
        id: material.id
      }
    });

    res.status(200).json({ message: '使用資材を削除しました' });
  } catch (error) {
    console.error('Delete material error:', getErrorMessage(error));
    res.status(500).json({ message: '使用資材の削除に失敗しました' });
  }
}