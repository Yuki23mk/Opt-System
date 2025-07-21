// /OptiOil-Admin/contexts/AuthContext.tsx
'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';

interface AdminUser {
  id: number;
  username: string;
  email: string;
  role: string;
  status: string;
}

interface AuthContextType {
  user: AdminUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      if (!token) {
        setLoading(false);
        return;
      }

      const response = await axios.get('/api/admin/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setUser(response.data);
    } catch (error) {
      localStorage.removeItem('adminToken');
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (username: string, password: string) => {
    try {
      const response = await axios.post('/api/admin/auth/login', {
        username,
        password
      });

      const { token, user } = response.data;
      localStorage.setItem('adminToken', token);
      
      // axiosのデフォルトヘッダーに設定
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      setUser(user);
      
      // 操作ログを記録
      await axios.post('/api/admin/logs', {
        action: 'LOGIN',
        details: `管理者 ${user.username} がログインしました`
      });
      
      router.push('/dashboard');
    } catch (error) {
      throw new Error('ログインに失敗しました');
    }
  };

  const logout = async () => {
    try {
      await axios.post('/api/admin/logs', {
        action: 'LOGOUT',
        details: `管理者 ${user?.username} がログアウトしました`
      });
    } catch (error) {
      console.error('ログアウトログの記録に失敗しました', error);
    }
    
    localStorage.removeItem('adminToken');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

