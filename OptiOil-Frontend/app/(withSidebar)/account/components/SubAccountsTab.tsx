/**
 * ファイルパス: app/(withSidebar)/account/components/SubAccountsTab.tsx
 * サブアカウント管理タブ - 3つまで制限対応版 - フォントサイズ統一 - TypeScriptエラー修正
 */

"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { User, UserPlus, Edit, Trash2, Shield, Eye, EyeOff, AlertCircle } from "lucide-react";
import { useConfirmModal } from "../../common/components/ConfirmModal";
import { useNotification } from "../../common/hooks/useNotification";
import { ToastContainer } from "../../common/components/Toast";
import { ENV } from '@/lib/env';

// 🔧 型定義を明確化
interface ClientUserPermissions {
  products: boolean;
  orders: boolean;
  equipment: boolean;
  settings: boolean;
}

interface ClientUser {
  id: number;
  email: string;
  name: string;
  department: string | null;
  position: string | null;
  phone: string | null;
  permissions: ClientUserPermissions;
}

// 🔧 編集データ用の型を別途定義
interface EditClientData {
  name?: string;
  department?: string | null;
  position?: string | null;
  phone?: string | null;
  permissions?: ClientUserPermissions;
}

export default function SubAccountsTab({
  session,
  token,
}: {
  session: { user: any };
  token: string;
}) {
  const [clients, setClients] = useState<ClientUser[]>([]);
  const [selectedClient, setSelectedClient] = useState<ClientUser | null>(null);
  const [editData, setEditData] = useState<EditClientData>({}); // 🔧 型を明確化
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newClient, setNewClient] = useState({
    email: "",
    name: "",
    phone: "",
    department: "",
    position: "",
  });

  const { openConfirm } = useConfirmModal();
  const { toasts, success, error, removeToast } = useNotification();

  // ✅ サブアカウント数制限の定数
  const MAX_SUB_ACCOUNTS = 3;
  const canAddNewAccount = clients.length < MAX_SUB_ACCOUNTS;

  useEffect(() => {
    if (token) {
      fetchClients();
    }
  }, [token]);

  const fetchClients = async () => {
    if (!token) {
      console.error("トークンが存在しません");
      return;
    }

    try {
      const res = await fetch(`${ENV.API_URL}/api/users/children`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
      });

      if (!res.ok) {
        error("サブアカウント取得に失敗しました");
        return;
      }

      const data = await res.json();
      setClients(data);
      
      // 初回は最初のアカウントを選択
      if (data.length > 0 && !selectedClient) {
        setSelectedClient(data[0]);
        initEditData(data[0]);
      }
    } catch (err) {
      console.error("サブアカウント取得エラー:", err);
      error("サブアカウント取得に失敗しました");
    }
  };

  const initEditData = (client: ClientUser) => {
    setEditData({
      name: client.name,
      department: client.department,
      position: client.position,
      phone: client.phone,
      permissions: client.permissions || { products: true, orders: true, equipment: true, settings: true },
    });
  };

  const handleSelectClient = (client: ClientUser) => {
    setSelectedClient(client);
    initEditData(client);
  };

  // 🔧 型安全なhandleEditChange
  const handleEditChange = (field: keyof EditClientData, value: any) => {
    setEditData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  // 🔧 型安全なhandlePermissionChange
  const handlePermissionChange = (key: keyof ClientUserPermissions, value: boolean) => {
    setEditData(prev => ({
      ...prev,
      permissions: {
        products: true,
        orders: true,
        equipment: true,
        settings: true,
        ...(prev.permissions || {}), // 既存のパーミッションを保持
        [key]: value, // 指定されたキーのみ更新
      },
    }));
  };

  const handleUpdate = async () => {
    if (!selectedClient) return;

    try {
      if (!token) throw new Error("トークンがありません");

      const { name, phone, department, position, permissions } = editData;

      const res = await fetch(`${ENV.API_URL}/api/users/${selectedClient.id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          phone,
          department,
          position,
          permissions: permissions ? JSON.stringify(permissions) : null,
        }),
      });

      if (!res.ok) throw new Error("更新失敗");

      await fetchClients();
      success("サブアカウントを更新しました");

    } catch (err) {
      console.error(err);
      error("更新に失敗しました");
    }
  };

  const handleDelete = async (client: ClientUser) => {
    openConfirm({
      type: 'danger',
      title: 'アカウント削除',
      message: `${client.name}のアカウントを削除しますか？\n\n注文履歴や設備データは保持されますが、ログインはできなくなります。`,
      confirmText: '削除する',
      cancelText: 'キャンセル',
      onConfirm: async () => {
        try {
          if (!token) throw new Error("トークンがありません");

          const res = await fetch(`${ENV.API_URL}/api/users/${client.id}`, {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${token}`,
            },
            credentials: "include",
          });

          if (!res.ok) throw new Error("削除失敗");

          await fetchClients();
          
          // 削除したクライアントが選択されていた場合、選択を解除
          if (selectedClient?.id === client.id) {
            const remainingClients = clients.filter(c => c.id !== client.id);
            if (remainingClients.length > 0) {
              setSelectedClient(remainingClients[0]);
              initEditData(remainingClients[0]);
            } else {
              setSelectedClient(null);
              setEditData({});
            }
          }

          success(`${client.name}のアカウントを削除しました（注文履歴・データは保持されます）`);

        } catch (err) {
          console.error(err);
          error("削除に失敗しました");
        }
      }
    });
  };

  const handleCreate = async () => {
    const { email, name } = newClient;

    if (!email || !name) {
      error("メールアドレス、氏名は必須項目です");
      return;
    }

    try {
      if (!token) throw new Error("トークンがありません");

      const res = await fetch(`${ENV.API_URL}/api/users/children_register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: newClient.email,
          name: newClient.name,
          phone: newClient.phone || null,
          position: newClient.position || null,
          department: newClient.department || null,
          generateTempPassword: true,  // 一時パスワード生成を明示的に指定
          sendNotificationEmail: true, // メール送信を明示的に指定
          permissions: {
            products: true,
            orders: true,
            equipment: true,
            settings: true,
          },
        }),
      });

      const responseData = await res.json();

      if (!res.ok) {
        // ✅ 3つまで制限のエラーメッセージを表示
        throw new Error(responseData.message || "登録失敗");
      }

      await fetchClients();
      setIsAddDialogOpen(false);
      setNewClient({
        email: "",
        name: "",
        phone: "",
        department: "",
        position: "",
      });
      
      // ✅ アカウント数情報も表示
    if (responseData.accountInfo) {
      success(`サブアカウントを登録しました（${responseData.accountInfo.currentCount}/${responseData.accountInfo.maxCount}）\n一時パスワードをメールで送信しました。`);
    } else {
      success("サブアカウントを登録しました。一時パスワードをメールで送信しました。");
    }

    } catch (err: any) {
      console.error(err);
      error(err.message || "登録に失敗しました");
    }
  };

  // 🔧 型安全なgetPermissionSummary
  const getPermissionSummary = (permissions: ClientUserPermissions) => {
    const enabled = Object.entries(permissions).filter(([_, value]) => value).length;
    const total = Object.keys(permissions).length;
    return `${enabled}/${total}`;
  };

  // 🔧 型安全なgetPermissionLabel
  const getPermissionLabel = (key: keyof ClientUserPermissions) => {
    const labels: Record<keyof ClientUserPermissions, string> = {
      products: "製品一覧",
      orders: "注文履歴", 
      equipment: "設備情報",
      settings: "環境設定"
    };
    return labels[key];
  };

  // 🔧 デフォルト権限の定義
  const defaultPermissions: ClientUserPermissions = {
    products: true,
    orders: true,
    equipment: true,
    settings: true
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8 h-full">
      {/* 左カラム - サブアカウント一覧 */}
      <div className="w-full lg:w-1/3">
        <div className="border border-slate-200 rounded-lg bg-slate-50 h-full">
          {/* ヘッダー */}
          <div className="p-4 border-b border-slate-200">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-xs font-semibold text-slate-700">サブアカウント</h3>
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button 
                    disabled={!canAddNewAccount} // ✅ 3つに達したら無効化
                    className={`text-xs ${canAddNewAccount 
                      ? 'bg-[#115e59] hover:bg-[#0f766e] text-white' 
                      : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    <UserPlus className="w-4 h-4 mr-1" />
                    追加
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="text-xs text-slate-700">サブアカウント登録</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-medium text-slate-600">
                        メールアドレス<span className="text-red-500">*</span>
                      </label>
                      <Input
                        placeholder="メールアドレス"
                        value={newClient.email}
                        onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                        className="mt-1 text-xs"
                      />
                    </div>

                  <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <div className="flex items-start">
                      <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5 mr-2 flex-shrink-0" />
                      <div className="text-xs text-blue-700">
                        <p className="font-medium mb-1">一時パスワードについて</p>
                        <p>登録完了後、入力されたメールアドレスに一時パスワードが送信されます。</p>
                        <p>初回ログイン後は必ずパスワードを変更してください。</p>
                      </div>
                    </div>
                  </div>

                    <div>
                      <label className="text-xs font-medium text-slate-600">
                        氏名<span className="text-red-500">*</span>
                      </label>
                      <Input
                        placeholder="氏名"
                        value={newClient.name}
                        onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                        className="mt-1 text-xs"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-medium text-slate-600">部署</label>
                      <Input
                        placeholder="部署"
                        value={newClient.department}
                        onChange={(e) => setNewClient({ ...newClient, department: e.target.value })}
                        className="mt-1 text-xs"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-medium text-slate-600">役職</label>
                      <Input
                        placeholder="役職"
                        value={newClient.position}
                        onChange={(e) => setNewClient({ ...newClient, position: e.target.value })}
                        className="mt-1 text-xs"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-medium text-slate-600">電話番号</label>
                      <Input
                        placeholder="電話番号"
                        value={newClient.phone}
                        onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                        className="mt-1 text-xs"
                      />
                    </div>

                    <div className="pt-4 flex justify-end space-x-2">
                      <Button 
                        onClick={() => setIsAddDialogOpen(false)}
                        className="text-xs text-slate-600"
                      >
                        キャンセル
                      </Button>
                      <Button 
                        onClick={handleCreate}
                        className="text-xs bg-[#115e59] hover:bg-[#0f766e] text-white"
                      >
                        登録
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            
            {/* ✅ アカウント数制限の表示 */}
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500">
                {clients.length}/{MAX_SUB_ACCOUNTS}個のサブアカウント
              </p>
              {!canAddNewAccount && (
                <div className="flex items-center text-xs text-amber-600">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  上限
                </div>
              )}
            </div>
            
            {/* ✅ 制限に達した場合の案内 */}
            {!canAddNewAccount && (
              <div className="mt-2 text-xs text-slate-500 bg-amber-50 border border-amber-200 rounded p-2">
                最大3つまでのサブアカウントを作成できます。新しいアカウントを追加するには、既存のアカウントを削除してください。
              </div>
            )}
          </div>

          {/* アカウント一覧 */}
          <div className="overflow-y-auto max-h-96">
            {clients.length === 0 ? (
              <div className="p-6 text-center text-slate-500">
                <User className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-xs">サブアカウントがありません</p>
                <p className="text-xs">「追加」ボタンから作成できます</p>
              </div>
            ) : (
              clients.map((client) => (
                <div
                  key={client.id}
                  onClick={() => handleSelectClient(client)}
                  className={`
                    p-4 border-b border-slate-200 cursor-pointer transition-colors
                    ${selectedClient?.id === client.id 
                      ? 'bg-teal-50 border-l-4 border-l-[#115e59]' 
                      : 'hover:bg-slate-100'
                    }
                  `}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-slate-700 text-xs">{client.name}</div>
                      <div className="text-xs text-slate-500">{client.email}</div>
                      <div className="text-xs text-slate-400 mt-1">
                        {client.position || "役職未設定"} • {client.department || "部署未設定"}
                      </div>
                    </div>
                    <div className="flex items-center space-x-1 ml-2">
                      <Shield className="w-4 h-4 text-slate-400" />
                      <span className="text-xs text-slate-500">
                        {getPermissionSummary(client.permissions)}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 右カラム - 詳細・編集 */}
      <div className="w-full lg:w-2/3">
        {selectedClient ? (
          <div className="border border-slate-200 rounded-lg bg-white">
            {/* ヘッダー */}
            <div className="p-6 border-b border-slate-200">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-xs font-semibold text-slate-700">{selectedClient.name}</h3>
                  <p className="text-xs text-slate-500">{selectedClient.email}</p>
                </div>
                <Button
                  variant="destructive"
                  onClick={() => handleDelete(selectedClient)}
                  //className="text-xs border-red-500 text-red-600 hover:bg-red-50"
                  className="hover:bg-red-600 hover:text-white"
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  削除
                </Button>
              </div>
            </div>

            {/* 編集フォーム */}
            <div className="p-6 space-y-6">
              {/* 基本情報 */}
              <div>
                <h4 className="text-xs font-medium text-slate-700 mb-4">基本情報</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      氏名
                    </label>
                    <Input
                      value={editData.name || ""}
                      onChange={(e) => handleEditChange("name", e.target.value)}
                      placeholder="氏名"
                      className="text-xs"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      電話番号
                    </label>
                    <Input
                      value={editData.phone || ""}
                      onChange={(e) => handleEditChange("phone", e.target.value)}
                      placeholder="電話番号"
                      className="text-xs"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      部署
                    </label>
                    <Input
                      value={editData.department || ""}
                      onChange={(e) => handleEditChange("department", e.target.value)}
                      placeholder="部署"
                      className="text-xs"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      役職
                    </label>
                    <Input
                      value={editData.position || ""}
                      onChange={(e) => handleEditChange("position", e.target.value)}
                      placeholder="役職"
                      className="text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* 権限設定 */}
              <div>
                <h4 className="text-xs font-medium text-slate-700 mb-4">画面表示設定</h4>
                <div className="space-y-4">
                  {/* 🔧 安全な権限表示 */}
                  {Object.entries(editData.permissions || defaultPermissions).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        {value ? (
                          <Eye className="w-5 h-5 text-[#115e59]" />
                        ) : (
                          <EyeOff className="w-5 h-5 text-slate-400" />
                        )}
                        <div>
                          <div className="font-medium text-slate-700 text-xs">
                            {getPermissionLabel(key as keyof ClientUserPermissions)}
                          </div>
                          <div className="text-xs text-slate-500">
                            {value ? "表示中" : "非表示"}
                          </div>
                        </div>
                      </div>
                      <Switch
                        checked={value}
                        onCheckedChange={(checked) => 
                          handlePermissionChange(key as keyof ClientUserPermissions, checked)
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* 更新ボタン */}
              <div className="flex justify-end pt-4">
                <Button
                  onClick={handleUpdate}
                  className="text-xs bg-[#115e59] hover:bg-[#0f766e] text-white"
                >
                  <Edit className="w-4 h-4 mr-1" />
                  更新する
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="border border-slate-200 rounded-lg bg-white p-12 text-center">
            <User className="w-16 h-16 mx-auto mb-4 text-slate-300" />
            <h3 className="text-xs font-medium text-slate-500 mb-2">サブアカウントを選択</h3>
            <p className="text-xs text-slate-400">
              左側の一覧からサブアカウントを選択して詳細を表示・編集できます
            </p>
          </div>
        )}
      </div>

      {/* Toast通知 */}
      <ToastContainer toasts={toasts} onClose={removeToast} />
      
    </div>
  );
}