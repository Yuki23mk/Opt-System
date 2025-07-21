/**
 * ファイルパス: app/(withSidebar)/account/page.tsx
 * アカウント管理ページ - 統一デザイン刷新版
 */

export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import ProfileTab from "./components/ProfileTab";
import SecurityTab from "./components/SecurityTab";
import SubAccountsTab from "./components/SubAccountsTab";
import { User } from "lucide-react";
import { ENV } from '@/lib/env';

export default async function AccountPage() {
  const token = (await cookies()).get("token")?.value;
  console.log(token); // 確認用ログ

  const res = await fetch(`${ENV.API_URL}/api/auth/me_get`, {
    headers: {
      Authorization: `Bearer ${token ?? ""}`,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    redirect("/login"); // ✅ 有効でない場合のみリダイレクト
  }

  const { user: sessionUser } = await res.json();
  const isMainAccount = sessionUser.systemRole === "main";

  return (
    <div className="fade-in">
      {/* ===== 統一ページヘッダー ===== */}
      <div className="page-header">
        <div>
          <h1 className="page-title text-slate-900 font-bold">
            <User className="page-title-icon" />
            アカウント情報
          </h1>
        </div>
      </div>

      {/* ===== メインコンテンツ ===== */}
      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="mb-4 bg-slate-100 p-1">
          <TabsTrigger 
            value="profile" 
            className="data-[state=active]:bg-[#115e59] data-[state=active]:text-white data-[state=active]:shadow-sm text-xs px-3 py-2"
          >
            プロフィール
          </TabsTrigger>
          <TabsTrigger 
            value="security"
            className="data-[state=active]:bg-[#115e59] data-[state=active]:text-white data-[state=active]:shadow-sm text-xs px-3 py-2"
          >
            セキュリティ
          </TabsTrigger>
          {isMainAccount && (
            <TabsTrigger 
              value="clients"
              className="data-[state=active]:bg-[#115e59] data-[state=active]:text-white data-[state=active]:shadow-sm text-xs px-3 py-2"
            >
              サブアカウント
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="profile">
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-6">
              <ProfileTab session={{ user: sessionUser, expires: "" }} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-6">
              <SecurityTab />
            </CardContent>
          </Card>
        </TabsContent>

        {isMainAccount && (
          <TabsContent value="clients">
            <Card className="border-slate-200 shadow-sm">
              <CardContent className="p-6">
                <SubAccountsTab session={{ user: sessionUser }} token={token} />
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}