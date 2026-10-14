'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { formatNaira } from '@/lib/utils';
import Link from 'next/link';
import {
  Wallet,
  Smartphone,
  ArrowUpRight,
  ArrowDownLeft,
  PlusCircle,
  CheckCircle2,
  ListTodo,
  Clock,
  Sparkles,
  Users,
  Copy,
  Check,
  Share2,
  ChevronRight,
  TrendingUp,
  Receipt,
  Gift,
  X,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { createClient } from '@/lib/supabase/client';
import {
  TransactionReceiptModal,
  TransactionReceiptData,
} from '@/components/wallet/TransactionReceiptModal';

export default function DashboardPage() {
  const { user, profile, wallet } = useAuth();
  const [copied, setCopied] = useState(false);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [activeTasksCount, setActiveTasksCount] = useState(0);
  const [pendingReviewsCount, setPendingReviewsCount] = useState(0);
  const [selectedTx, setSelectedTx] = useState<TransactionReceiptData | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const dismissed = localStorage.getItem('temutask_welcome_dismissed');
      if (dismissed !== 'true') {
        setShowWelcomeModal(true);
        setTimeout(() => {
          try {
            confetti({
              particleCount: 70,
              spread: 60,
              origin: { y: 0.6 },
            });
          } catch {}
        }, 400);
      }
    }
  }, []);

  const dismissWelcomeModal = () => {
    setShowWelcomeModal(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem('temutask_welcome_dismissed', 'true');
    }
  };

  const supabase = createClient();

  const openReceiptForTx = (tx: any) => {
    setSelectedTx({
      id: tx.id,
      reference: tx.reference,
      description: tx.description,
      transactionType: tx.transaction_type,
      direction: tx.direction,
      amountKobo: tx.amount_kobo,
      date: new Date(tx.created_at).toLocaleString('en-NG', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
      balanceAfterKobo: tx.balance_after_kobo,
      status: 'Completed',
    });
    setIsReceiptOpen(true);
  };

  useEffect(() => {
    if (!user) return;

    const loadDashboardData = async () => {
      // Recent wallet ledger transactions
      const { data: txs } = await supabase
        .from('temutask_wallet_ledger')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (txs) setRecentTransactions(txs);

      // User's active tasks count
      const { count: tasksCount } = await supabase
        .from('temutask_tasks')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'active');

      if (tasksCount !== null) setActiveTasksCount(tasksCount);

      // Pending submissions on user's tasks
      const { data: myTasks } = await supabase
        .from('temutask_tasks')
        .select('id')
        .eq('user_id', user.id);

      if (myTasks && myTasks.length > 0) {
        const taskIds = myTasks.map((t) => t.id);
        const { count: pendingCount } = await supabase
          .from('temutask_submissions')
          .select('*', { count: 'exact', head: true })
          .in('task_id', taskIds)
          .eq('status', 'pending_review');

        if (pendingCount !== null) setPendingReviewsCount(pendingCount);
      }
    };

    loadDashboardData();
  }, [user]);

  const effectiveReferralCode =
    profile?.referral_code ||
    (user ? `TEMU${user.id.replace(/[^a-zA-Z0-9]/g, '').substring(0, 6).toUpperCase()}` : '');

  const referralUrl =
    typeof window !== 'undefined' && effectiveReferralCode
      ? `${window.location.origin}/?ref=${effectiveReferralCode}`
      : effectiveReferralCode
      ? `${process.env.NEXT_PUBLIC_APP_URL || 'https://temutasks.top'}/?ref=${effectiveReferralCode}`
      : '';

  const getInviteMessage = () =>
    `🎉 Get ₦25 instant welcome bonus as soon as you register on TemuTasks! You fit make ₦1,000 to ₦5,000 everyday completing simple Temu tasks (accepting invitation links), then cash out instantly to OPay/PalmPay or buy cheap airtime. Register here: ${referralUrl}`;

  const copyReferralLink = async () => {
    if (!referralUrl) return;
    const textToCopy = getInviteMessage();
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = textToCopy;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  const shareReferral = async () => {
    if (!referralUrl) return;
    const textToShare = getInviteMessage();
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'Earn ₦1,000 to ₦5,000 Daily on TemuTasks',
          text: textToShare,
        });
      } catch (e) {
        // Ignored if cancelled
      }
    } else {
      const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(textToShare)}`;
      window.open(whatsappUrl, '_blank');
    }
  };

  const balance = BigInt(wallet?.balance_kobo || 0);
  const earned = BigInt(wallet?.total_earned_kobo || 0);
  const refEarned = BigInt(wallet?.total_referral_earned_kobo || 0);

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Primary Wallet Hero Card */}
        <Card className="bg-gradient-to-br from-[#111827] to-[#1F2937] text-white border-none shadow-md p-6 sm:p-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-[#9CA3AF] uppercase">
                <Wallet className="w-4 h-4 text-[#F95700]" />
                Available Wallet Balance
              </div>
              <div className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
                {formatNaira(balance)}
              </div>
              <div className="flex items-center gap-4 text-xs text-[#9CA3AF] pt-1">
                <span>
                  Total Earned: <strong className="text-white">{formatNaira(earned)}</strong>
                </span>
                <span>•</span>
                <span>
                  Referral Commissions:{' '}
                  <strong className="text-[#10B981]">{formatNaira(refEarned)}</strong>
                </span>
              </div>
            </div>

            {/* Quick Financial Actions */}
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/wallet/deposit">
                <Button
                  variant="primary"
                  className="bg-[#F95700] hover:bg-[#E04E00] text-white border-none"
                  leftIcon={<ArrowDownLeft className="w-4 h-4" />}
                >
                  Add Funds
                </Button>
              </Link>
              <Link href="/wallet/cashout">
                <Button
                  variant="outline"
                  className="bg-white/10 hover:bg-white/20 text-white border-white/20 hover:border-white/40"
                  leftIcon={<ArrowUpRight className="w-4 h-4" />}
                >
                  Cash Out
                </Button>
              </Link>
            </div>
          </div>
        </Card>

        {/* Quick Action Navigation Buttons (3 on a line, Footer-Bar Style: Button Icon + Button Name) */}
        <div className="grid grid-cols-3 gap-2.5 sm:gap-3.5">
          {/* Row 1, Button 1: Create Tasks */}
          <Link
            href="/tasks/create"
            className="flex flex-col items-center justify-center py-3.5 px-2 rounded-xl bg-white border border-[#E5E7EB] hover:border-[#F95700] hover:bg-[#FFF5F0] transition-all text-center shadow-xs group"
          >
            <PlusCircle className="w-5 h-5 mb-1.5 text-[#6B7280] group-hover:text-[#F95700] transition-colors" />
            <span className="text-xs sm:text-sm font-semibold text-[#4B5563] group-hover:text-[#F95700] truncate w-full transition-colors">
              Create Tasks
            </span>
          </Link>

          {/* Row 1, Button 2: Earn Rewards */}
          <Link
            href="/tasks"
            className="flex flex-col items-center justify-center py-3.5 px-2 rounded-xl bg-white border border-[#E5E7EB] hover:border-[#F95700] hover:bg-[#FFF5F0] transition-all text-center shadow-xs group"
          >
            <Sparkles className="w-5 h-5 mb-1.5 text-[#6B7280] group-hover:text-[#F95700] transition-colors" />
            <span className="text-xs sm:text-sm font-semibold text-[#4B5563] group-hover:text-[#F95700] truncate w-full transition-colors">
              Earn Rewards
            </span>
          </Link>

          {/* Row 1, Button 3: Buy Airtime (VTU) */}
          <Link
            href="/wallet/airtime"
            className="flex flex-col items-center justify-center py-3.5 px-2 rounded-xl bg-white border border-[#E5E7EB] hover:border-[#F95700] hover:bg-[#FFF5F0] transition-all text-center shadow-xs group"
          >
            <Smartphone className="w-5 h-5 mb-1.5 text-[#6B7280] group-hover:text-[#F95700] transition-colors" />
            <span className="text-xs sm:text-sm font-semibold text-[#4B5563] group-hover:text-[#F95700] truncate w-full transition-colors">
              Buy Airtime
            </span>
          </Link>

          {/* Row 2, Button 4: Tasks (Active tasks) */}
          <Link
            href="/my-tasks"
            className="relative flex flex-col items-center justify-center py-3.5 px-2 rounded-xl bg-white border border-[#E5E7EB] hover:border-[#F95700] hover:bg-[#FFF5F0] transition-all text-center shadow-xs group"
          >
            {activeTasksCount > 0 && (
              <span className="absolute top-2 right-2 sm:right-4 px-1.5 py-0.2 text-[9px] font-extrabold bg-[#F95700] text-white rounded-full min-w-[16px] text-center shadow-xs">
                {activeTasksCount}
              </span>
            )}
            <ListTodo className="w-5 h-5 mb-1.5 text-[#6B7280] group-hover:text-[#F95700] transition-colors" />
            <span className="text-xs sm:text-sm font-semibold text-[#4B5563] group-hover:text-[#F95700] truncate w-full transition-colors">
              Tasks
            </span>
          </Link>

          {/* Row 2, Button 5: Review (Pending reviews) */}
          <Link
            href="/my-tasks"
            className="relative flex flex-col items-center justify-center py-3.5 px-2 rounded-xl bg-white border border-[#E5E7EB] hover:border-[#F95700] hover:bg-[#FFF5F0] transition-all text-center shadow-xs group"
          >
            {pendingReviewsCount > 0 && (
              <span className="absolute top-2 right-2 sm:right-4 px-1.5 py-0.2 text-[9px] font-extrabold bg-[#F59E0B] text-white rounded-full min-w-[16px] text-center shadow-xs">
                {pendingReviewsCount}
              </span>
            )}
            <Clock className="w-5 h-5 mb-1.5 text-[#6B7280] group-hover:text-[#F95700] transition-colors" />
            <span className="text-xs sm:text-sm font-semibold text-[#4B5563] group-hover:text-[#F95700] truncate w-full transition-colors">
              Review
            </span>
          </Link>

          {/* Row 2, Button 6: Referrals */}
          <Link
            href="/referrals"
            className="flex flex-col items-center justify-center py-3.5 px-2 rounded-xl bg-white border border-[#E5E7EB] hover:border-[#F95700] hover:bg-[#FFF5F0] transition-all text-center shadow-xs group"
          >
            <Users className="w-5 h-5 mb-1.5 text-[#6B7280] group-hover:text-[#F95700] transition-colors" />
            <span className="text-xs sm:text-sm font-semibold text-[#4B5563] group-hover:text-[#F95700] truncate w-full transition-colors">
              Referrals
            </span>
          </Link>
        </div>

        {/* Permanent Referral Link Card */}
        <Card className="bg-[#FFF5F0] border-[#F95700]/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[#F95700]" />
                <span className="text-sm font-bold text-[#111827]">
                  Your Permanent Referral Link
                </span>
              </div>
              <p className="text-xs text-[#6B7280]">
                Every friend gets <strong>₦25 welcome bonus</strong>. Earn <strong>₦25</strong> on their first task + ₦10 to ₦50 lifetime commissions on every task they complete!
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div
                onClick={copyReferralLink}
                title="Click to copy invite message"
                className="bg-white px-3 py-2 rounded-md border border-[#E5E7EB] text-xs font-mono text-[#111827] truncate max-w-[220px] cursor-pointer hover:border-[#F95700] select-all"
              >
                {referralUrl || 'Generating referral link...'}
              </div>
              <Button
                size="sm"
                variant={copied ? 'primary' : 'outline'}
                onClick={copyReferralLink}
                leftIcon={
                  copied ? (
                    <Check className="w-3.5 h-3.5 text-white" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )
                }
              >
                {copied ? 'Copied Invite!' : 'Copy'}
              </Button>
              <Button
                size="sm"
                variant="primary"
                onClick={shareReferral}
                leftIcon={<Share2 className="w-3.5 h-3.5" />}
              >
                Share
              </Button>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-[#F95700]/15 text-[11px] text-[#6B7280] italic">
            &ldquo;🎉 Get ₦25 instant welcome bonus as soon as you register on TemuTasks! You fit make ₦1,000 to ₦5,000 everyday completing simple Temu tasks...&rdquo;
          </div>
        </Card>

        {/* Recent Ledger Activity */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-[#111827]">Recent Financial Activity</h2>
            <Link
              href="/wallet"
              className="text-xs font-semibold text-[#F95700] hover:underline"
            >
              Full Ledger →
            </Link>
          </div>

          {recentTransactions.length === 0 ? (
            <div className="text-center py-8 text-[#9CA3AF] text-sm">
              No transactions yet. Complete tasks or refer friends to see your ledger activity here.
            </div>
          ) : (
            <div className="divide-y divide-[#E5E7EB]">
              {recentTransactions.map((tx) => (
                <div
                  key={tx.id}
                  onClick={() => openReceiptForTx(tx)}
                  role="button"
                  tabIndex={0}
                  className="py-3 px-2.5 -mx-2.5 rounded-xl flex items-center justify-between cursor-pointer hover:bg-[#FFF5F0]/60 active:bg-[#FFEAE0] transition-colors group"
                >
                  <div className="space-y-0.5">
                    <div className="text-sm font-semibold text-[#111827] group-hover:text-[#F95700] transition-colors flex items-center gap-1.5">
                      <span>{tx.description}</span>
                    </div>
                    <div className="text-xs text-[#9CA3AF] flex items-center gap-1.5 flex-wrap">
                      <span>
                        {new Date(tx.created_at).toLocaleDateString('en-NG', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <span>•</span>
                      <span className="font-mono text-[11px]">Ref: {tx.reference}</span>
                      <span className="text-[10px] font-semibold text-[#F95700] bg-[#FFF5F0] border border-[#FDBA74]/50 px-1.5 py-0.2 rounded inline-flex items-center gap-0.5 opacity-90 group-hover:opacity-100">
                        <Receipt className="w-2.5 h-2.5" /> View Receipt
                      </span>
                    </div>
                  </div>
                  <div
                    className={`text-sm font-bold shrink-0 ml-3 ${
                      tx.direction === 'credit' ? 'text-[#10B981]' : 'text-[#EF4444]'
                    }`}
                  >
                    {tx.direction === 'credit' ? '+' : '-'}
                    {formatNaira(BigInt(tx.amount_kobo))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Digital Receipt Modal */}
        <TransactionReceiptModal
          isOpen={isReceiptOpen}
          onClose={() => setIsReceiptOpen(false)}
          tx={selectedTx}
        />

        {/* Welcome Bonus Celebration Popup Modal */}
        {showWelcomeModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto animate-in fade-in"
            onClick={dismissWelcomeModal}
          >
            <div
              className="bg-white rounded-2xl max-w-md w-full max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2.5rem)] flex flex-col shadow-2xl relative border border-[#E5E7EB] overflow-hidden my-auto animate-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button */}
              <button
                onClick={dismissWelcomeModal}
                className="absolute top-3.5 right-3.5 z-10 p-1.5 rounded-full text-[#9CA3AF] hover:text-[#111827] hover:bg-[#F3F4F6] transition-colors"
                title="Close"
                aria-label="Close"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>

              {/* Scrollable Body */}
              <div className="overflow-y-auto p-4 sm:p-6 space-y-3.5 sm:space-y-4">
                {/* Header / Celebration Icon */}
                <div className="text-center space-y-1.5 pt-1">
                  <div className="w-11 h-11 sm:w-12 sm:h-12 mx-auto rounded-xl bg-gradient-to-br from-[#FFF5F0] to-[#FFE8DC] border border-[#F95700]/30 flex items-center justify-center text-[#F95700] shadow-xs">
                    <Gift className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>

                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FFF5F0] border border-[#F95700]/30 text-[#F95700] text-[11px] font-extrabold uppercase tracking-wider">
                    <Sparkles className="w-3 h-3" />
                    ₦25 Welcome Bonus
                  </div>

                  <h2 className="text-lg sm:text-xl font-black text-[#111827] tracking-tight">
                    Welcome to TemuTasks!
                  </h2>

                  <p className="text-xs sm:text-sm text-[#4B5563] leading-relaxed">
                    You received <strong>₦25 instant welcome bonus</strong> on registration. It is active in your available wallet balance right now!
                  </p>
                </div>

                {/* Platform Feature Summary */}
                <div className="p-3 rounded-xl bg-[#F7F7F8] border border-[#E5E7EB] text-xs text-[#4B5563] space-y-1">
                  <div className="flex items-center gap-2 font-bold text-[#111827]">
                    <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0" />
                    <span>Earn cash doing tasks or promote your links</span>
                  </div>
                  <p className="text-[11px] text-[#6B7280] leading-relaxed pl-6">
                    Complete quick invitation tasks to earn real cash, or create tasks to reach thousands of Nigerians. Cash out straight to OPay/PalmPay or buy cheap airtime!
                  </p>
                </div>

                {/* Referral Earning Booster Box */}
                <div className="p-3.5 rounded-xl bg-gradient-to-br from-[#FFF5F0] to-[#FFFBEB] border border-[#F95700]/25 space-y-2.5">
                  <div className="space-y-0.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#F95700] flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" />
                      Refer &amp; Earn Additional ₦25 Cash
                    </span>
                    <p className="text-xs text-[#4B5563] leading-relaxed">
                      Earn an extra <strong>₦25 instant bonus</strong> when your friend completes their first task, plus <strong>continuous lifetime commissions</strong> on every task they ever complete!
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <div
                      onClick={copyReferralLink}
                      title="Click to copy invite message"
                      className="flex-1 bg-white px-2.5 py-1.5 rounded-lg border border-[#E5E7EB] text-[11px] font-mono text-[#111827] truncate cursor-pointer hover:border-[#F95700] select-all"
                    >
                      {referralUrl || 'Generating referral link...'}
                    </div>
                    <Button
                      size="sm"
                      variant={copied ? 'primary' : 'outline'}
                      onClick={copyReferralLink}
                      className="shrink-0 text-xs px-2.5 py-1 h-8"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-white mr-1" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 mr-1" />
                          Copy
                        </>
                      )}
                    </Button>
                  </div>

                  <Button
                    size="sm"
                    variant="primary"
                    onClick={shareReferral}
                    className="w-full text-xs font-bold bg-[#F95700] hover:bg-[#E04E00] text-white flex items-center justify-center gap-1.5 shadow-xs py-2 h-auto"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    Share Referral Link on WhatsApp
                  </Button>
                </div>
              </div>

              {/* Sticky Action Footer */}
              <div className="p-3 sm:p-4 border-t border-[#E5E7EB] bg-[#F7F7F8] shrink-0">
                <Button
                  size="md"
                  variant="secondary"
                  onClick={dismissWelcomeModal}
                  className="w-full font-bold text-xs sm:text-sm bg-[#111827] hover:bg-[#1F2937] text-white shadow-xs"
                >
                  Start Earning Now →
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
