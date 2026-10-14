'use client';

import React from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { CheckCircle2, XCircle, AlertCircle, Loader2, X } from 'lucide-react';

export type StatusModalType = 'loading' | 'success' | 'error' | null;

export interface StatusModalProps {
  isOpen: boolean;
  type: StatusModalType;
  title: string;
  message?: string;
  actionText?: string;
  onAction?: () => void;
  secondaryText?: string;
  onSecondary?: () => void;
  onClose?: () => void;
  disableBackdropClick?: boolean;
}

export function StatusModal({
  isOpen,
  type,
  title,
  message,
  actionText = 'Done',
  onAction,
  secondaryText,
  onSecondary,
  onClose,
  disableBackdropClick = false,
}: StatusModalProps) {
  if (!isOpen || !type) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !disableBackdropClick && type !== 'loading' && onClose) {
      onClose();
    }
  };

  return (
    <div
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200"
    >
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-5 sm:p-7 border border-[#E5E7EB] text-center space-y-4 sm:space-y-5 animate-in zoom-in-95 duration-200 relative max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2.5rem)] overflow-y-auto my-auto">
        {/* Close Button if not loading */}
        {type !== 'loading' && onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full text-[#9CA3AF] hover:text-[#111827] hover:bg-[#F3F4F6] transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Status Animated Icon */}
        <div className="flex justify-center pt-2">
          {type === 'loading' && (
            <div className="relative w-16 h-16 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-[#F95700]/20 animate-pulse" />
              <div className="w-16 h-16 rounded-full border-4 border-[#F95700]/25 border-t-[#F95700] animate-spin" />
              <div className="absolute w-6 h-6 rounded-full bg-[#F95700]/10 flex items-center justify-center">
                <span className="w-2.5 h-2.5 rounded-full bg-[#F95700] animate-ping" />
              </div>
            </div>
          )}

          {type === 'success' && (
            <div className="w-16 h-16 rounded-full bg-[#ECFDF5] border-2 border-[#10B981]/30 text-[#10B981] flex items-center justify-center shadow-sm animate-in zoom-in-75 duration-300">
              <CheckCircle2 className="w-9 h-9 stroke-[2.2]" />
            </div>
          )}

          {type === 'error' && (
            <div className="w-16 h-16 rounded-full bg-[#FEF2F2] border-2 border-[#EF4444]/30 text-[#EF4444] flex items-center justify-center shadow-sm animate-in zoom-in-75 duration-300">
              <XCircle className="w-9 h-9 stroke-[2.2]" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="space-y-2">
          <h3 className="text-lg sm:text-xl font-bold text-[#111827] leading-snug">
            {title}
          </h3>
          {message && (
            <p className="text-xs sm:text-sm text-[#6B7280] leading-relaxed max-w-sm mx-auto">
              {message}
            </p>
          )}
        </div>

        {/* Footer Actions */}
        {type !== 'loading' && (
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2.5">
            {secondaryText && onSecondary && (
              <Button
                size="md"
                variant="outline"
                className="w-full sm:w-auto min-w-[120px] rounded-xl"
                onClick={onSecondary}
              >
                {secondaryText}
              </Button>
            )}
            {actionText && (onAction || onClose) && (
              <Button
                size="md"
                variant="primary"
                className="w-full sm:w-auto min-w-[140px] rounded-xl shadow-xs"
                onClick={onAction || onClose}
              >
                {actionText}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
