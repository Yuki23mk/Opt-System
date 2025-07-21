// middleware.ts - OptiOil-Frontend/middleware.ts
// 修正版: 認証チェックを改善したセキュリティ強化ミドルウェア

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // 🚨 CVE-2025-29927 対策: 悪意あるヘッダーのブロック
  const suspiciousHeaders = [
    'x-middleware-subrequest',
    'x-middleware-invoke',
    'x-nextjs-middleware'
  ];

  for (const header of suspiciousHeaders) {
    if (request.headers.has(header)) {
      console.warn(`🚨 セキュリティアラート: 悪意ある可能性のあるヘッダーを検出: ${header}`);
      return new NextResponse('Forbidden', { status: 403 });
    }
  }

  // 🔐 認証が必要なパスの定義
  const authRequiredPaths = [
    '/products',
    '/orders', 
    '/equipments',
    '/data-monitor',
    '/account',
    '/settings'
  ];

  // 🚫 認証チェックを除外するパス
  const excludePaths = [
    '/login',
    '/register', 
    '/forgot-password',
    '/api',
    '/_next',
    '/favicon.ico',
    '/public'
  ];

  const pathname = request.nextUrl.pathname;

  // 除外パスのチェック
  const isExcluded = excludePaths.some(path => 
    pathname.startsWith(path)
  );

  if (isExcluded) {
    return NextResponse.next();
  }

  // 認証が必要なパスかチェック
  const requiresAuth = authRequiredPaths.some(path => 
    pathname.startsWith(path)
  );

  if (requiresAuth) {
    // 🔍 様々な場所からトークンを検索
    const authHeader = request.headers.get('authorization');
    const cookieToken = request.cookies.get('token')?.value || 
                       request.cookies.get('auth-token')?.value ||
                       request.cookies.get('authToken')?.value ||
                       request.cookies.get('jwt')?.value;
    
    const bearerToken = authHeader?.replace('Bearer ', '');
    const token = bearerToken || cookieToken;

    // デバッグログ（開発環境のみ）
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 認証チェック:', { 
        pathname,
        hasAuthHeader: !!authHeader,
        hasCookieToken: !!cookieToken,
        hasToken: !!token,
        cookies: request.cookies.getAll().map(c => c.name)
      });
    }

    // トークンがない場合のみリダイレクト
    if (!token) {
      console.log('🚫 認証されていないアクセス:', pathname);
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // 認証済みの場合、セキュリティヘッダーを追加
    const response = NextResponse.next();
    
    // セキュリティヘッダーの追加
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set('X-XSS-Protection', '1; mode=block');

    return response;
  }

  // 認証不要なパスの場合、そのまま通す
  return NextResponse.next();
}

// ミドルウェアを適用するパスの設定
export const config = {
  matcher: [
    /*
     * 以下のパスを除いて全てにマッチ:
     * - api ルート (別途API側で認証)
     * - _next/static (静的ファイル)
     * - _next/image (画像最適化)
     * - favicon.ico
     * - 画像ファイル
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:jpg|jpeg|gif|png|svg|ico|webp)$).*)',
  ],
}