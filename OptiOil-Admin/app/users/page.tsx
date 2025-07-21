/**
 * ファイルパス: optioil-admin/app/users/page.tsx
 * 管理者画面 - ユーザー管理ページ（構造修正版）
 */

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Search, UserCheck, UserX, Building2, AlertTriangle, ArrowLeft } from "lucide-react";
import { ENV } from '@/lib/env';

interface User {
  id: number;
  name: string;
  email: string;
  companyRel: {
    id: number;
    name: string;
  };
  department?: string;
  position?: string;
  phone?: string;
  status: "pending" | "active" | "deleted";
  createdAt: string;
  systemRole: string;
}

interface Company {
  id: number;
  name: string;
  _count: {
    companyProducts: number;
  };
}

export default function UserManagementPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "active" | "deleted">("all");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectDialog, setShowRejectDialog] = useState(false);


const API_URL = ENV.API_URL;;

  // データ取得
  useEffect(() => {
    // 管理者トークンの確認
    const token = localStorage.getItem("adminToken");
    if (!token) {
      router.push("/auth/login");
      return;
    }
    
    fetchUsers();
    fetchCompanies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 依存配列の警告を無効化

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem("adminToken");
      if (!token) {
        console.log("❌ 管理者トークンが見つかりません");
        router.push("/auth/login");
        return;
      }
      
      const fullUrl = `${API_URL}/api/admin/users`;
      console.log("🔍 API呼び出し:", { API_URL, fullUrl, token: token ? "あり" : "なし" });
      
      const response = await fetch(fullUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      console.log("📡 APIレスポンス:", { status: response.status, url: response.url });
      
      if (response.status === 401) {
        console.log("❌ 認証エラー - ログインページにリダイレクト");
        localStorage.removeItem("adminToken");
        router.push("/auth/login");
        return;
      }
      
      if (response.ok) {
        const data = await response.json();
        console.log("✅ ユーザーデータ取得成功:", data);
        setUsers(data.users || []);
      } else {
        console.error("❌ API エラー:", response.status, await response.text());
      }
    } catch (error) {
      console.error("❌ ユーザー取得エラー:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCompanies = async () => {
    try {
      const fullUrl = `${API_URL}/api/admin/companies`;
      
      console.log("🏢 会社データ取得:", fullUrl);
      
      // 既存のAPIは認証なしで動作している可能性があるので、まず認証なしで試す
      let response = await fetch(fullUrl);
      
      // 401エラーの場合は認証付きで再試行
      if (response.status === 401) {
        const token = localStorage.getItem("adminToken");
        response = await fetch(fullUrl, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }
      
      if (response.ok) {
        const data = await response.json();
        console.log("✅ 会社データ取得成功:", data);
        
        // 既存のAPI構造に合わせて調整
        // data が配列の場合と { companies: [] } の場合の両方に対応
        const companiesArray = Array.isArray(data) ? data : data.companies || [];
        setCompanies(companiesArray);
      } else {
        console.error("❌ 会社データ取得エラー:", response.status);
      }
    } catch (error) {
      console.error("❌ 会社情報取得エラー:", error);
    }
  };

  // ユーザー承認
  const handleApproveUser = async (userId: number) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;

    // 会社の製品設定チェック（既存API構造に対応）
    const company = companies.find(c => c.id === user.companyRel.id);
    if (company && company._count && company._count.companyProducts === 0) {
      alert(`承認前に「${user.companyRel.name}」の表示製品を設定してください。\n会社管理ページから製品設定を行ってください。`);
      return;
    }

    setActionLoading(userId);
    try {
      const token = localStorage.getItem("adminToken");
      const response = await fetch(`${API_URL}/api/admin/users/${userId}/approve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        await fetchUsers();
        alert("ユーザーを承認しました");
      } else {
        const error = await response.json();
        alert(`承認に失敗しました: ${error.error}`);
      }
    } catch (error) {
      console.error("承認エラー:", error);
      alert("承認処理でエラーが発生しました");
    } finally {
      setActionLoading(null);
    }
  };

  // ユーザー拒否
  const handleRejectUser = async () => {
    if (!selectedUser || !rejectReason.trim()) {
      alert("拒否理由を入力してください");
      return;
    }

    setActionLoading(selectedUser.id);
    try {
      const token = localStorage.getItem("adminToken");
      const response = await fetch(`${API_URL}/api/admin/users/${selectedUser.id}/reject`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason: rejectReason }),
      });

      if (response.ok) {
        await fetchUsers();
        setShowRejectDialog(false);
        setRejectReason("");
        setSelectedUser(null);
        alert("ユーザー申請を拒否しました");
      } else {
        const error = await response.json();
        alert(`拒否に失敗しました: ${error.error}`);
      }
    } catch (error) {
      console.error("拒否エラー:", error);
      alert("拒否処理でエラーが発生しました");
    } finally {
      setActionLoading(null);
    }
  };

  // フィルタリング
  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.companyRel.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === "all" || user.status === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  // ステータス表示
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge className="bg-red-100 text-red-800 border-red-200">承認待ち</Badge>;
      case "active":
        return <Badge className="bg-green-100 text-green-800 border-green-200">承認済み</Badge>;
      case "deleted":
        return <Badge className="bg-gray-100 text-gray-800 border-gray-200">削除済み</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  // 会社の製品設定状況チェック（既存API構造に対応）
  const getCompanyProductStatus = (companyId: number) => {
    const company = companies.find(c => c.id === companyId);
    if (!company) return false;
    
    // 既存APIの構造に合わせて、_count が存在するかチェック
    return company._count ? company._count.companyProducts > 0 : false;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mr-4"></div>
            <span>読み込み中...</span>
          </div>
        </div>
      </div>
    );
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

        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">ユーザー管理</h1>
          <Button onClick={() => router.push('/companies')} variant="outline">
            <Building2 className="h-4 w-4 mr-2" />
            会社管理
          </Button>
        </div>

        {/* 検索・フィルター */}
        <Card>
          <CardContent className="p-4">
            <div className="flex gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="ユーザー名、メール、会社名で検索..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as "all" | "pending" | "active" | "deleted")}
                className="px-3 py-2 border rounded-md"
              >
                <option value="all">全ステータス</option>
                <option value="pending">承認待ち</option>
                <option value="active">承認済み</option>
                <option value="deleted">削除済み</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* ユーザー一覧 */}
        <div className="grid gap-4">
          {filteredUsers.map((user) => {
            const hasCompanyProducts = getCompanyProductStatus(user.companyRel.id);
            
            return (
              <Card key={user.id} className={user.status === "pending" ? "border-red-200 bg-red-50" : ""}>
                <CardContent className="p-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-semibold text-base">{user.name}</h3>
                        {getStatusBadge(user.status)}
                        {user.status === "pending" && !hasCompanyProducts && (
                          <div className="flex items-center gap-1 text-amber-600">
                            <AlertTriangle className="h-4 w-4" />
                            <span className="text-sm">製品設定要</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                        <div>
                          <p><strong>メール:</strong> {user.email}</p>
                          <p><strong>会社:</strong> {user.companyRel.name}</p>
                          {user.department && <p><strong>部署:</strong> {user.department}</p>}
                        </div>
                        <div>
                          {user.position && <p><strong>役職:</strong> {user.position}</p>}
                          {user.phone && <p><strong>電話:</strong> {user.phone}</p>}
                          <p><strong>申請日:</strong> {new Date(user.createdAt).toLocaleDateString('ja-JP')}</p>
                        </div>
                      </div>

                      {user.status === "pending" && !hasCompanyProducts && (
                        <Alert className="mt-3 border-amber-200 bg-amber-50">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertDescription>
                            承認前に「{user.companyRel.name}」の表示製品設定が必要です。
                            <Button 
                              variant="link" 
                              className="p-0 h-auto text-blue-600"
                              onClick={() => router.push('/companies')}
                            >
                              会社管理で設定
                            </Button>
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>

                    {user.status === "pending" && (
                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleApproveUser(user.id)}
                          disabled={actionLoading === user.id}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <UserCheck className="h-4 w-4 mr-1" />
                          {actionLoading === user.id ? "処理中..." : "承認"}
                        </Button>
                        
                        <Dialog open={showRejectDialog && selectedUser?.id === user.id} onOpenChange={setShowRejectDialog}>
                          <DialogTrigger asChild>
                            <Button
                              onClick={() => setSelectedUser(user)}
                              variant="destructive"
                              disabled={actionLoading === user.id}
                            >
                              <UserX className="h-4 w-4 mr-1" />
                              拒否
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>ユーザー申請拒否</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <p className="text-sm text-gray-600">
                                {user.name}さんの申請を拒否します。拒否理由を入力してください。
                              </p>
                              <textarea
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                placeholder="拒否理由を入力..."
                                className="w-full p-3 border rounded-md resize-none"
                                rows={4}
                              />
                              <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
                                  キャンセル
                                </Button>
                                <Button variant="destructive" onClick={handleRejectUser}>
                                  拒否する
                                </Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {filteredUsers.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            該当するユーザーが見つかりません
          </div>
        )}
      </div>
    </div>
  );
}