import React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, leftIcon, rightIcon, id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-semibold text-[#111827]">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-3.5 flex items-center pointer-events-none text-[#9CA3AF]">
              {leftIcon}
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            className={cn(
              'w-full min-h-[46px] px-3.5 py-2.5 text-sm bg-[#FFFFFF] border rounded-md text-[#111827] placeholder-[#9CA3AF] transition-colors',
              'focus:outline-none focus:border-[#F95700] focus:ring-2 focus:ring-[#F95700]/15',
              error
                ? 'border-[#EF4444] focus:border-[#EF4444] focus:ring-[#EF4444]/15'
                : 'border-[#E5E7EB]',
              leftIcon && 'pl-10',
              rightIcon && 'pr-10',
              'disabled:bg-[#F3F4F6] disabled:text-[#9CA3AF] disabled:cursor-not-allowed',
              className
            )}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3.5 flex items-center text-[#9CA3AF]">
              {rightIcon}
            </div>
          )}
        </div>
        {error ? (
          <p className="text-xs text-[#EF4444] font-medium">{error}</p>
        ) : hint ? (
          <p className="text-xs text-[#6B7280]">{hint}</p>
        ) : null}
      </div>
    );
  }
);
Input.displayName = 'Input';
