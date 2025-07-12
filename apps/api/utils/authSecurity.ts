// utils/authSecurity.ts - OptiOil-API/utils/authSecurity.ts
// 共通のセキュリティ強化ユーティリティ

import { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';

interface AuthenticatedUser {
  id: number;
  companyId: number;
  email: string;
  systemRole?: string;
}

// 環境変数の安全な取得
export function getSecretKeys() {
  const JWT_SECRET = process.env.JWT_SECRET;
  const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET;
  
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET環境変数が設定されていません');
  }
  
  if (!ADMIN_JWT_SECRET) {
    throw new Error('ADMIN_JWT_SECRET環境変数が設定されていません');
  }
  
  return { JWT_SECRET, ADMIN_JWT_SECRET };
}

// 🚨 CVE-2025-29927 対策: 悪意あるヘッダーチェック
export function checkSuspiciousHeaders(req: NextApiRequest): boolean {
  const suspiciousHeaders = [
    'x-middleware-subrequest',
    'x-middleware-invoke', 
    'x-nextjs-middleware',
    'x-middleware-rewrite',
    'x-nextjs-rewrite'
  ];

  for (const header of suspiciousHeaders) {
    if (req.headers[header]) {
      console.warn(`🚨 セキュリティアラート: 悪意ある可能性のあるヘッダーを検出: ${header}`, {
        ip: req.connection?.remoteAddress,
        userAgent: req.headers['user-agent'],
        url: req.url,
        method: req.method
      });
      return true; // 悪意あるヘッダーを検出
    }
  }
  
  return false; // 安全
}

// 強化された認証トークン検証
export function verifyTokenEnhanced(req: NextApiRequest, isAdmin = false): AuthenticatedUser {
  // 悪意あるヘッダーチェック
  if (checkSuspiciousHeaders(req)) {
    throw new Error('不正なリクエストヘッダーが検出されました');
  }

  const { JWT_SECRET, ADMIN_JWT_SECRET } = getSecretKeys();
  const secretKey = isAdmin ? ADMIN_JWT_SECRET : JWT_SECRET;
  
  const token = req.headers.authorization?.replace('Bearer ', '') ||
                req.cookies?.['auth-token'] ||
                req.cookies?.['admin-token'];
  
  if (!token) {
    throw new Error('認証トークンがありません');
  }

  try {
    const decoded = jwt.verify(token, secretKey) as any;
    
    // トークンの基本的な検証
    if (!decoded.id && !decoded.userId) {
      throw new Error('無効なトークン構造です');
    }
    
    // 管理者トークンの場合、追加検証
    if (isAdmin && !decoded.role) {
      throw new Error('管理者権限が確認できません');
    }
    
    return {
      id: decoded.id || decoded.userId,
      companyId: decoded.companyId,
      email: decoded.email,
      systemRole: decoded.systemRole || decoded.role
    };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('認証トークンの有効期限が切れています');
    } else if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('無効な認証トークンです');
    }
    throw error;
  }
}

// レート制限設定
export const createRateLimit = (windowMs: number, max: number) => {
  return rateLimit({
    windowMs,
    max,
    message: 'リクエストが多すぎます。しばらく待ってから再試行してください。',
    standardHeaders: true,
    legacyHeaders: false,
  });
};

// よく使用するレート制限
export const authRateLimit = createRateLimit(15 * 60 * 1000, 5); // 15分間に5回まで
export const apiRateLimit = createRateLimit(1 * 60 * 1000, 100); // 1分間に100回まで

// セキュリティログ
export function logSecurityEvent(event: string, details: any, req: NextApiRequest) {
  const securityLog = {
    timestamp: new Date().toISOString(),
    event,
    details,
    request: {
      ip: req.connection?.remoteAddress || req.socket?.remoteAddress,
      userAgent: req.headers['user-agent'],
      url: req.url,
      method: req.method,
      referer: req.headers.referer
    }
  };
  
  console.warn('🔒 セキュリティイベント:', JSON.stringify(securityLog, null, 2));
  
  // 本番環境では外部ログサービスに送信
  // if (process.env.NODE_ENV === 'production') {
  //   // 外部セキュリティログサービスに送信
  // }
}

// 強化されたエラーハンドラー
export function handleSecurityError(res: NextApiResponse, error: any, req: NextApiRequest) {
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  // セキュリティ関連エラーのログ記録
  if (error.message?.includes('不正な') || 
      error.message?.includes('悪意ある') ||
      error.message?.includes('無効な認証')) {
    logSecurityEvent('SECURITY_ERROR', { error: error.message }, req);
  }
  
  console.error('API Security Error:', error);
  
  if (error.message === '認証トークンがありません' || 
      error.message === '無効な認証トークンです' ||
      error.message === '認証トークンの有効期限が切れています') {
    return res.status(401).json({ 
      message: error.message,
      code: 'AUTHENTICATION_REQUIRED'
    });
  }
  
  if (error.message === '不正なリクエストヘッダーが検出されました') {
    return res.status(403).json({ 
      message: 'アクセスが拒否されました',
      code: 'FORBIDDEN_REQUEST'
    });
  }
  
  res.status(500).json({ 
    message: 'サーバーエラーが発生しました',
    code: 'INTERNAL_SERVER_ERROR',
    error: isDevelopment ? error.message : undefined
  });
}