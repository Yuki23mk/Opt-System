/**
 * ファイルパス: OptiOil-API/pages/api/admin/orders/[id]/documents.ts
 * 管理者用 - 納品書・受領書作成・管理API
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { runMiddleware } from '../../../../../lib/cors'; // 🔧 追加
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // 🔧 既存のCORSライブラリを使用
    try {
      await runMiddleware(req, res);
    } catch (corsError) {
      console.error('❌ CORS エラー:', corsError);
      return res.status(403).json({ error: 'CORS policy violation' });
    }

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    // 管理者JWT認証
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: '管理者トークンが必要です' });
    }

    const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET;
    if (!ADMIN_JWT_SECRET) {
      throw new Error('ADMIN_JWT_SECRET環境変数が設定されていません');
    }
        
    let decoded: any;
    try {
      decoded = jwt.verify(token, ADMIN_JWT_SECRET);
    } catch (error) {
      return res.status(401).json({ error: '無効な管理者トークンです' });
    }

    const adminId = decoded.id;
    const { id } = req.query;
    
    if (!id || isNaN(Number(id))) {
      return res.status(400).json({ error: '有効な注文IDが必要です' });
    }

    const orderId = Number(id);

    if (req.method === 'GET') {
      // 注文に紐づく書類一覧取得
      const paperwork = await prisma.orderPaperwork.findMany({
        where: { orderId },
        include: {
          createdBy: {
            select: {
              id: true,
              username: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      console.log(`📄 注文${orderId}の書類取得: ${paperwork.length}件`);
      return res.status(200).json(paperwork);

    } else if (req.method === 'POST') {
      // ドキュメント作成
      const { documentType, deliveryDate } = req.body;

      if (!['delivery_note', 'receipt'].includes(documentType)) {
        return res.status(400).json({ error: '無効なドキュメントタイプです' });
      }

      // 注文存在確認
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          user: {
            include: {
              companyRel: true
            }
          },
          orderItems: {
            include: {
              companyProduct: {
                include: {
                  productMaster: true
                }
              }
            }
          }
        }
      });

      if (!order) {
        return res.status(404).json({ error: '注文が見つかりません' });
      }

      // 既存書類チェック
      const existingPaperwork = await prisma.orderPaperwork.findUnique({
        where: {
          orderId_documentType: {
            orderId,
            documentType
          }
        }
      });

      if (existingPaperwork) {
        return res.status(400).json({ error: 'このタイプの書類は既に作成されています' });
      }

      // 書類番号生成
      const today = new Date();
      const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
      const prefix = documentType === 'delivery_note' ? 'DN' : 'RC';
      
      const paperworkCount = await prisma.orderPaperwork.count({
        where: {
          documentType,
          createdAt: {
            gte: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
            lt: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
          }
        }
      });

      const documentNumber = `${prefix}${dateStr}-${String(paperworkCount + 1).padStart(4, '0')}`;

      // 書類作成
      const paperwork = await prisma.orderPaperwork.create({
        data: {
          orderId,
          documentType,
          documentNumber,
          deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
          createdById: adminId,
          status: 'draft'
        },
        include: {
          order: {
            include: {
              user: {
                include: {
                  companyRel: true
                }
              },
              orderItems: {
                include: {
                  companyProduct: {
                    include: {
                      productMaster: true
                    }
                  }
                }
              }
            }
          },
          createdBy: {
            select: {
              id: true,
              username: true
            }
          }
        }
      });

      // PDF生成（後で実装予定）
      // await generateDocumentPDF(paperwork);

      console.log(`📄 書類作成成功: ${documentNumber} (${documentType})`);
      return res.status(201).json({
        message: '書類を作成しました',
        paperwork
      });

    } else if (req.method === 'PUT') {
      // 書類更新（承認処理など）
      const { documentId, action, approvedBy } = req.body;

      if (!documentId) {
        return res.status(400).json({ error: '書類IDが必要です' });
      }

      const paperwork = await prisma.orderPaperwork.findUnique({
        where: { id: documentId }
      });

      if (!paperwork) {
        return res.status(404).json({ error: '書類が見つかりません' });
      }

      if (paperwork.orderId !== orderId) {
        return res.status(400).json({ error: '指定された注文の書類ではありません' });
      }

      let updateData: any = {};

      if (action === 'approve' && paperwork.documentType === 'receipt') {
        updateData = {
          isApproved: true,
          approvedAt: new Date(),
          approvedBy: approvedBy || 'システム管理者'
        };
      } else if (action === 'finalize') {
        updateData = {
          status: 'finalized'
        };
      }

      const updatedPaperwork = await prisma.orderPaperwork.update({
        where: { id: documentId },
        data: updateData
      });

      console.log(`📄 書類更新: ${paperwork.documentNumber} (${action})`);
      return res.status(200).json({
        message: '書類を更新しました',
        paperwork: updatedPaperwork
      });

    } else {
      res.setHeader('Allow', ['GET', 'POST', 'PUT']);
      return res.status(405).json({ error: 'メソッドが許可されていません' });
    }

  } catch (error) {
    console.error('❌ ドキュメント管理API エラー:', error);
    return res.status(500).json({ error: 'サーバーエラーが発生しました' });
  } finally {
    await prisma.$disconnect();
  }
}