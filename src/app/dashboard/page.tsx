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
} from 'lucide-react';
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
      ? `https://temutasks.com/?ref=${effectiveReferralCode}`
      : '';

  const getInviteMessage = () =>
    `You fit make 1000 to 5000 everyday on Temutasks and you fit withdraw am immediately or use am buy airtime, Them dey share money for completing simple temu tasks like accepting invitation link. Join with my ref link ${referralUrl}`;

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
              <Link href="/wallet/airtime">
                <Button
                  variant="primary"
                  className="bg-[#F95700] hover:bg-[#E04E00] text-white border-none"
                  leftIcon={<Smartphone className="w-4 h-4" />}
                >
                  Buy Airtime
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

          {/* Row 1, Button 3: Deposit (Novac Wallet Top-Up) */}
          <Link
            href="/wallet/deposit"
            className="flex flex-col items-center justify-center py-3.5 px-2 rounded-xl bg-white border border-[#E5E7EB] hover:border-[#F95700] hover:bg-[#FFF5F0] transition-all text-center shadow-xs group"
          >
            <ArrowDownLeft className="w-5 h-5 mb-1.5 text-[#6B7280] group-hover:text-[#F95700] transition-colors" />
            <span className="text-xs sm:text-sm font-semibold text-[#4B5563] group-hover:text-[#F95700] truncate w-full transition-colors">
              Deposit
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
                Earn ₦10 on every existing user task & ₦50 on every new user task completed by
                anyone you refer for life!
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
            &ldquo;You fit make 1000 to 5000 everyday on Temutasks and you fit withdraw am immediately or use am buy airtime, Them dey share money for completing simple temu tasks like accepting invitation link. Join with my ref link...&rdquo;
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
      </div>
    </AppShell>
  );
}
