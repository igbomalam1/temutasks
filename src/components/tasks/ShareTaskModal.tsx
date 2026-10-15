'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { formatNaira, parseTaskTitleAndInstructions } from '@/lib/utils';
import {
  Share2,
  Copy,
  Check,
  X,
  MessageCircle,
  Send,
  ExternalLink,
  Sparkles,
} from 'lucide-react';

interface ShareTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: {
    id: string;
    title: string;
    task_type?: string;
    reward_per_participant_kobo: string | number;
    quantity_requested?: number;
    quantity_approved?: number;
    is_premium?: boolean;
  } | null;
  referralCode?: string;
}

export function ShareTaskModal({
  isOpen,
  onClose,
  task,
  referralCode,
}: ShareTaskModalProps) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedMsg, setCopiedMsg] = useState(false);

  if (!isOpen || !task) return null;

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://temutasks.top';
  const shareUrl = `${origin}/tasks?taskId=${task.id}${referralCode ? `&ref=${referralCode}` : ''}`;
  const rewardFormatted = formatNaira(BigInt(task.reward_per_participant_kobo || 0));

  const shareText = `🔥 New task available now for ${rewardFormatted}!

⚡ Complete now and claim your reward as airtime or cash withdrawal.
⏳ Task ends soon, complete task here:
${shareUrl}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      // Fallback
      fallbackCopy(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopiedMsg(true);
      setTimeout(() => setCopiedMsg(false), 2500);
    } catch {
      fallbackCopy(shareText);
      setCopiedMsg(true);
      setTimeout(() => setCopiedMsg(false), 2500);
    }
  };

  const fallbackCopy = (text: string) => {
    const el = document.createElement('textarea');
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `New Task Available for ${rewardFormatted} - TemuTasks`,
          text: `New task available now for ${rewardFormatted}! Complete now and claim your reward as airtime or cash withdrawal, task ends soon:`,
          url: shareUrl,
        });
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          handleCopyLink();
        }
      }
    } else {
      handleCopyLink();
    }
  };

  const shareToWhatsApp = () => {
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`, '_blank');
  };

  const shareToTelegram = () => {
    window.open(
      `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`,
      '_blank'
    );
  };

  const shareToTwitter = () => {
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`,
      '_blank'
    );
  };

  const hasNativeShare = typeof navigator !== 'undefined' && !!navigator.share;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-md w-full max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2.5rem)] flex flex-col shadow-2xl relative border border-[#E5E7EB] overflow-hidden my-auto animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-3.5 sm:p-4 border-b border-[#E5E7EB] flex items-center justify-between shrink-0 bg-white">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-[#FFF5F0] text-[#F95700] rounded-lg">
              <Share2 className="w-4 h-4" />
            </span>
            <h3 className="text-base sm:text-lg font-bold text-[#111827]">Share Your Task</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-[#9CA3AF] hover:text-[#111827] hover:bg-[#F3F4F6] transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="overflow-y-auto p-4 sm:p-5 space-y-3.5 flex-1">
          {/* Social Share Preview Card with OG Image */}
          <div className="rounded-xl border border-[#E5E7EB] overflow-hidden bg-[#F9FAFB] shadow-xs">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/og-image.jpg"
              alt="TemuTasks Share Banner"
              className="w-full h-32 sm:h-36 object-cover"
            />
            <div className="p-3 space-y-1 bg-white border-t border-[#E5E7EB]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-[#F95700] uppercase tracking-wider">
                  TemuTasks • Daily Rewards
                </span>
                <span className="text-[11px] font-black text-[#10B981] bg-[#ECFDF5] px-2 py-0.5 rounded-full border border-[#A7F3D0]">
                  Reward: {rewardFormatted}
                </span>
              </div>
              <h4 className="text-xs sm:text-sm font-bold text-[#111827]">
                New task available now for {rewardFormatted}
              </h4>
              <p className="text-[11px] text-[#6B7280] leading-relaxed">
                Complete now and claim your reward as airtime or cash withdrawal, task ends soon.
              </p>
            </div>
          </div>

          {/* Formatted Message Preview */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#111827]">Share Message</label>
              <button
                type="button"
                onClick={handleCopyMessage}
                className="text-[11px] font-bold text-[#F95700] hover:underline flex items-center gap-1"
              >
                {copiedMsg ? (
                  <>
                    <Check className="w-3 h-3 text-[#10B981]" /> Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" /> Copy Message
                  </>
                )}
              </button>
            </div>
            <div className="p-2.5 bg-[#F7F7F8] border border-[#E5E7EB] rounded-xl text-xs text-[#111827] whitespace-pre-line font-medium leading-relaxed">
              {shareText}
            </div>
          </div>

          {/* Native Share button (if on mobile / supported browser) */}
          {hasNativeShare && (
            <Button
              size="md"
              variant="primary"
              className="w-full justify-center gap-2 text-xs font-bold shadow-xs bg-[#F95700] hover:bg-[#E04E00] text-white"
              onClick={handleNativeShare}
            >
              <Share2 className="w-4 h-4" />
              <span>Share via Phone Apps</span>
            </Button>
          )}

          {/* Direct Link Copy Input */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-[#111827]">Direct Task Link</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="flex-1 bg-[#F7F7F8] border border-[#E5E7EB] rounded-lg px-2.5 py-1.5 text-xs text-[#111827] select-all font-mono focus:outline-hidden"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <Button
                size="sm"
                variant={copiedLink ? 'outline' : 'primary'}
                className={copiedLink ? 'border-[#10B981] text-[#10B981] text-xs' : 'text-xs'}
                onClick={handleCopyLink}
              >
                {copiedLink ? (
                  <>
                    <Check className="w-3.5 h-3.5 mr-1" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 mr-1" /> Copy
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Social Share Buttons */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#111827] block">Share Instantly To</label>
            <div className="grid grid-cols-3 gap-2">
              {/* WhatsApp */}
              <button
                onClick={shareToWhatsApp}
                className="flex flex-col items-center justify-center p-2 rounded-xl border border-[#E5E7EB] hover:border-[#25D366] hover:bg-[#25D366]/5 transition-all text-xs font-semibold text-[#111827] gap-1"
              >
                <div className="w-6 h-6 rounded-full bg-[#25D366] text-white flex items-center justify-center">
                  <MessageCircle className="w-3.5 h-3.5 fill-current" />
                </div>
                <span className="text-[11px]">WhatsApp</span>
              </button>

              {/* Telegram */}
              <button
                onClick={shareToTelegram}
                className="flex flex-col items-center justify-center p-2 rounded-xl border border-[#E5E7EB] hover:border-[#229ED9] hover:bg-[#229ED9]/5 transition-all text-xs font-semibold text-[#111827] gap-1"
              >
                <div className="w-6 h-6 rounded-full bg-[#229ED9] text-white flex items-center justify-center">
                  <Send className="w-3.5 h-3.5 fill-current" />
                </div>
                <span className="text-[11px]">Telegram</span>
              </button>

              {/* X / Twitter */}
              <button
                onClick={shareToTwitter}
                className="flex flex-col items-center justify-center p-2 rounded-xl border border-[#E5E7EB] hover:border-[#111827] hover:bg-[#111827]/5 transition-all text-xs font-semibold text-[#111827] gap-1"
              >
                <div className="w-6 h-6 rounded-full bg-[#111827] text-white flex items-center justify-center">
                  <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </div>
                <span className="text-[11px]">Twitter / X</span>
              </button>
            </div>
          </div>
        </div>

        {/* Sticky Footer */}
        <div className="p-3 sm:p-3.5 border-t border-[#E5E7EB] bg-[#F7F7F8] flex items-center justify-between shrink-0">
          <p className="text-[10px] sm:text-[11px] text-[#6B7280]">
            Includes reward &amp; invitation link.
          </p>
          <Button
            size="sm"
            variant="outline"
            className="text-xs"
            onClick={handleCopyMessage}
          >
            {copiedMsg ? (
              <>
                <Check className="w-3.5 h-3.5 mr-1 text-[#10B981]" /> Message Copied
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 mr-1" /> Copy Full Message
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
