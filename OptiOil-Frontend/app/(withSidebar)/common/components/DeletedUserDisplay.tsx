/**
 * ファイルパス: app/(withSidebar)/common/components/DeletedUserDisplay.tsx
 * 削除済みユーザー統一表示コンポーネント
 */

import { UserX, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface DeletedUserDisplayProps {
  name: string;
  isDeleted: boolean;
  showIcon?: boolean;
  showBadge?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const DeletedUserDisplay = ({ 
  name, 
  isDeleted,
  showIcon = true,
  showBadge = false,
  size = 'md'
}: DeletedUserDisplayProps) => {
  // ✅ 削除済みの場合は一律で「削除済みアカウント」と表示
  const displayText = isDeleted ? "削除済みアカウント" : name;
  
  const iconSize = {
    sm: "w-3 h-3",
    md: "w-4 h-4", 
    lg: "w-5 h-5"
  }[size];

  const textSize = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base"
  }[size];

  if (isDeleted) {
    return (
      <div className="flex items-center space-x-2">
        {showIcon && <UserX className={`${iconSize} text-slate-400`} />}
        <span className={`${textSize} text-slate-500`}>
          {displayText}
        </span>
        {showBadge && (
          <Badge variant="outline" className="text-xs border-slate-300 text-slate-500">
            削除済み
          </Badge>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-2">
      {showIcon && <User className={`${iconSize} text-slate-600`} />}
      <span className={`${textSize} text-slate-700 font-medium`}>
        {displayText}
      </span>
    </div>
  );
};

// ✅ 簡単な関数版も提供
export const getDisplayName = (name: string, isDeleted: boolean): string => {
  return isDeleted ? "削除済みアカウント" : name;
};

// ✅ API用のユーザー情報変換関数
export const formatUserForDisplay = (user: any) => {
  return {
    ...user,
    isDeleted: user.status === "deleted",
    displayName: user.status === "deleted" ? "削除済みアカウント" : user.name
  };
};