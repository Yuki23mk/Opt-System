// OptiOil-API/pages/api/equipments/[equipmentId]/materials/index.ts (TypeScriptエラー修正版)
import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

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

// 🆕 認証エラー判定用の関数
function isAuthError(error: unknown): boolean {
  const message = getErrorMessage(error);
  return message.includes('認証') || message.includes('トークン');
}

// CORS設定関数（他のAPIと統一）
function setCorsHeaders(res: NextApiResponse) {
  const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL;
  
  if (!frontendUrl) {
    throw new Error('NEXT_PUBLIC_FRONTEND_URL環境変数が設定されていません。本番環境では必須です。');
  }
  
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', frontendUrl);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, Cache-Control, X-Requested-With, Origin, X-CSRF-Token');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24時間キャッシュ
}

// 統一認証関数
function verifyToken(req: NextApiRequest) {
  const token = req.headers.authorization?.split(" ")[1];
  
  if (!token) {
    throw new Error('認証トークンがありません');
  }

  const JWT_SECRET = process.env.JWT_SECRET;
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET環境変数が設定されていません');
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    return {
      id: decoded.id,
      companyId: decoded.companyId,
      email: decoded.email,
    };
  } catch (jwtError) {
    console.error('🚫 JWT検証エラー:', jwtError);
    throw new Error('無効な認証トークンです');
  }
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id: equipmentId } = req.query;

  // CORS設定（統一版）
  setCorsHeaders(res);

  // OPTIONSリクエスト（プリフライト）への対応
  if (req.method === 'OPTIONS') {
    console.log("[Equipment Materials API] OPTIONS プリフライトリクエスト受信");
    return res.status(200).end();
  }

  console.log(`[Equipment Materials API] ${req.method} ${req.url} リクエスト受信`);

  if (!equipmentId || isNaN(Number(equipmentId))) {
    return res.status(400).json({ message: '無効な設備IDです' });
  }

  try {
    // 統一認証
    const user = verifyToken(req);
    console.log('✅ 認証成功 - ユーザー:', user.id, '会社:', user.companyId);

    // 設備の存在確認と権限チェック
    const equipment = await prisma.equipment.findFirst({
      where: {
        id: Number(equipmentId),
        companyId: user.companyId,
      },
    });

    if (!equipment) {
      return res.status(404).json({ message: '設備が見つかりません' });
    }

    if (req.method === 'GET') {
      console.log('📋 使用資材取得開始');
      
      // 使用資材を取得（タグ情報も含む）
      const materials = await prisma.equipmentMaterial.findMany({
        where: {
          equipmentId: Number(equipmentId),
          companyId: user.companyId,
        },
        include: {
          addedBy: {
            select: {
              id: true,
              name: true,
              status: true  // ✅ 削除済み判定用のstatusを追加
            }
          },
          companyProduct: {
            include: {
              productMaster: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  manufacturer: true,
                  capacity: true,
                  unit: true,
                  oilType: true,
                  // タグ情報を含める
                  userTags: {
                    where: {
                      companyId: user.companyId
                    },
                    include: {
                      user: {
                        select: {
                          id: true,
                          name: true,
                          status: true  // ✅ タグ作成者の削除済み判定用
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        orderBy: [
          { usagePriority: 'asc' },
          { createdAt: 'desc' }
        ]
      });

      // レスポンス形式を調整（MaterialsTab.tsxの期待する形式に合わせる）
      const formattedMaterials = materials.map(material => ({
        id: material.id,
        product: {
          id: material.companyProduct?.productMaster?.id || 0,
          code: material.companyProduct?.productMaster?.code || '',
          name: material.companyProduct?.productMaster?.name || '',
          manufacturer: material.companyProduct?.productMaster?.manufacturer || '',
          capacity: material.companyProduct?.productMaster?.capacity || '',
          unit: material.companyProduct?.productMaster?.unit || '',
          oilType: material.companyProduct?.productMaster?.oilType || '',
        },
        companyProduct: material.companyProduct ? {
          id: material.companyProduct.id,
          enabled: material.companyProduct.enabled,
          price: material.companyProduct.price,
        } : null,
        usagePriority: material.usagePriority,
        defaultQty: material.defaultQty,
        unit: material.unit,
        addedBy: formatUserForDisplay(material.addedBy), // ✅ フォーマット関数を適用
        createdAt: material.createdAt.toISOString(),
        // タグ情報を追加（タグ作成者も削除済み対応）
        userTags: material.companyProduct?.productMaster?.userTags?.map(tag => ({
          id: tag.id,
          name: tag.name,
          color: tag.color,
          createdBy: formatUserForDisplay(tag.user)?.displayName || '', // ✅ タグ作成者も対応
          createdById: tag.user?.id || 0,
          createdAt: tag.createdAt.toISOString()
        })) || []
      }));

      console.log('✅ 使用資材取得完了:', formattedMaterials.length, '件');
      return res.status(200).json(formattedMaterials);

    } else if (req.method === 'POST') {
      console.log('📋 使用資材追加開始');
      const { companyProductId, usagePriority } = req.body;
      
      if (!companyProductId) {
        return res.status(400).json({ message: 'CompanyProduct IDが必要です' });
      }

      // CompanyProductの存在確認
      const companyProduct = await prisma.companyProduct.findFirst({
        where: {
          id: companyProductId,
          companyId: user.companyId,
        },
        include: {
          productMaster: true
        }
      });

      if (!companyProduct) {
        return res.status(404).json({ message: '指定された製品が見つかりません' });
      }

      // 重複チェック
      const existingMaterial = await prisma.equipmentMaterial.findFirst({
        where: {
          equipmentId: Number(equipmentId),
          companyProductId: companyProductId,
        },
      });

      if (existingMaterial) {
        return res.status(409).json({ message: 'この資材は既に追加されています' });
      }

      // 使用資材を追加
      const newMaterial = await prisma.equipmentMaterial.create({
        data: {
          equipmentId: Number(equipmentId),
          companyProductId: companyProductId,
          addedByUserId: user.id,
          companyId: user.companyId,
          usagePriority: usagePriority || null,
        },
        include: {
          addedBy: {
            select: {
              id: true,
              name: true,
              status: true
            }
          },
          companyProduct: {
            include: {
              productMaster: true
            }
          }
        }
      });

      console.log('✅ 使用資材追加完了:', {
        materialId: newMaterial.id,
        productName: newMaterial.companyProduct?.productMaster?.name
      });

      return res.status(201).json({
        message: '使用資材が追加されました',
        material: {
          ...newMaterial,
          addedBy: formatUserForDisplay(newMaterial.addedBy)
        }
      });

    } else {
      res.setHeader('Allow', ['GET', 'POST']);
      return res.status(405).json({ message: 'Method Not Allowed' });
    }

  } catch (error) {
    console.error('[Equipment Materials API] エラー:', error);
    
    // ✅ 修正：型安全なエラーハンドリング
    if (isAuthError(error)) {
      return res.status(401).json({ message: getErrorMessage(error) });
    }
    
    return res.status(500).json({ 
      message: 'サーバーエラーが発生しました',
      details: process.env.NODE_ENV === 'development' ? getErrorMessage(error) : undefined
    });
  } finally {
    await prisma.$disconnect();
  }
}