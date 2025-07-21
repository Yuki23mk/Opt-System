// app/(withSidebar)/account/components/ProfileTab.tsx - フォントサイズ統一版
"use client";

import { Session } from "next-auth";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useConfirmModal } from "../../common/components/ConfirmModal";
import { useNotification } from "../../common/hooks/useNotification";
import { ToastContainer } from "../../common/components/Toast";
import { ENV } from '@/lib/env';

type ProfileData = {
  name: string;
  company: string;
  department?: string;
  position?: string;
  phone?: string;
};

export default function ProfileTab({ session }: { session: Session | null }) {
  const [formData, setFormData] = useState<ProfileData>({
    name: "",
    company: "",
    department: "",
    position: "",
    phone: "",
  });

  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const router = useRouter();
  
  const { openConfirm } = useConfirmModal();
  const { toasts, success, error, removeToast } = useNotification();

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        let token: string | null = localStorage.getItem("token");
        let retries = 5;
        while (!token && retries > 0) {
          await new Promise((resolve) => setTimeout(resolve, 200));
          token = localStorage.getItem("token");
          retries--;
        }

        if (!token) return;

        const res = await fetch(`${ENV.API_URL}/api/auth/me_get`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          credentials: "include",
        });

        if (!res.ok) {
          error("プロフィール情報の取得に失敗しました");
          return;
        }

        const data = await res.json();
        const u = data.user ?? data;

        setFormData({
          name: u.name ?? "",
          company: u.company ?? u.companyRel?.name ?? "",
          department: u.department ?? "",
          position: u.position ?? "",
          phone: u.phone ?? "",
        });
      } catch (err) {
        console.error("プロフィール取得エラー:", err);
        error("プロフィール取得に失敗しました");
      }
    };
    fetchProfile();
  }, [error]);

  const handleLogout = async () => {
    if (isLoggingOut) return;

    openConfirm({
      type: 'warning',
      title: 'ログアウト確認',
      message: 'ログアウトしますか？',
      confirmText: 'ログアウト',
      cancelText: 'キャンセル',
      onConfirm: async () => {
        try {
          setIsLoggingOut(true);
          localStorage.removeItem("token");
          document.cookie = "token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
          await new Promise(resolve => setTimeout(resolve, 500));
          success("ログアウトしました");
          await new Promise(resolve => setTimeout(resolve, 800));
          router.push("/login");
        } catch (error) {
          console.error("ログアウトエラー:", error);
          error("ログアウト中にエラーが発生しました");
          setIsLoggingOut(false);
        }
      }
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isUpdating) return;

    setIsUpdating(true);

    try {
      const token = localStorage.getItem("token");

      const res = await fetch(`${ENV.API_URL}/api/users/me_put`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
        credentials: "include",
      });

      if (!res.ok) {
        const errorData = await res.text();
        console.error("APIエラー:", errorData);
        throw new Error(`更新に失敗しました: ${res.status}`);
      }

      const updated = await res.json();
      
      setFormData((p) => ({ 
        ...p, 
        name: updated.user?.name ?? p.name,
        company: updated.user?.companyRel?.name ?? p.company,
        department: updated.user?.department ?? p.department,
        position: updated.user?.position ?? p.position,
        phone: updated.user?.phone ?? p.phone,
      }));

      success("プロフィールを更新しました");

    } catch (err) {
      console.error("プロフィール更新エラー:", err);
      error(`更新に失敗しました: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8">
      {/* ログアウト中のオーバーレイ */}
      {isLoggingOut && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 flex flex-col items-center space-y-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#115e59]"></div>
            <p className="text-xs font-medium text-slate-700">ログアウトしています...</p>
            <p className="text-xs text-slate-500">しばらくお待ちください</p>
          </div>
        </div>
      )}

      {/* 左カラム - プロフィール表示 */}
      <div className="w-full lg:w-1/3">
        <div className="border border-slate-200 rounded-lg p-6 bg-slate-50">
          <div className="text-center">
            <div className="w-20 h-20 bg-teal-100 rounded-full mx-auto mb-4 flex items-center justify-center">
              <User className="w-12 h-12 text-[#115e59]" />
            </div>

            <div className="text-xs font-semibold text-slate-700 mb-1">
              {formData.name || "未設定ユーザー"}
            </div>
            <div className="text-xs text-slate-500 mb-4">
              {formData.company || "未設定の会社名"}
            </div>
          </div>

          <div className="space-y-3 text-xs border-t border-slate-200 pt-4">
            <div className="flex justify-between">
              <span className="text-slate-500">メール:</span>
              <span className="text-slate-700">{session?.user?.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">部署:</span>
              <span className="text-slate-700">{formData.department || "未設定"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">役職:</span>
              <span className="text-slate-700">{formData.position || "未設定"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">電話:</span>
              <span className="text-slate-700">{formData.phone || "未登録"}</span>
            </div>
          </div>

      <Button
        variant="outline"
        onClick={handleLogout}
        disabled={isLoggingOut}
        className="w-full mt-6 text-xs border-red-500 text-red-600 hover:bg-red-600 hover:text-white disabled:opacity-50"
      >
        {isLoggingOut ? 'ログアウト中...' : 'ログアウト'}
      </Button>        
      </div>
      </div>

      {/* 右カラム - 編集フォーム */}
      <div className="w-full lg:w-2/3">
        <div className="border border-slate-200 rounded-lg p-6">
          <h3 className="text-xs font-semibold text-slate-700 mb-4">プロフィール編集</h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  氏名
                </label>
                <Input
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  disabled={isLoggingOut || isUpdating}
                  placeholder="氏名を入力"
                  className="text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  会社名
                </label>
                <Input
                  name="company"
                  value={formData.company}
                  onChange={handleChange}
                  disabled={isLoggingOut || isUpdating}
                  placeholder="会社名を入力"
                  className="text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  部署名
                </label>
                <Input
                  name="department"
                  value={formData.department}
                  onChange={handleChange}
                  disabled={isLoggingOut || isUpdating}
                  placeholder="部署名を入力"
                  className="text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  役職
                </label>
                <Input
                  name="position"
                  value={formData.position}
                  onChange={handleChange}
                  disabled={isLoggingOut || isUpdating}
                  placeholder="役職を入力"
                  className="text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                電話番号
              </label>
              <Input
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                disabled={isLoggingOut || isUpdating}
                placeholder="電話番号を入力"
                className="text-xs"
              />
            </div>

            <div className="flex justify-end pt-4">
              <Button
                type="submit"
                disabled={isLoggingOut || isUpdating}
                className="text-xs bg-[#115e59] hover:bg-[#0f766e] text-white disabled:opacity-50"
              >
                {isUpdating ? '更新中...' : 'プロフィールを更新'}
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* Toast通知 */}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  );
}