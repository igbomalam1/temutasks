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
  PlusCircle,
  CheckCircle2,
  Clock,
  Sparkles,
  Users,
  Copy,
  Check,
  Share2,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function DashboardPage() {
  const { user, profile, wallet } = useAuth();
  const [copied, setCopied] = useState(false);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [activeTasksCount, setActiveTasksCount] = useState(0);
  const [pendingReviewsCount, setPendingReviewsCount] = useState(0);

  const supabase = createClient();

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
    `You fit make 1000 to 5000 everyday on Temutasks, Them dey share money for completing simple temu tasks like accepting invitation link. Join with my ref link ${referralUrl}`;

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
        {/* Welcome & Tier Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-[#E5E7EB] shadow-xs">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-[#111827]">
                Welcome back, {profile?.full_name?.split(' ')[0] || 'Member'}! 👋
              </h1>
              {profile?.tier === 'pro' ? (
                <Badge variant="premium">PRO</Badge>
              ) : (
                <Badge variant="secondary">Basic</Badge>
              )}
            </div>
            <p className="text-xs sm:text-sm text-[#6B7280] mt-1">
              Your Temu invitation & reward fintech dashboard
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Link href="/tasks/create">
              <Button size="sm" variant="primary" leftIcon={<PlusCircle className="w-4 h-4" />}>
                Create Task
              </Button>
            </Link>
            <Link href="/tasks">
              <Button size="sm" variant="outline">
                Earn Rewards
              </Button>
            </Link>
          </div>
        </div>

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

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card padding="sm" className="space-y-1">
            <span className="text-xs text-[#6B7280]">Active Tasks</span>
            <div className="text-xl font-bold text-[#111827]">{activeTasksCount}</div>
            <Link
              href="/my-tasks"
              className="text-[11px] font-semibold text-[#F95700] inline-flex items-center gap-0.5"
            >
              View My Tasks <ChevronRight className="w-3 h-3" />
            </Link>
          </Card>

          <Card padding="sm" className="space-y-1">
            <span className="text-xs text-[#6B7280]">Pending Reviews</span>
            <div className="text-xl font-bold text-[#111827]">{pendingReviewsCount}</div>
            <Link
              href="/my-tasks"
              className="text-[11px] font-semibold text-[#F95700] inline-flex items-center gap-0.5"
            >
              Review Submissions <ChevronRight className="w-3 h-3" />
            </Link>
          </Card>

          <Card padding="sm" className="space-y-1">
            <span className="text-xs text-[#6B7280]">Referral Earnings</span>
            <div className="text-xl font-bold text-[#10B981]">{formatNaira(refEarned)}</div>
            <Link
              href="/referrals"
              className="text-[11px] font-semibold text-[#F95700] inline-flex items-center gap-0.5"
            >
              Referral Ledger <ChevronRight className="w-3 h-3" />
            </Link>
          </Card>

          <Card padding="sm" className="space-y-1">
            <span className="text-xs text-[#6B7280]">Account Tier</span>
            <div className="text-xl font-bold text-[#111827] capitalize">
              {profile?.tier || 'Basic'}
            </div>
            {profile?.tier === 'pro' ? (
              <span className="text-[11px] text-[#10B981] font-semibold">Active Alerts</span>
            ) : (
              <Link
                href="/pro"
                className="text-[11px] font-semibold text-[#F95700] inline-flex items-center gap-0.5"
              >
                Upgrade (₦200) <ChevronRight className="w-3 h-3" />
              </Link>
            )}
          </Card>
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
            &ldquo;You fit make 1000 to 5000 everyday on Temutasks, Them dey share money for completing simple temu tasks like accepting invitation link. Join with my ref link...&rdquo;
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
                <div key={tx.id} className="py-3 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="text-sm font-semibold text-[#111827]">{tx.description}</div>
                    <div className="text-xs text-[#9CA3AF]">
                      {new Date(tx.created_at).toLocaleDateString('en-NG', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}{' '}
                      • Ref: {tx.reference}
                    </div>
                  </div>
                  <div
                    className={`text-sm font-bold ${
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
      </div>
    </AppShell>
  );
}
