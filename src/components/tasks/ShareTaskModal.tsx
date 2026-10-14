'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { formatNaira } from '@/lib/utils';
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

  const shareText = `Accept my Temu invitation task on TemuTasks and earn ${rewardFormatted}! Anyone can click this link to complete the task and withdraw or buy airtime immediately: ${shareUrl}`;

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
          title: `TemuTasks: ${task.title}`,
          text: `Accept my Temu invitation task and earn ${rewardFormatted}!`,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
      <Card className="max-w-md w-full p-6 space-y-5 shadow-2xl relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-full text-[#9CA3AF] hover:text-[#111827] hover:bg-[#F3F4F6] transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="space-y-1 pr-6">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-[#FFF5F0] text-[#F95700] rounded-lg">
              <Share2 className="w-4 h-4" />
            </span>
            <h3 className="text-lg font-bold text-[#111827]">Share Your Task</h3>
          </div>
          <p className="text-xs text-[#6B7280]">
            Share your task link with friends or groups. Anyone can click and complete it to help you finish your Temu round!
          </p>
        </div>

        {/* Task Summary Badge */}
        <div className="p-3.5 bg-[#F7F7F8] border border-[#E5E7EB] rounded-xl flex items-center justify-between">
          <div className="min-w-0 flex-1 mr-3">
            <span className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider block">
              Task
            </span>
            <h4 className="text-sm font-bold text-[#111827] truncate">{task.title}</h4>
            <span className="text-xs text-[#10B981] font-semibold mt-0.5 inline-block">
              Earn {rewardFormatted} / participant
            </span>
          </div>
          <Badge variant={task.is_premium ? 'premium' : 'primary'} className="shrink-0">
            {task.is_premium ? 'URGENT' : 'ACTIVE'}
          </Badge>
        </div>

        {/* Native Share button (if on mobile / supported browser) */}
        {hasNativeShare && (
          <Button
            size="md"
            variant="primary"
            className="w-full justify-center gap-2"
            onClick={handleNativeShare}
          >
            <Share2 className="w-4 h-4" />
            <span>Share via Phone Apps</span>
          </Button>
        )}

        {/* Direct Link Copy Input */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-[#111827]">Direct Task Link</label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={shareUrl}
              className="flex-1 bg-[#F7F7F8] border border-[#E5E7EB] rounded-lg px-3 py-2 text-xs text-[#111827] select-all font-mono focus:outline-hidden"
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            <Button
              size="sm"
              variant={copiedLink ? 'outline' : 'primary'}
              className={copiedLink ? 'border-[#10B981] text-[#10B981]' : ''}
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
        <div className="space-y-2">
          <label className="text-xs font-bold text-[#111827] block">Share Instantly To</label>
          <div className="grid grid-cols-3 gap-2">
            {/* WhatsApp */}
            <button
              onClick={shareToWhatsApp}
              className="flex flex-col items-center justify-center p-2.5 rounded-xl border border-[#E5E7EB] hover:border-[#25D366] hover:bg-[#25D366]/5 transition-all text-xs font-semibold text-[#111827] gap-1"
            >
              <div className="w-7 h-7 rounded-full bg-[#25D366] text-white flex items-center justify-center">
                <MessageCircle className="w-4 h-4 fill-current" />
              </div>
              <span>WhatsApp</span>
            </button>

            {/* Telegram */}
            <button
              onClick={shareToTelegram}
              className="flex flex-col items-center justify-center p-2.5 rounded-xl border border-[#E5E7EB] hover:border-[#229ED9] hover:bg-[#229ED9]/5 transition-all text-xs font-semibold text-[#111827] gap-1"
            >
              <div className="w-7 h-7 rounded-full bg-[#229ED9] text-white flex items-center justify-center">
                <Send className="w-4 h-4 fill-current" />
              </div>
              <span>Telegram</span>
            </button>

            {/* X / Twitter */}
            <button
              onClick={shareToTwitter}
              className="flex flex-col items-center justify-center p-2.5 rounded-xl border border-[#E5E7EB] hover:border-[#111827] hover:bg-[#111827]/5 transition-all text-xs font-semibold text-[#111827] gap-1"
            >
              <div className="w-7 h-7 rounded-full bg-[#111827] text-white flex items-center justify-center">
                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </div>
              <span>Twitter / X</span>
            </button>
          </div>
        </div>

        {/* Copy Formatted Promo Message */}
        <div className="pt-2 border-t border-[#E5E7EB] flex items-center justify-between">
          <p className="text-[11px] text-[#6B7280]">
            Includes reward details and your invitation link.
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
      </Card>
    </div>
  );
}
