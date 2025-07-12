// lib/cors.ts

import Cors from "cors";

// 複数のオリジンを許可するための設定
const allowedOrigins = [
  process.env.NEXT_PUBLIC_FRONTEND_URL,  // ユーザー画面
  process.env.NEXT_PUBLIC_ADMIN_URL,     // 管理者画面
  // 開発時のフォールバック
  ...(process.env.NODE_ENV === 'development' 
    ? ['http://localhost:3000', 'http://localhost:3002'] 
    : []
  )
].filter(Boolean); // undefinedを除外

const cors = Cors({
  origin: function (origin, callback) {
    // originが undefined の場合（同一オリジンからのリクエスト）も許可
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn('🚨 CORS blocked origin:', origin);
      console.log('🔧 Allowed origins:', allowedOrigins);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ["GET", "POST", "PUT", "PATCH", "OPTIONS", "DELETE"],
  allowedHeaders: [
    "Content-Type", 
    "Authorization",
    "Accept",
    "Cache-Control",
    "X-Requested-With",
    "Origin",
    "X-CSRF-Token"  // 追加
  ],
  credentials: true,
  maxAge: 86400  // 24時間のプリフライトキャッシュ
});

export async function runMiddleware(req: any, res: any) {
  return new Promise((resolve, reject) => {
    cors(req, res, (result: any) => {
      if (result instanceof Error) return reject(result);
      return resolve(result);
    });
  });
}

// デバッグ用のヘルパー関数
export function logCorsConfig() {
  if (process.env.NODE_ENV === 'development') {
    console.log('🌐 CORS設定:', {
      allowedOrigins,
      frontendUrl: process.env.NEXT_PUBLIC_FRONTEND_URL,
      adminUrl: process.env.NEXT_PUBLIC_ADMIN_URL
    });
  }
}