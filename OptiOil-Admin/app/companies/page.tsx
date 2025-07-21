// optioil-admin/app/companies/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  Building2, Search, Settings, ArrowLeft, Users, Package, 
  AlertTriangle, CalendarClock, Calendar
} from 'lucide-react';
import api from '@/lib/axios';

// 型定義
interface Company {
  id: number;
  name: string;
  createdAt: string;
  _count?: {
    users?: number;
    companyProducts?: number;
  };
}

// 🆕 会社警告データの型定義
interface CompanyWarning {
  companyId: number;
  companyName: string;
  warnings: {
    unsetPrice: { count: number; hasWarning: boolean };
    noProducts: { count: number; hasWarning: boolean };
    expiringQuotation: { count: number; hasWarning: boolean };
    unsetQuotationExpiry: { count: number; hasWarning: boolean };
  };
  totalWarnings: number;
}

interface CompanyWarningsData {
  warnings: CompanyWarning[];
  summary: {
    totalCompaniesWithWarnings: number;
    totalCompanies: number;
    warningTypes: {
      unsetPrice: number;
      noProducts: number;
      expiringQuotation: number;
      unsetQuotationExpiry: number;
    };
  };
  companyWarningMap: Record<number, CompanyWarning>;
}

export default function CompaniesPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (!token) {
      router.push('/login');
    }
  }, [router]);

  // 会社一覧取得
  const { data: companies, isLoading } = useQuery({
    queryKey: ['companies'],
    queryFn: async () => {
      const response = await api.get('/api/admin/companies');
      return response.data as Company[];
    },
  });

  // 🆕 会社警告データ取得
  const { data: warningsData, } = useQuery({
    queryKey: ['companyWarnings'],
    queryFn: async () => {
      const response = await api.get('/api/admin/companies/warnings');
      return response.data as CompanyWarningsData;
    },
    refetchInterval: 30000,
  });

  const filteredCompanies = companies?.filter((company: Company) =>
    company.name.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  // 🆕 警告がある会社のIDセット
  const companiesWithWarnings = new Set(
    warningsData?.warnings.map(w => w.companyId) || []
  );

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <Button
          variant="ghost"
          onClick={() => router.push('/dashboard')}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          ダッシュボードに戻る
        </Button>

        <div>
          <h1 className="text-2xl font-bold">会社管理</h1>
          <p className="text-muted-foreground">
            登録会社の一覧と各会社の設定を管理します
          </p>
        </div>

        {/* 🆕 複数警告のお知らせ */}
        {warningsData && warningsData.summary.totalCompaniesWithWarnings > 0 && (
          <Alert className="border-orange-200 bg-orange-50">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-800">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div>
                    <strong>{warningsData.summary.totalCompaniesWithWarnings}社</strong>で対応が必要な項目があります。
                    該当する会社はオレンジ色でハイライト表示されています。
                  </div>
                  <div className="text-sm flex flex-wrap gap-4">
                    {warningsData.summary.warningTypes.unsetPrice > 0 && (
                      <span>• 価格未設定: {warningsData.summary.warningTypes.unsetPrice}社</span>
                    )}
                    {warningsData.summary.warningTypes.noProducts > 0 && (
                      <span>• 商品未登録: {warningsData.summary.warningTypes.noProducts}社</span>
                    )}
                    {warningsData.summary.warningTypes.expiringQuotation > 0 && (
                      <span>• 見積期限間近: {warningsData.summary.warningTypes.expiringQuotation}社</span>
                    )}
                    {warningsData.summary.warningTypes.unsetQuotationExpiry > 0 && (
                      <span>• 見積期限未設定: {warningsData.summary.warningTypes.unsetQuotationExpiry}社</span>
                    )}
                  </div>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center space-x-2">
                <span>会社一覧</span>
                {/* 🆕 警告バッジ */}
                {warningsData && warningsData.summary.totalCompaniesWithWarnings > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    対応必要: {warningsData.summary.totalCompaniesWithWarnings}社
                  </Badge>
                )}
              </CardTitle>
              <Button onClick={() => toast.info('会社追加機能は準備中です')}>
                <Building2 className="w-4 h-4 mr-2" />
                会社を追加
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex items-center space-x-2">
              <Search className="w-4 h-4 text-gray-400" />
              <Input
                placeholder="会社名で検索..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-md"
              />
            </div>

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>会社名</TableHead>
                    <TableHead>登録日</TableHead>
                    <TableHead>ユーザー数</TableHead>
                    <TableHead>表示商品数</TableHead>
                    <TableHead>対応状況</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCompanies.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                        会社が見つかりません
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCompanies.map((company) => {
                      // 🆕 会社の警告情報を取得
                      const companyWarning = warningsData?.companyWarningMap[company.id];
                      const hasWarnings = companiesWithWarnings.has(company.id);
                      
                      return (
                        <TableRow 
                          key={company.id}
                          className={
                            hasWarnings 
                              ? "bg-orange-50 hover:bg-orange-100 border-l-4 border-l-orange-400" 
                              : ""
                          }
                        >
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Building2 className="w-4 h-4 text-gray-500" />
                              <span>{company.name}</span>
                              {/* 🆕 警告バッジ */}
                              {hasWarnings && (
                                <Badge variant="outline" className="border-orange-400 text-orange-700 bg-orange-100">
                                  対応必要
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {new Date(company.createdAt).toLocaleDateString('ja-JP')}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Users className="w-4 h-4 text-gray-500" />
                              <span>{company._count?.users || 0}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Package className="w-4 h-4 text-gray-500" />
                              <span>{company._count?.companyProducts || 0}</span>
                            </div>
                          </TableCell>
                          {/* 🆕 対応状況カラム */}
                          <TableCell>
                            {hasWarnings && companyWarning ? (
                              <div className="space-y-1">
                                {companyWarning.warnings.unsetPrice.hasWarning && (
                                  <div className="flex items-center gap-2 text-orange-700">
                                    <AlertTriangle className="w-3 h-3" />
                                    <span className="text-xs">価格未設定 ({companyWarning.warnings.unsetPrice.count}件)</span>
                                  </div>
                                )}
                                {companyWarning.warnings.noProducts.hasWarning && (
                                  <div className="flex items-center gap-2 text-orange-700">
                                    <Package className="w-3 h-3" />
                                    <span className="text-xs">商品未登録</span>
                                  </div>
                                )}
                                {companyWarning.warnings.expiringQuotation.hasWarning && (
                                  <div className="flex items-center gap-2 text-orange-700">
                                    <CalendarClock className="w-3 h-3" />
                                    <span className="text-xs">見積期限間近 ({companyWarning.warnings.expiringQuotation.count}件)</span>
                                  </div>
                                )}
                                {companyWarning.warnings.unsetQuotationExpiry.hasWarning && (
                                  <div className="flex items-center gap-2 text-red-700">
                                    <Calendar className="w-3 h-3" />
                                    <span className="text-xs">見積期限未設定 ({companyWarning.warnings.unsetQuotationExpiry.count}件)</span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 text-green-600">
                                <CalendarClock className="w-4 h-4" />
                                <span>問題なし</span>
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant={hasWarnings ? "default" : "outline"}
                              size="sm"
                              onClick={() => router.push(`/companies/${company.id}/products`)}
                              className={
                                hasWarnings 
                                  ? "bg-orange-500 hover:bg-orange-600 text-white" 
                                  : ""
                              }
                            >
                              <Settings className="w-4 h-4 mr-2" />
                              {hasWarnings ? "対応必要" : "商品設定"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}