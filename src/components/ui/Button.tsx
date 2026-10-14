'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  loadingText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      loadingText = 'Please wait...',
      leftIcon,
      rightIcon,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'relative inline-flex items-center justify-center font-semibold rounded-md transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-55 disabled:cursor-not-allowed select-none active:scale-[0.98]';

    const variants = {
      primary:
        'bg-[#F95700] hover:bg-[#E04E00] text-white shadow-sm focus:ring-[#F95700]/50 border border-transparent',
      secondary:
        'bg-[#111827] hover:bg-[#1F2937] text-white shadow-sm focus:ring-[#111827]/50 border border-transparent',
      outline:
        'bg-white hover:bg-[#F9FAFB] text-[#111827] border border-[#E5E7EB] hover:border-[#F95700] hover:text-[#F95700] focus:ring-[#F95700]/30',
      danger:
        'bg-[#EF4444] hover:bg-[#DC2626] text-white shadow-sm focus:ring-[#EF4444]/50 border border-transparent',
      ghost:
        'bg-transparent hover:bg-[#F3F4F6] text-[#F95700] focus:ring-[#F95700]/30',
    };

    const sizes = {
      sm: 'text-xs px-3 py-1.5 gap-1.5 min-h-[34px]',
      md: 'text-sm px-4 py-2 gap-2 min-h-[42px]',
      lg: 'text-base px-6 py-3 gap-2.5 min-h-[48px]',
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        disabled={disabled || isLoading}
        aria-busy={isLoading}
        {...props}
      >
        {isLoading ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin shrink-0 text-current opacity-90" />
            <span className="truncate">{loadingText}</span>
          </span>
        ) : (
          <>
            {leftIcon && <span className="inline-flex shrink-0">{leftIcon}</span>}
            <span className="truncate">{children}</span>
            {rightIcon && <span className="inline-flex shrink-0">{rightIcon}</span>}
          </>
        )}
      </button>
    );
  }
);
Button.displayName = 'Button';
