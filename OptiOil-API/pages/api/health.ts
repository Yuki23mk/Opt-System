import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json({
    status: 'healthy',
    service: 'opt-api',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV  // フォールバックを削除
  });
}