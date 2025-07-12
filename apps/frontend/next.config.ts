// /next.config.ts - PWA設定とセキュリティヘッダー（セキュア版）- ビルドエラー修正

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // 🔧 swcMinify は Next.js 15では削除（デフォルトで有効）
  // swcMinify: true,
  
  // PWA設定
  async headers() {
    return [
      {
        source: '/manifest.json',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/manifest+json',
          },
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
        ],
      },
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/javascript; charset=utf-8',
          },
          {
            key: 'Service-Worker-Allowed',
            value: '/',
          },
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
        ],
      },
      {
        source: '/icons/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      // セキュリティヘッダー
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },

  // 🔒 環境変数の安全な設定
  env: (() => {
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    // 必須環境変数のチェック
    const requiredEnvs = ['NEXT_PUBLIC_API_URL', 'NEXT_PUBLIC_FRONTEND_URL', 'NEXT_PUBLIC_ADMIN_URL'];
    const env: Record<string, string> = {};
    
    requiredEnvs.forEach(key => {
      const value = process.env[key];
      if (!value) {
        if (isDevelopment) {
          // 開発環境のみフォールバック値を許可
          const fallbacks = {
            'NEXT_PUBLIC_API_URL': 'http://localhost:3001',
            'NEXT_PUBLIC_FRONTEND_URL': 'http://localhost:3000',
            'NEXT_PUBLIC_ADMIN_URL': 'http://localhost:3002'
          };
          const fallback = fallbacks[key as keyof typeof fallbacks];
          if (fallback) {
            console.warn(`⚠️ ${key}が.envから読み込めませんでした。開発用フォールバック値を使用: ${fallback}`);
            env[key] = fallback;
            return;
          }
        }
        throw new Error(`${key}環境変数が設定されていません。.envファイルを確認してください。`);
      }
      env[key] = value;
    });
    
    // オプショナルな環境変数（フォールバック値OK）
    env.NEXT_PUBLIC_APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'OptiOil データモニター';
    env.NEXT_PUBLIC_APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0';
    
    return env;
  })(),

  // 画像最適化
  images: {
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  // webpack設定（PWA用）
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }

    return config;
  },

  // 🔧 Next.js 15対応：experimental設定更新
  serverExternalPackages: ['@prisma/client'],

  // PWA用の設定
  async rewrites() {
    return [
      {
        source: '/offline',
        destination: '/offline.html',
      },
    ];
  },
};

export default nextConfig;