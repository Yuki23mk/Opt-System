// optioil-admin/app/dashboard/page.tsx
'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Package, Building2, Users, ClipboardList, FileText, Bell, 
  AlertTriangle, CheckCircle, RefreshCw, Shield 
} from 'lucide-react';
import axios from '@/lib/axios';

interface DashboardMetrics {
  totalProducts: number;
  totalCompanies: number;
  activeUsers: number;
  monthlyOrders: number;
}

interface TodoItem {
  id: string;
  category: 'user_management' | 'order_management' | 'quotation_management';
  priority: 1 | 2 | 3;
  title: string;
  description: string;
  count?: number;
  actionUrl?: string;
  createdAt: string;
}

interface TodosResponse {
  todos: TodoItem[];
  summary: {
    total: number;
    byCategory: {
      user_management: number;
      order_management: number;
      quotation_management: number;
    };
  };
}

// 🆕 会社警告データの型定義
interface CompanyWarningsData {
  warnings: Array<{
    companyId: number;
    companyName: string;
    totalWarnings: number;
  }>;
  summary: {
    totalCompaniesWithWarnings: number;
    totalCompanies: number;
  };
}

export default function DashboardPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [showAllTodos, setShowAllTodos] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (!token) {
      router.push('/login');
    } else {
      setIsLoading(false);
    }
  }, [router]); // 🔧 修正: routerを依存配列に追加

  // ダッシュボードメトリクス取得
  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['dashboardMetrics'],
    queryFn: async (): Promise<DashboardMetrics> => {
      const response = await axios.get('/api/admin/dashboard/metrics');
      return response.data;
    },
    refetchInterval: 30000, // 30秒ごとに更新
  });

  // TODOリスト取得
  const { data: todosData, isLoading: todosLoading, refetch: refetchTodos } = useQuery({
    queryKey: ['dashboardTodos'],
    queryFn: async (): Promise<TodosResponse> => {
      const response = await axios.get('/api/admin/dashboard/todos');
      return response.data;
    },
    refetchInterval: 60000, // 1分ごとに更新
  });

  // 🆕 会社警告データ取得
  const { data: warningsData } = useQuery({
    queryKey: ['companyWarnings'],
    queryFn: async (): Promise<CompanyWarningsData> => {
      const response = await axios.get('/api/admin/companies/warnings');
      return response.data;
    },
    refetchInterval: 30000,
  });

  const handleLogout = useCallback(() => {
    localStorage.removeItem('adminToken');
    toast.success('ログアウトしました！');
    router.push('/login');
  }, [router]);

  const handleTodoClick = useCallback((todo: TodoItem) => {
    if (todo.actionUrl) {
      router.push(todo.actionUrl);
    }
  }, [router]);

  const handleRefreshTodos = useCallback(() => {
    refetchTodos();
    toast.info('TODOリストを更新しました');
  }, [refetchTodos]);

  const getPriorityColor = useCallback((priority: number) => {
    switch (priority) {
      case 1: return 'border-red-200 bg-red-50';
      case 2: return 'border-orange-200 bg-orange-50';
      case 3: return 'border-blue-200 bg-blue-50';
      default: return 'border-gray-200 bg-gray-50';
    }
  }, []);

  const getCategoryIcon = useCallback((category: string) => {
    switch (category) {
      case 'user_management': return <Users className="w-4 h-4" />;
      case 'order_management': return <ClipboardList className="w-4 h-4" />;
      case 'quotation_management': return <FileText className="w-4 h-4" />;
      default: return <Bell className="w-4 h-4" />;
    }
  }, []);

  const getCategoryName = useCallback((category: string) => {
    switch (category) {
      case 'user_management': return 'ユーザー管理';
      case 'order_management': return '受注管理';
      case 'quotation_management': return '見積管理';
      default: return 'その他';
    }
  }, []);

  const menuItems = [
    {
      title: '商品管理',
      description: '商品マスタの管理',
      icon: Package,
      href: '/products',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      title: '会社管理',
      description: '登録会社の管理',
      icon: Building2,
      href: '/companies',
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      title: 'ユーザー管理',
      description: 'ユーザーアカウントの管理',
      icon: Users,
      href: '/users',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
    {
      title: '受注管理',
      description: '受注履歴の確認',
      icon: ClipboardList,
      href: '/orders',
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
    },
    {
      title: 'ドキュメント',
      description: 'システムドキュメント管理',
      icon: FileText,
      href: '/documents',
      color: 'text-pink-600',
      bgColor: 'bg-pink-50',
    },
    {
    title: '法的文書管理',
    description: '利用規約・プライバシーポリシー',
    icon: FileText,
    href: '/legal',
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
  },
    // 🆕 ここに通知管理を追加する場合はコメントアウトを外す
    //{
    //  title: '通知管理',
    //  description: 'システム通知の設定',
    //  icon: Bell,
    //  href: '/notifications',
    //  color: 'text-indigo-600',
    //  bgColor: 'bg-indigo-50',
   // },
      {
      title: 'セキュリティ設定',
      description: 'MFA設定・管理者アカウント管理',
      icon: Shield,
      href: '/settings/security',
      color: 'text-red-600',
      bgColor: 'bg-red-50',
    },
  ];

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Opt. 管理ダッシュボード</h1>
          <Button variant="outline" onClick={handleLogout}>
            ログアウト
          </Button>
        </div>

        {/* TODOリスト */}
        {todosData && (
          <Card className="mb-8">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="w-5 h-5 text-orange-600" />
                  <CardTitle>要対応項目</CardTitle>
                  <Badge variant="outline" className="text-sm">
                    {todosData.summary.total}件
                  </Badge>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleRefreshTodos}
                  disabled={todosLoading}
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${todosLoading ? 'animate-spin' : ''}`} />
                  更新
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* 🔧 修正: 表示件数制御 */}
                {todosData.todos.slice(0, showAllTodos ? todosData.todos.length : 10).map((todo) => (
                  <div
                    key={todo.id}
                    className={`group relative p-4 rounded-lg border cursor-pointer transition-all hover:shadow-md hover:scale-[1.02] ${getPriorityColor(todo.priority)}`}
                    onClick={() => handleTodoClick(todo)}
                  >
                    {/* メインコンテンツ */}
                    <div className="flex items-start space-x-3 pr-12">
                      <div className="flex-shrink-0 mt-0.5">
                        {getCategoryIcon(todo.category)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <h4 className="font-medium text-sm truncate">{todo.title}</h4>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2 truncate">
                          {getCategoryName(todo.category)}
                        </p>
                        <p className="text-sm text-gray-700 overflow-hidden" style={{
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical'
                        }}>
                          {todo.description}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
                
                {/* 🔧 修正: さらに表示ボタンを機能させる */}
                {todosData.todos.length > 10 && !showAllTodos && (
                  <div className="col-span-full text-center pt-2">
                    <Button 
                      variant="link" 
                      className="text-sm"
                      onClick={() => setShowAllTodos(true)}
                    >
                      さらに{todosData.todos.length - 10}件の項目を表示...
                    </Button>
                  </div>
                )}

                {/* 🆕 「少なく表示」ボタン */}
                {showAllTodos && todosData.todos.length > 10 && (
                  <div className="col-span-full text-center pt-2">
                    <Button 
                      variant="link" 
                      className="text-sm"
                      onClick={() => setShowAllTodos(false)}
                    >
                      少なく表示
                    </Button>
                  </div>
                )}
              </div>
              
              {/* TODOがない場合の代替表示 */}
              {todosData.todos.length === 0 && (
                <div className="text-center py-8">
                  <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">
                    現在、対応が必要な項目はありません
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
        
        {/* メインメニュー（元の色付きデザイン） */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {menuItems.map((item) => {
            const Icon = item.icon;
            // 🆕 各カテゴリのTODO数と価格未設定データを取得
            let todoCount = 0;
            if (item.href === '/users') {
              todoCount = todosData?.summary.byCategory.user_management || 0;
            } else if (item.href === '/orders') {
              todoCount = todosData?.summary.byCategory.order_management || 0;
            } else if (item.href === '/companies') {
              // 🆕 会社管理には警告がある会社数をバッジ表示
              todoCount = warningsData?.summary.totalCompaniesWithWarnings || 0;
            }
            
            return (
              <Card 
                key={item.href}
                className="cursor-pointer hover:shadow-lg transition-shadow duration-200 relative"
                onClick={() => router.push(item.href)}
              >
                {/* 🆕 バッジ表示 */}
                {todoCount > 0 && (
                  <div className="absolute -top-2 -right-2 z-10">
                    <Badge variant="destructive" className="text-xs">
                      {todoCount}
                    </Badge>
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${item.bgColor}`}>
                      <Icon className={`w-6 h-6 ${item.color}`} />
                    </div>
                    {item.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600">{item.description}</p>
                  {/* 🆕 会社管理の場合は警告情報を表示 */}
                  {item.href === '/companies' && warningsData && warningsData.summary.totalCompaniesWithWarnings > 0 && (
                    <p className="text-xs text-red-600 mt-1">
                      対応必要な会社: {warningsData.summary.totalCompaniesWithWarnings}社
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* 統計情報 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                登録商品数
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {metricsLoading ? (
                  <span className="text-gray-400">読み込み中...</span>
                ) : (
                  metrics?.totalProducts.toLocaleString()
                )}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                登録会社数
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {metricsLoading ? (
                  <span className="text-gray-400">読み込み中...</span>
                ) : (
                  metrics?.totalCompanies.toLocaleString()
                )}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                アクティブユーザー
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {metricsLoading ? (
                  <span className="text-gray-400">読み込み中...</span>
                ) : (
                  metrics?.activeUsers.toLocaleString()
                )}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                今月の受注数
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {metricsLoading ? (
                  <span className="text-gray-400">読み込み中...</span>
                ) : (
                  metrics?.monthlyOrders.toLocaleString()
                )}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}