import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // すべてのAPIルートに適用
        source: '/api/:path*',
        headers: [
          { 
            key: 'Access-Control-Allow-Origin', 
            value: process.env.NEXT_PUBLIC_FRONTEND_URL! // ✅ 非null演算子で型エラー解決
          },
          { 
            key: 'Access-Control-Allow-Methods', 
            value: 'GET,POST,PUT,DELETE,PATCH,OPTIONS' 
          },
          { 
            key: 'Access-Control-Allow-Headers', 
            value: 'Content-Type, Authorization, Accept, Cache-Control' 
          },
          { 
            key: 'Access-Control-Allow-Credentials', 
            value: 'true' 
          },
        ],
      },
    ];
  },
  // 開発環境での設定
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: '/api/:path*',
      },
    ];
  },
  // 環境変数の公開設定
  env: {
    NEXT_PUBLIC_FRONTEND_URL: process.env.NEXT_PUBLIC_FRONTEND_URL!, // ✅ 非null演算子で型エラー解決
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL!, // ✅ 非null演算子で型エラー解決
  },
};

export default nextConfig;