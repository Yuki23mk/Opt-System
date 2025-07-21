/**
 * ファイル: app/(withSidebar)/common/components/Button.tsx
 * 統一されたボタンコンポーネント - ベタ塗りティールデザイン
 */

import { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  children: ReactNode;
}

export default function Button({ 
  variant = 'primary', 
  size = 'md', 
  loading = false, 
  disabled,
  children, 
  className = '',
  ...props 
}: ButtonProps) {
  
  // ベース共通スタイル
  const baseStyles = 'font-medium rounded-lg transition-colors inline-flex items-center justify-center';
  
  // バリアント別スタイル - ベタ塗り
  const variantStyles = {
    primary: 'bg-[#115e59] text-white hover:bg-[#0f766e] disabled:bg-slate-300',
    secondary: 'bg-white border-2 border-[#115e59] text-[#115e59] hover:bg-[#115e59] hover:text-white disabled:border-slate-300 disabled:text-slate-400',
    danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300',
    success: 'bg-[#115e59] text-white hover:bg-[#0f766e] disabled:bg-slate-300'
  };
  
  // サイズ別スタイル
  const sizeStyles = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-6 py-2.5 text-sm',
    lg: 'px-8 py-3 text-base'
  };
  
  const buttonClasses = `${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`;
  
  return (
    <button 
      className={buttonClasses}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
      {children}
    </button>
  );
}

/**
 * テーブル用ヘッダーコンポーネント - ベタ塗りティール
 */
export function TableHeader({ children }: { children: ReactNode }) {
  return (
    <thead>
      <tr className="bg-[#115e59]">
        {children}
      </tr>
    </thead>
  );
}

export function TableHeaderCell({ children }: { children: ReactNode }) {
  return (
    <th className="px-6 py-3 text-left text-white font-medium">
      {children}
    </th>
  );
}

/**
 * ステータスバッジコンポーネント - ベタ塗り
 */
interface BadgeProps {
  variant: 'active' | 'pending' | 'inactive' | 'error';
  children: ReactNode;
}

export function StatusBadge({ variant, children }: BadgeProps) {
  const badgeStyles = {
    active: 'bg-[#115e59] text-white',
    pending: 'bg-amber-500 text-white', 
    inactive: 'bg-slate-500 text-white',
    error: 'bg-red-600 text-white'
  };
  
  return (
    <span className={`px-3 py-1 text-xs font-medium rounded ${badgeStyles[variant]}`}>
      {children}
    </span>
  );
}

/**
 * カードコンポーネント - ベタ塗り
 */
interface CardProps {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <div className={`bg-white rounded-lg border border-slate-200 overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({ children }: { children: ReactNode }) {
  return (
    <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
      {children}
    </div>
  );
}

export function CardContent({ children }: { children: ReactNode }) {
  return (
    <div className="p-6">
      {children}
    </div>
  );
}

export function CardFooter({ children }: { children: ReactNode }) {
  return (
    <div className="bg-slate-50 px-6 py-3 border-t border-slate-200">
      {children}
    </div>
  );
}