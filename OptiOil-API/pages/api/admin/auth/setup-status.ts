/**
 * ファイルパス: OptiOil-API/pages/api/admin/auth/setup-status.ts
 * 初回セットアップ状態確認API
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // CORS設定
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'GETメソッドのみ許可されています' });
    }

    // 管理者の存在確認
    const adminCount = await prisma.adminUser.count();
    const isFirstTimeSetup = adminCount === 0;

    console.log('🔍 セットアップ状態確認:', { adminCount, isFirstTimeSetup });

    return res.status(200).json({
      isFirstTimeSetup,
      adminCount,
      message: isFirstTimeSetup 
        ? '初回セットアップが必要です' 
        : 'システムは設定済みです'
    });

  } catch (error) {
    console.error('❌ セットアップ状態確認API エラー:', error);
    return res.status(500).json({ error: 'サーバーエラーが発生しました' });
  } finally {
    await prisma.$disconnect();
  }
}