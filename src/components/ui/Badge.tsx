import React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'premium';
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant = 'secondary',
  children,
  ...props
}) => {
  const variants = {
    primary: 'bg-[#FFF5F0] text-[#F95700] border border-[#F95700]/20',
    secondary: 'bg-[#F3F4F6] text-[#4B5563] border border-[#E5E7EB]',
    success: 'bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0]',
    warning: 'bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A]',
    danger: 'bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]',
    premium: 'bg-gradient-to-r from-[#F95700] to-[#F59E0B] text-white shadow-xs font-bold tracking-wide uppercase',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold select-none',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
};
