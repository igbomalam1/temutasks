'use client';

import React, { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

interface TaskCountdownTimerProps {
  createdAt: string;
  className?: string;
  variant?: 'badge' | 'compact' | 'pill';
  showIcon?: boolean;
}

export const TaskCountdownTimer: React.FC<TaskCountdownTimerProps> = ({
  createdAt,
  className = '',
  variant = 'badge',
  showIcon = true,
}) => {
  const [timeLeft, setTimeLeft] = useState<{
    hours: number;
    minutes: number;
    seconds: number;
    isExpired: boolean;
  }>({ hours: 0, minutes: 0, seconds: 0, isExpired: false });

  useEffect(() => {
    const calculateTimeLeft = () => {
      const createdTime = new Date(createdAt).getTime();
      // 24 hours in milliseconds = 24 * 60 * 60 * 1000 = 86,400,000 ms
      const expiresAt = createdTime + 24 * 60 * 60 * 1000;
      const difference = expiresAt - Date.now();

      if (difference <= 0) {
        return { hours: 0, minutes: 0, seconds: 0, isExpired: true };
      }

      const hours = Math.floor(difference / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      return { hours, minutes, seconds, isExpired: false };
    };

    setTimeLeft(calculateTimeLeft());

    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, [createdAt]);

  const { hours, minutes, seconds, isExpired } = timeLeft;
  const pad = (n: number) => n.toString().padStart(2, '0');

  if (isExpired) {
    return (
      <span
        title="24-hour round completed"
        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#F3F4F6] text-[#6B7280] border border-[#E5E7EB] ${className}`}
      >
        {showIcon && <Clock className="w-3 h-3 text-[#9CA3AF] shrink-0" />}
        <span>Round Ended (24h)</span>
      </span>
    );
  }

  // Visual urgency based on hours remaining:
  // < 3 hours: Urgent red
  // < 8 hours: Warning orange
  // >= 8 hours: Amber / Gold
  let styleClasses = 'bg-[#FFFBEB] text-[#D97706] border-[#FDE68A]';
  let iconClass = 'text-[#D97706]';

  if (hours < 3) {
    styleClasses = 'bg-[#FEF2F2] text-[#DC2626] border-[#FECACA] font-bold animate-pulse';
    iconClass = 'text-[#DC2626]';
  } else if (hours < 8) {
    styleClasses = 'bg-[#FFF5F0] text-[#F95700] border-[#F95700]/30 font-semibold';
    iconClass = 'text-[#F95700]';
  }

  if (variant === 'compact') {
    return (
      <span
        title={`24h Temu Round ends in ${hours}h ${minutes}m ${seconds}s`}
        className={`inline-flex items-center gap-1 text-[11px] font-mono font-medium ${styleClasses} px-2 py-0.5 rounded-md border ${className}`}
      >
        {showIcon && <Clock className={`w-3 h-3 ${iconClass} shrink-0`} />}
        <span>
          {pad(hours)}:{pad(minutes)}:{pad(seconds)}
        </span>
      </span>
    );
  }

  return (
    <span
      title={`Temu tasks expire after 24 hours. Ends in ${hours}h ${minutes}m ${seconds}s`}
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] border font-mono font-semibold ${styleClasses} ${className}`}
    >
      {showIcon && <Clock className={`w-3 h-3 ${iconClass} shrink-0`} />}
      <span>
        {hours > 0 ? `${hours}h ` : ''}
        {pad(minutes)}m {pad(seconds)}s left
      </span>
    </span>
  );
};
