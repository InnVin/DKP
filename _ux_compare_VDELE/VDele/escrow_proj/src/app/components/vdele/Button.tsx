import React from 'react';
import { Loader2 } from 'lucide-react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'outline';
type ButtonSize = 'lg' | 'md' | 'sm';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: React.ReactNode;
}

export function Button({ variant = 'primary', size = 'lg', loading, disabled, className = '', children, ...props }: ButtonProps) {
  const base = 'font-semibold transition-all duration-200 flex items-center justify-center gap-2 active:scale-[0.97]';
  
  const sizes = {
    lg: 'h-[50px] px-6 text-[15px] rounded-[14px]',
    md: 'h-[44px] px-5 text-[14px] rounded-[12px]',
    sm: 'h-[36px] px-4 text-[13px] rounded-[10px]',
  };
  
  const variants = {
    primary: 'bg-[#14B8A6] text-white shadow-sm shadow-[#14B8A6]/30 disabled:opacity-40',
    secondary: 'bg-[#14B8A6]/10 text-[#0F766E] disabled:opacity-40',
    outline: 'bg-transparent text-gray-600 ring-1 ring-gray-200 disabled:opacity-40',
    danger: 'bg-red-500/10 text-red-600 disabled:opacity-40',
  };

  return (
    <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} disabled={disabled || loading} {...props}>
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
}
