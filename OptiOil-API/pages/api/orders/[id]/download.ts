/**
 * ファイルパス: OptiOil-API/pages/api/orders/[id]/download.ts
 * 注文書類ダウンロードAPI（orders配下版）
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
const prisma = new PrismaClient();

// PDF生成関数（HTMLテンプレートベース）
const generatePaperworkHTML = (paperwork: any, order: any) => {
  const isDeliveryNote = paperwork.documentType === 'delivery_note';
  const title = isDeliveryNote ? '納品書' : '受領書';
  
  const companyInfo = {
    name: '有限会社丸一機料商会',
    address: '720-2124 広島県福山市神辺町川南1365',
    phone: '084-962-0525',
    fax: '084-962-0526'
  };

  return `
    <!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
      <style>
        body {
          font-family: 'MS Gothic', monospace;
          margin: 0;
          padding: 20px;
          font-size: 12px;
          line-height: 1.4;
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
        }
        .header h1 {
          font-size: 24px;
          margin: 0;
          padding: 10px 0;
          border-bottom: 2px solid #333;
        }
        .company-info {
          text-align: right;
          margin-bottom: 20px;
          font-size: 10px;
        }
        .document-info {
          display: flex;
          justify-content: space-between;
          margin-bottom: 20px;
        }
        .customer-info {
          width: 60%;
        }
        .order-info {
          width: 35%;
          text-align: right;
        }
        .customer-name {
          font-size: 16px;
          font-weight: bold;
          margin-bottom: 10px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 20px 0;
        }
        th, td {
          border: 1px solid #333;
          padding: 8px;
          text-align: center;
        }
        th {
          background-color: #f0f0f0;
          font-weight: bold;
        }
        .product-name {
          text-align: left;
          width: 40%;
        }
        .total-row {
          background-color: #f9f9f9;
          font-weight: bold;
        }
        .approval-section {
          margin-top: 40px;
          display: flex;
          justify-content: space-between;
        }
        .approval-box {
          border: 2px solid #333;
          width: 200px;
          height: 100px;
          text-align: center;
          padding: 10px;
          position: relative;
        }
        .approval-stamp {
          position: absolute;
          top: 20px;
          right: 20px;
          color: #e74c3c;
          font-size: 24px;
          font-weight: bold;
          transform: rotate(-15deg);
          border: 3px solid #e74c3c;
          border-radius: 50%;
          width: 60px;
          height: 60px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .notes {
          margin-top: 30px;
          font-size: 10px;
        }
        .footer {
          margin-top: 50px;
          text-align: center;
          font-size: 10px;
          color: #666;
        }
      </style>
    </head>
    <body>
      <div class="company-info">
        ${companyInfo.name}<br>
        ${companyInfo.address}<br>
        TEL: ${companyInfo.phone} FAX: ${companyInfo.fax}
      </div>

      <div class="header">
        <h1>${title}</h1>
      </div>

      <div class="document-info">
        <div class="customer-info">
          <div class="customer-name">${order.user.companyRel.name} 御中</div>
          <div>所在地: ${order.deliveryPrefecture}${order.deliveryCity}${order.deliveryAddress1}</div>
          ${order.deliveryAddress2 ? `<div>　　　　${order.deliveryAddress2}</div>` : ''}
        </div>
        <div class="order-info">
          <div><strong>納期日付</strong>: ${paperwork.deliveryDate ? new Date(paperwork.deliveryDate).toLocaleDateString('ja-JP') : new Date().toLocaleDateString('ja-JP')}</div>
          <div><strong>オーダー番号</strong>: ${order.orderNumber}</div>
          <div><strong>${isDeliveryNote ? '納品書' : '受領書'}番号</strong>: ${paperwork.documentNumber}</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th class="product-name">商品名</th>
            <th>容量</th>
            <th>数量</th>
            <th>単価 (円)</th>
            <th>金額 (円)</th>
            ${!isDeliveryNote ? '<th>備考</th>' : ''}
          </tr>
        </thead>
        <tbody>
          ${order.orderItems.map((item: any) => `
            <tr>
              <td class="product-name">${item.companyProduct.productMaster.name}</td>
              <td>${item.companyProduct.productMaster.capacity}${item.companyProduct.productMaster.unit}</td>
              <td>${item.quantity}</td>
              <td>${item.unitPrice.toLocaleString()}</td>
              <td>${item.totalPrice.toLocaleString()}</td>
              ${!isDeliveryNote ? '<td></td>' : ''}
            </tr>
          `).join('')}
          <tr class="total-row">
            <td colspan="${isDeliveryNote ? '4' : '5'}">合計金額 (税抜)</td>
            <td><strong>${order.totalAmount.toLocaleString()}円</strong></td>
          </tr>
        </tbody>
      </table>

      ${!isDeliveryNote ? `
        <div class="approval-section">
          <div>
            <div style="margin-bottom: 20px;"><strong>発送者確認欄</strong></div>
            <div style="border: 1px solid #333; width: 150px; height: 80px;"></div>
          </div>
          <div>
            <div style="margin-bottom: 20px;"><strong>受領者確認欄</strong></div>
            <div class="approval-box">
              ${paperwork.isApproved ? `
                <div class="approval-stamp">承認印</div>
                <div style="margin-top: 60px; font-size: 10px;">
                  承認者: ${paperwork.approvedBy}<br>
                  承認日: ${new Date(paperwork.approvedAt).toLocaleDateString('ja-JP')}
                </div>
              ` : ''}
            </div>
          </div>
        </div>
      ` : ''}

      <div class="notes">
        <p>※ 上記の通り${isDeliveryNote ? '納品' : '受領'}いたしました。</p>
        ${!isDeliveryNote ? '<p>※ 検収・承認が完了している商品に関して記載しております。</p>' : ''}
      </div>

      <div class="footer">
        発行日: ${new Date(paperwork.createdAt).toLocaleDateString('ja-JP')} | 
        発行者: ${companyInfo.name}
      </div>
    </body>
    </html>
  `;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // CORS設定（管理者FEとユーザーFE両方を許可）
    const allowedOrigins = [
      process.env.NEXT_PUBLIC_FRONTEND_URL, // ユーザーFE
      'http://localhost:3002' // 管理者FE
    ];
    
    const origin = req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
    
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'GETメソッドのみ許可されています' });
    }

    const { id, documentId } = req.query;
    
    if (!id || isNaN(Number(id))) {
      return res.status(400).json({ error: '有効な注文IDが必要です' });
    }

    if (!documentId || isNaN(Number(documentId))) {
      return res.status(400).json({ error: '有効な書類IDが必要です' });
    }

    const orderId = Number(id);
    const paperworkId = Number(documentId);

    console.log(`📄 注文${orderId}の書類${paperworkId}ダウンロード要求`);

    // 認証チェック（ユーザーまたは管理者）
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'トークンが必要です' });
    }

    let isAdmin = false;
    let userId: number | null = null;
    let companyId: number | null = null;

    // 管理者トークンをまず試す
    try {
      const adminSecret = process.env.ADMIN_JWT_SECRET;
if (!adminSecret) {
  throw new Error('ADMIN_JWT_SECRET環境変数が設定されていません');
}
      jwt.verify(token, adminSecret);
      isAdmin = true;
    } catch {
      // ユーザートークンを試す
      try {
        const userSecret = process.env.JWT_SECRET;
        const decoded = jwt.verify(token, userSecret!) as any;
        userId = decoded.id;
        companyId = decoded.companyId;
      } catch {
        return res.status(401).json({ error: '無効なトークンです' });
      }
    }

    // 書類取得
    const paperwork = await prisma.orderPaperwork.findUnique({
      where: { id: paperworkId },
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
        }
      }
    });

    if (!paperwork) {
      console.log(`❌ 書類が見つかりません: ID=${paperworkId}`);
      return res.status(404).json({ error: '書類が見つかりません' });
    }

    // 注文IDの整合性チェック
    if (paperwork.orderId !== orderId) {
      console.log(`❌ 注文IDが一致しません: 要求=${orderId}, 実際=${paperwork.orderId}`);
      return res.status(400).json({ error: '指定された注文の書類ではありません' });
    }

    console.log(`📄 書類情報: ${paperwork.documentNumber} (${paperwork.documentType}) - ステータス: ${paperwork.status}`);

    // 権限チェック
    if (!isAdmin) {
      if (paperwork.order.user.companyId !== companyId) {
        console.log(`❌ アクセス権限なし: ユーザー会社${companyId} vs 注文会社${paperwork.order.user.companyId}`);
        return res.status(403).json({ error: 'アクセス権限がありません' });
      }
      
      if (paperwork.status !== 'finalized') {
        console.log(`❌ 未確定書類: ${paperwork.status}`);
        return res.status(403).json({ error: 'ファイナライズされていない書類です' });
      }
    }

    // HTMLをPDFに変換（実際の実装では puppeteer を使用）
    const html = generatePaperworkHTML(paperwork, paperwork.order);
    
    // 開発環境では簡易的にHTMLを返す
    if (process.env.NODE_ENV === 'development') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(200).send(html);
    }

    // 本番環境ではPDF生成ライブラリを使用
    // const pdf = await generatePDF(html);
    
    const filename = `${paperwork.documentType === 'delivery_note' ? '納品書' : '受領書'}_${paperwork.documentNumber}.pdf`;
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    
    console.log(`✅ 書類ダウンロード成功: ${paperwork.documentNumber}`);
    
    // 開発用：HTMLを返す
    return res.status(200).send(html);

  } catch (error) {
    console.error('❌ 書類ダウンロードAPI エラー:', error);
    return res.status(500).json({ error: 'サーバーエラーが発生しました' });
  } finally {
    await prisma.$disconnect();
  }
}