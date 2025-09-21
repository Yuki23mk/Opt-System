/**
 * ファイルパス: optioil-admin/app/users/page.tsx
 * 管理者画面 - ユーザー管理ページ（階層表示対応版）
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
import { Search, UserCheck, UserX, Building2, AlertTriangle, ArrowLeft, Users, ChevronDown, ChevronRight, UserMinus } from "lucide-react";
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
  systemRole: "main" | "child";
  createdById?: number | null; // サブアカウント用
  children?: User[]; // サブアカウント用
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
  const [mainUsers, setMainUsers] = useState<User[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "active" | "deleted">("all");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [expandedUsers, setExpandedUsers] = useState<Set<number>>(new Set()); // 🔄 初期状態を空に変更

  const API_URL = ENV.API_URL;

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
      console.log("🔍 APIコール:", { API_URL, fullUrl, token: token ? "あり" : "なし" });
      
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
        
        // メインアカウントのみを抽出し、サブアカウントを階層化
        const allUsers = data.users || [];
        console.log("📊 全ユーザー数:", allUsers.length);
        
        // ユーザーデータの詳細ログ
        allUsers.forEach((user: User) => {
          console.log(`👤 ユーザー: ${user.name} (${user.systemRole}) - 作成者ID: ${user.createdById}`);
        });
        
        // メインアカウントのみを抽出
        const mainAccounts = allUsers.filter((user: User) => user.systemRole === "main");
        console.log("🏢 メインアカウント数:", mainAccounts.length);
        
        // サブアカウントを抽出
        const subAccounts = allUsers.filter((user: User) => user.systemRole === "child");
        console.log("👥 サブアカウント数:", subAccounts.length);
        
        // 各メインアカウントにサブアカウントを追加
        const hierarchicalUsers = mainAccounts.map((mainUser: User) => {
          const children = subAccounts.filter((subUser: User) => {
            // createdByIdで関連付け、またはcompanyIdが同じ場合も考慮
            const isChildOfMain = subUser.createdById === mainUser.id || 
                                 (subUser.companyRel.id === mainUser.companyRel.id && subUser.systemRole === "child");
            
            if (isChildOfMain) {
              console.log(`🔗 ${subUser.name} は ${mainUser.name} のサブアカウント`);
            }
            
            return isChildOfMain;
          });
          
          console.log(`👨‍👩‍👧‍👦 ${mainUser.name} のサブアカウント数: ${children.length}`);
          
          return {
            ...mainUser,
            children: children
          };
        });
        
        console.log("🏗️ 階層化されたユーザー:", hierarchicalUsers);
        
        setMainUsers(hierarchicalUsers);
        
        // 🔄 初期状態では全て閉じた状態にする（コメントアウト）
        // const usersWithChildren = hierarchicalUsers
        //   .filter(user => user.children && user.children.length > 0)
        //   .map(user => user.id);
        
        // if (usersWithChildren.length > 0) {
        //   setExpandedUsers(new Set(usersWithChildren));
        //   console.log("🔽 初期展開ユーザー:", usersWithChildren);
        // }
        
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

  // ✨ サブアカウント数の計算（アクティブと削除済みを分離）
  const getChildrenCounts = (children: User[]) => {
    const active = children.filter(child => child.status === "active").length;
    const deleted = children.filter(child => child.status === "deleted").length;
    return { active, deleted, total: children.length };
  };

  // ユーザー承認（メインアカウントのみ）
  const handleApproveUser = async (userId: number) => {
    const user = findUserById(userId);
    if (!user || user.systemRole !== "main") return;

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

  // ユーザー拒否（メインアカウントのみ）
  const handleRejectUser = async () => {
    if (!selectedUser || !rejectReason.trim() || selectedUser.systemRole !== "main") {
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

  // ユーザー検索（階層対応）
  const findUserById = (userId: number): User | null => {
    for (const mainUser of mainUsers) {
      if (mainUser.id === userId) return mainUser;
      if (mainUser.children) {
        const childUser = mainUser.children.find(child => child.id === userId);
        if (childUser) return childUser;
      }
    }
    return null;
  };

  // フィルタリング
  const filteredUsers = mainUsers.filter(user => {
    const matchesSearch = 
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.companyRel.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.children && user.children.some(child => 
        child.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        child.email.toLowerCase().includes(searchTerm.toLowerCase())
      ));
    
    const matchesStatus = filterStatus === "all" || user.status === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  // 展開/折りたたみ
  const toggleExpanded = (userId: number) => {
    const newExpanded = new Set(expandedUsers);
    if (newExpanded.has(userId)) {
      newExpanded.delete(userId);
    } else {
      newExpanded.add(userId);
    }
    setExpandedUsers(newExpanded);
    console.log("🔄 展開状態更新:", { userId, expanded: !expandedUsers.has(userId) });
  };

  // ステータス表示（メインアカウント用）
  const getMainStatusBadge = (status: string) => {
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

  // ステータス表示（サブアカウント用：削除済みのみ表示）
  const getSubStatusBadge = (status: string) => {
    switch (status) {
      case "deleted":
        return <Badge className="bg-gray-100 text-gray-800 border-gray-200">削除済み</Badge>;
      default:
        return null; // 承認系ステータスは非表示
    }
  };

  // 会社の製品設定状況チェック
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

        {/* ユーザー一覧（階層表示） */}
        <div className="grid gap-4">
          {filteredUsers.map((mainUser) => {
            const hasCompanyProducts = getCompanyProductStatus(mainUser.companyRel.id);
            const isExpanded = expandedUsers.has(mainUser.id);
            const hasChildren = mainUser.children && mainUser.children.length > 0;
            
            // ✨ サブアカウント数の計算
            const childCounts = hasChildren ? getChildrenCounts(mainUser.children!) : { active: 0, deleted: 0, total: 0 };
            
            console.log(`🎭 描画中: ${mainUser.name}, サブアカウント: ${hasChildren ? mainUser.children?.length : 0}, 展開: ${isExpanded}`);
            
            return (
              <Card key={mainUser.id} className={mainUser.status === "pending" ? "border-red-200 bg-red-50" : ""}>
                <CardContent className="p-3">
                  {/* メインアカウント */}
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <div className="flex items-center gap-2">
                          {hasChildren && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => toggleExpanded(mainUser.id)}
                              className={`
                                h-8 w-8 p-0 transition-all duration-200 border-2
                                ${isExpanded 
                                  ? 'bg-blue-500 border-blue-500 text-white hover:bg-blue-600' 
                                  : 'bg-white border-blue-300 text-blue-500 hover:bg-blue-50 hover:border-blue-400'
                                }
                              `}
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                          <h3 className="font-semibold text-base">{mainUser.name}</h3>
                          <Badge variant="outline" className="text-xs bg-blue-50 border-blue-200">メイン</Badge>
                        </div>
                        {getMainStatusBadge(mainUser.status)}
                        {hasChildren && (
                          <div className="flex items-center gap-2">
                            {/* アクティブユーザー数 */}
                            {childCounts.active > 0 && (
                              <div className="flex items-center gap-1 text-blue-600 bg-blue-50 px-2 py-1 rounded-md">
                                <Users className="h-4 w-4" />
                                <span className="text-sm font-medium">{childCounts.active}名</span>
                              </div>
                            )}
                            {/* 削除済みユーザー数 */}
                            {childCounts.deleted > 0 && (
                              <div className="flex items-center gap-1 text-gray-500 bg-gray-100 px-2 py-1 rounded-md">
                                <UserMinus className="h-4 w-4" />
                                <span className="text-sm">削除済み{childCounts.deleted}名</span>
                              </div>
                            )}
                          </div>
                        )}
                        {mainUser.status === "pending" && !hasCompanyProducts && (
                          <div className="flex items-center gap-1 text-amber-600">
                            <AlertTriangle className="h-4 w-4" />
                            <span className="text-sm">製品設定要</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                        <div>
                          <p><strong>メール:</strong> {mainUser.email}</p>
                          <p><strong>会社:</strong> {mainUser.companyRel.name}</p>
                          {mainUser.department && <p><strong>部署:</strong> {mainUser.department}</p>}
                        </div>
                        <div>
                          {mainUser.position && <p><strong>役職:</strong> {mainUser.position}</p>}
                          {mainUser.phone && <p><strong>電話:</strong> {mainUser.phone}</p>}
                          <p><strong>申請日:</strong> {new Date(mainUser.createdAt).toLocaleDateString('ja-JP')}</p>
                        </div>
                      </div>

                      {mainUser.status === "pending" && !hasCompanyProducts && (
                        <Alert className="mt-3 border-amber-200 bg-amber-50">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertDescription>
                            承認前に「{mainUser.companyRel.name}」の表示製品設定が必要です。
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

                    {/* メインアカウント用承認ボタン */}
                    {mainUser.status === "pending" && (
                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleApproveUser(mainUser.id)}
                          disabled={actionLoading === mainUser.id}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <UserCheck className="h-4 w-4 mr-1" />
                          {actionLoading === mainUser.id ? "処理中..." : "承認"}
                        </Button>
                        
                        <Dialog open={showRejectDialog && selectedUser?.id === mainUser.id} onOpenChange={setShowRejectDialog}>
                          <DialogTrigger asChild>
                            <Button
                              onClick={() => setSelectedUser(mainUser)}
                              variant="destructive"
                              disabled={actionLoading === mainUser.id}
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
                                {mainUser.name}さんの申請を拒否します。拒否理由を入力してください。
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

                  {/* サブアカウント表示 */}
                  {hasChildren && isExpanded && (
                    <div className="mt-4 ml-8 border-l-3 border-blue-200 pl-4 space-y-3 bg-blue-50/30 rounded-r-lg py-3">
                      <div className="text-sm text-blue-700 font-medium flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        サブアカウント
                        {childCounts.active > 0 && (
                          <span className="text-blue-600">({childCounts.active}名)</span>
                        )}
                        {childCounts.deleted > 0 && (
                          <span className="text-gray-500">・削除済み{childCounts.deleted}名</span>
                        )}
                      </div>
                      {mainUser.children?.map((childUser) => {
                        const statusBadge = getSubStatusBadge(childUser.status);
                        
                        return (
                          <div key={childUser.id} className="bg-white rounded-md p-3 border border-blue-100">
                            <div className="flex items-center gap-3 mb-2">
                              <h4 className="font-medium text-sm">{childUser.name}</h4>
                              <Badge variant="outline" className="text-xs bg-gray-50 border-gray-200">サブ</Badge>
                              {statusBadge}
                            </div>
                            
                            <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                              <div>
                                <p><strong>メール:</strong> {childUser.email}</p>
                                {childUser.department && <p><strong>部署:</strong> {childUser.department}</p>}
                              </div>
                              <div>
                                {childUser.position && <p><strong>役職:</strong> {childUser.position}</p>}
                                <p><strong>作成日:</strong> {new Date(childUser.createdAt).toLocaleDateString('ja-JP')}</p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
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