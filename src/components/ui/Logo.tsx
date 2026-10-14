import React from 'react';
import Link from 'next/link';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
}

export const Logo: React.FC<LogoProps> = ({
  className = '',
  size = 'md',
  showText = true,
}) => {
  const iconSizes = {
    sm: 'w-7 h-7 text-xs',
    md: 'w-8 h-8 text-sm',
    lg: 'w-10 h-10 text-base',
  };

  const textSizes = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl',
  };

  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      {/* Dynamic Vector Brand Emblem */}
      <div
        className={`${iconSizes[size]} bg-[#111827] rounded-xl flex items-center justify-center relative shadow-xs overflow-hidden shrink-0 border border-white/10`}
      >
        {/* Subtle orange accent glow inside badge */}
        <div className="absolute -top-2 -right-2 w-5 h-5 bg-[#F95700]/30 rounded-full blur-xs" />
        <svg
          viewBox="0 0 24 24"
          className="w-5 h-5"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Stylized T */}
          <path
            d="M4 6C4 5.44772 4.44772 5 5 5H19C19.5523 5 20 5.44772 20 6C20 6.55228 19.5523 7 19 7H13V18C13 18.5523 12.5523 19 12 19C11.4477 19 11 18.5523 11 18V7H5C4.44772 7 4 6.55228 4 6Z"
            fill="#FFFFFF"
          />
          {/* Sparkle badge in primary orange */}
          <path
            d="M17 11.5L18.2 14.1L21 15L18.2 15.9L17 18.5L15.8 15.9L13 15L15.8 14.1L17 11.5Z"
            fill="#F95700"
          />
        </svg>
      </div>

      {showText && (
        <span
          className={`font-black tracking-tight text-[#111827] leading-none ${textSizes[size]}`}
        >
          Temu<span className="text-[#F95700]">Tasks</span>
        </span>
      )}
    </div>
  );
};
