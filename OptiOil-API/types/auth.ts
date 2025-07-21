// ✅ 新規作成：共通の認証型定義
export interface AuthenticatedUser {
  id: number;
  companyId: number;
  systemRole?: string;
  status?: string;
}

export interface JWTPayload {
  id: number;
  companyId: number;
  systemRole: string;
  status: string;
  iat: number;
  exp: number;
}

export interface LoginResponse {
  token: string;
  user: {
    id: number;
    systemRole: string;
    status: string;
  };
  requiresMFA?: boolean;
  tempToken?: string;
}