// /OptiOil-Admin/components/Sidebar.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  Package,
  Building2,
  Users,
  FileText,
  Settings,
  LogOut,
  ClipboardList,
  Bell,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const menuItems = [
  {
    href: '/dashboard',
    label: 'ダッシュボード',
    icon: LayoutDashboard,
  },
  {
    href: '/products',
    label: '商品マスタ',
    icon: Package,
  },
  {
    href: '/companies',
    label: '会社管理',
    icon: Building2,
  },
  {
    href: '/users',
    label: 'ユーザー管理',
    icon: Users,
  },
  {
    href: '/orders',
    label: '受注管理',
    icon: ClipboardList,
  },
  {
    href: '/documents',
    label: 'ドキュメント',
    icon: FileText,
  },
  {
    href: '/notifications',
    label: '通知管理',
    icon: Bell,
  },
  {
    href: '/settings',
    label: '設定',
    icon: Settings,
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <div className="w-64 bg-white border-r border-gray-200 min-h-screen flex flex-col">
      <div className="p-6 border-b border-gray-200">
        <h1 className="text-2xl font-bold text-gray-900">OptiOil Admin</h1>
      </div>
      
      <nav className="flex-1 p-4">
        <ul className="space-y-1">
          {menuItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors',
                    isActive
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-700 hover:bg-gray-100'
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      
      <div className="p-4 border-t border-gray-200">
        <div className="mb-4 px-3">
          <p className="text-sm text-gray-600">ログイン中:</p>
          <p className="font-medium text-gray-900">{user?.username}</p>
          <p className="text-xs text-gray-500">{user?.role}</p>
        </div>
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={logout}
        >
          <LogOut className="w-4 h-4 mr-2" />
          ログアウト
        </Button>
      </div>
    </div>
  );
}