// 管理者画面用。/OptiOil-API/lib/adminAuth.ts
import { NextRequest, NextResponse } from 'next/server'; // ← NextResponse追加
import jwt from 'jsonwebtoken';

interface AdminTokenPayload {
  id: number;
  username: string;
  role: string;
  email: string;
}

export async function verifyAdminToken(req: NextRequest): Promise<AdminTokenPayload | null> {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET!) as AdminTokenPayload;
    
    return decoded;
  } catch (error) {
    return null;
  }
}

// 管理者権限チェックミドルウェア
export async function requireAdminRole(req: NextRequest, requiredRole?: string) {
  const decoded = await verifyAdminToken(req);
  
  if (!decoded) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  if (requiredRole && decoded.role !== requiredRole && decoded.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  
  return decoded;
}