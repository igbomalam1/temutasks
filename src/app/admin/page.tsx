'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { formatNaira } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import {
  LayoutDashboard,
  Users,
  CheckSquare,
  ListTodo,
  AlertTriangle,
  Wallet,
  ArrowUpRight,
  Smartphone,
  Sparkles,
  Settings,
  ShieldCheck,
  CreditCard,
  TrendingUp,
  Mail,
  ShieldAlert,
  BarChart3,
  Play,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  PlusCircle,
  Search,
  Check,
  Ban,
  Clock,
  ExternalLink,
} from 'lucide-react';

type AdminTab =
  | 'overview'
  | 'users'
  | 'tasks'
  | 'submissions'
  | 'disputes'
  | 'payments'
  | 'ledger'
  | 'withdrawals'
  | 'airtime'
  | 'referrals'
  | 'earnings'
  | 'pro'
  | 'emails'
  | 'fraud'
  | 'reports'
  | 'settings'
  | 'audit';

export default function AdminDashboardPage() {
  const { user, profile, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Data state
  const [stats, setStats] = useState<any>({
    users: 0,
    proUsers: 0,
    tasks: 0,
    pendingReviews: 0,
    disputes: 0,
    pendingWithdrawals: 0,
    totalPaidTasksKobo: BigInt(0),
    platformRevenueKobo: BigInt(0),
  });
  const [items, setItems] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Admin action modals
  const [selectedUserForCredit, setSelectedUserForCredit] = useState<any | null>(null);
  const [creditAmountNaira, setCreditAmountNaira] = useState('');
  const [creditReason, setCreditReason] = useState('');
  const [isCrediting, setIsCrediting] = useState(false);

  const [selectedUserForPro, setSelectedUserForPro] = useState<any | null>(null);
  const [proDays, setProDays] = useState('14');
  const [proReason, setProReason] = useState('');
  const [isUpgradingPro, setIsUpgradingPro] = useState(false);

  // Task email notification audience settings
  const [taskEmailAudience, setTaskEmailAudience] = useState<'all' | 'pro_only'>('all');
  const [isSavingAudience, setIsSavingAudience] = useState(false);
  const [selectedTaskForBroadcast, setSelectedTaskForBroadcast] = useState<any | null>(null);
  const [broadcastAudience, setBroadcastAudience] = useState<'all' | 'pro_only'>('all');
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    // Fetch live audience setting on load
    fetch('/api/admin/actions')
      .then((res) => res.json())
      .then((data) => {
        if (data.audience) {
          setTaskEmailAudience(data.audience);
        }
      })
      .catch((e) => console.error('Error fetching email audience:', e));
  }, []);

  useEffect(() => {
    loadTabContent();
  }, [activeTab]);

  const loadTabContent = async () => {
    setIsLoading(true);
    setMsg(null);
    setSearchQuery('');

    try {
      if (activeTab === 'overview' || activeTab === 'reports' || activeTab === 'earnings') {
        const [
          usersCount,
          proCount,
          tasksCount,
          pendingSubs,
          disputesCount,
          pendingWths,
          ledgerEntries,
        ] = await Promise.all([
          supabase.from('temutask_profiles').select('*', { count: 'exact', head: true }),
          supabase.from('temutask_profiles').select('*', { count: 'exact', head: true }).eq('tier', 'pro'),
          supabase.from('temutask_tasks').select('*', { count: 'exact', head: true }),
          supabase.from('temutask_submissions').select('*', { count: 'exact', head: true }).eq('status', 'pending_review'),
          supabase.from('temutask_submissions').select('*', { count: 'exact', head: true }).eq('status', 'declined_disputed'),
          supabase.from('temutask_withdrawals').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
          supabase.from('temutask_wallet_ledger').select('*').order('created_at', { ascending: false }).limit(200),
        ]);

        let platformRev = BigInt(0);
        let grossPayments = BigInt(0);
        if (ledgerEntries.data) {
          ledgerEntries.data.forEach((l) => {
            const amt = BigInt(l.amount_kobo || 0);
            if (
              l.transaction_type === 'platform_fee' ||
              l.transaction_type === 'premium_fee' ||
              l.transaction_type === 'platform_earnings' ||
              l.transaction_type === 'pro_membership'
            ) {
              platformRev += amt;
            }
            if (l.transaction_type === 'task_funding') {
              grossPayments += amt;
            }
          });
        }

        setStats({
          users: usersCount.count || 0,
          proUsers: proCount.count || 0,
          tasks: tasksCount.count || 0,
          pendingReviews: pendingSubs.count || 0,
          disputes: disputesCount.count || 0,
          pendingWithdrawals: pendingWths.count || 0,
          totalPaidTasksKobo: grossPayments,
          platformRevenueKobo: platformRev,
        });
        setItems(ledgerEntries.data || []);
      } else if (activeTab === 'users' || activeTab === 'referrals' || activeTab === 'fraud') {
        const { data } = await supabase
          .from('temutask_profiles')
          .select('*, temutask_wallets(balance_kobo, total_earned_kobo, total_referral_earned_kobo)')
          .order('created_at', { ascending: false })
          .limit(100);
        setItems(data || []);
      } else if (activeTab === 'tasks') {
        const { data } = await supabase
          .from('temutask_tasks')
          .select('*, temutask_profiles!user_id(email, full_name)')
          .order('created_at', { ascending: false })
          .limit(100);
        setItems(data || []);
      } else if (activeTab === 'submissions') {
        const { data } = await supabase
          .from('temutask_submissions')
          .select('*, temutask_tasks!task_id(title, user_id), temutask_profiles!participant_id(email, full_name)')
          .order('created_at', { ascending: false })
          .limit(100);
        setItems(data || []);
      } else if (activeTab === 'disputes') {
        const { data } = await supabase
          .from('temutask_submissions')
          .select('*, temutask_tasks!task_id(title, user_id), temutask_profiles!participant_id(email, full_name)')
          .in('status', ['declined_disputed', 'pending_review'])
          .order('created_at', { ascending: false });
        setItems(data || []);
      } else if (activeTab === 'payments') {
        const { data } = await supabase
          .from('temutask_payment_orders')
          .select('*, temutask_profiles!user_id(email, full_name)')
          .order('created_at', { ascending: false })
          .limit(100);
        setItems(data || []);
      } else if (activeTab === 'ledger') {
        const { data } = await supabase
          .from('temutask_wallet_ledger')
          .select('*, temutask_profiles!user_id(email, full_name)')
          .order('created_at', { ascending: false })
          .limit(100);
        setItems(data || []);
      } else if (activeTab === 'withdrawals') {
        const { data } = await supabase
          .from('temutask_withdrawals')
          .select('*, temutask_profiles!user_id(email, full_name)')
          .order('created_at', { ascending: false })
          .limit(100);
        setItems(data || []);
      } else if (activeTab === 'airtime') {
        const { data } = await supabase
          .from('temutask_airtime_purchases')
          .select('*, temutask_profiles!user_id(email, full_name)')
          .order('created_at', { ascending: false })
          .limit(100);
        setItems(data || []);
      } else if (activeTab === 'pro') {
        const { data } = await supabase
          .from('temutask_pro_memberships')
          .select('*, temutask_profiles!user_id(email, full_name)')
          .order('created_at', { ascending: false })
          .limit(100);
        setItems(data || []);
      } else if (activeTab === 'emails') {
        const { data } = await supabase
          .from('temutask_email_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100);
        setItems(data || []);
      } else if (activeTab === 'audit') {
        const { data } = await supabase
          .from('temutask_admin_audit_logs')
          .select('*, temutask_profiles!admin_id(email, full_name)')
          .order('created_at', { ascending: false })
          .limit(100);
        setItems(data || []);
      }
    } catch (err: any) {
      console.error('Error fetching admin tab:', err);
      setMsg({ text: err.message || 'Error loading records', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const runNightlyReviewManually = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/cron/nightly-review', { method: 'POST' });
      const data = await res.json();
      setMsg({
        text: `Daily 10:00 AM review executed! Cleared and approved ${data.autoApproved || 0} submissions.`,
        type: 'success',
      });
      await loadTabContent();
    } catch (err: any) {
      setMsg({ text: err.message || 'Error running review', type: 'error' });
      setIsLoading(false);
    }
  };

  const handleMarkWithdrawalPaid = async (withdrawalId: string) => {
    try {
      const res = await fetch('/api/admin/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'pay_withdrawal',
          withdrawalId,
          userId: user?.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to mark withdrawal as paid');
      }

      setMsg({ text: data.message || 'Withdrawal marked as PAID & receipt emailed!', type: 'success' });
      await loadTabContent();
    } catch (err: any) {
      setMsg({ text: err.message, type: 'error' });
    }
  };

  const handleToggleUserStatus = async (userId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
    await supabase
      .from('temutask_profiles')
      .update({ status: newStatus })
      .eq('id', userId);
    setMsg({ text: `User status updated to ${newStatus.toUpperCase()}`, type: 'success' });
    await loadTabContent();
  };

  // Submit Admin Wallet Credit
  const handleCreditWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForCredit) return;
    setIsCrediting(true);
    try {
      const res = await fetch('/api/admin/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'credit_wallet',
          userId: selectedUserForCredit.id,
          amountNaira: Number(creditAmountNaira),
          reason: creditReason,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ text: data.error || 'Failed to credit user', type: 'error' });
      } else {
        setMsg({ text: data.message, type: 'success' });
        setSelectedUserForCredit(null);
        setCreditAmountNaira('');
        setCreditReason('');
        await loadTabContent();
      }
    } catch (err: any) {
      setMsg({ text: err.message || 'Error crediting wallet', type: 'error' });
    } finally {
      setIsCrediting(false);
    }
  };

  // Submit Admin Pro Upgrade
  const handleUpgradePro = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForPro) return;
    setIsUpgradingPro(true);
    try {
      const res = await fetch('/api/admin/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upgrade_pro',
          userId: selectedUserForPro.id,
          days: Number(proDays),
          reason: proReason,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ text: data.error || 'Failed to upgrade user', type: 'error' });
      } else {
        setMsg({ text: data.message, type: 'success' });
        setSelectedUserForPro(null);
        setProReason('');
        await loadTabContent();
      }
    } catch (err: any) {
      setMsg({ text: err.message || 'Error upgrading Pro', type: 'error' });
    } finally {
      setIsUpgradingPro(false);
    }
  };

  const handleSaveAudience = async (newAudience: 'all' | 'pro_only') => {
    setIsSavingAudience(true);
    try {
      const res = await fetch('/api/admin/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set_task_email_audience',
          audience: newAudience,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ text: data.error || 'Failed to update audience setting', type: 'error' });
      } else {
        setTaskEmailAudience(newAudience);
        setMsg({ text: data.message || 'Task email audience updated successfully!', type: 'success' });
      }
    } catch (err: any) {
      setMsg({ text: err.message || 'Error updating audience', type: 'error' });
    } finally {
      setIsSavingAudience(false);
    }
  };

  const handleBroadcastTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTaskForBroadcast) return;
    setIsBroadcasting(true);
    try {
      const res = await fetch('/api/admin/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'broadcast_task_email',
          taskId: selectedTaskForBroadcast.id,
          audience: broadcastAudience,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ text: data.error || 'Failed to broadcast task alert', type: 'error' });
      } else {
        setMsg({ text: data.message || 'Task alert emails broadcasted successfully!', type: 'success' });
        setSelectedTaskForBroadcast(null);
      }
    } catch (err: any) {
      setMsg({ text: err.message || 'Error broadcasting email', type: 'error' });
    } finally {
      setIsBroadcasting(false);
    }
  };

  const navTabs: { id: AdminTab; label: string; icon: any }[] = [
    { id: 'overview', label: '1. Overview', icon: LayoutDashboard },
    { id: 'users', label: '2. User Management', icon: Users },
    { id: 'tasks', label: '3. Tasks Marketplace', icon: ListTodo },
    { id: 'submissions', label: '4. Task Submissions', icon: CheckSquare },
    { id: 'disputes', label: '5. Disputes & Nightly Reviews', icon: AlertTriangle },
    { id: 'payments', label: '6. Payment Orders', icon: CreditCard },
    { id: 'ledger', label: '7. Wallet Ledger', icon: Wallet },
    { id: 'withdrawals', label: '8. Withdrawals', icon: ArrowUpRight },
    { id: 'airtime', label: '9. Airtime Logs', icon: Smartphone },
    { id: 'referrals', label: '10. Referral Ledger', icon: Users },
    { id: 'earnings', label: '11. Platform Revenue', icon: TrendingUp },
    { id: 'pro', label: '12. Pro Memberships', icon: Sparkles },
    { id: 'emails', label: '13. Email Audit Logs', icon: Mail },
    { id: 'fraud', label: '14. Risk & Account Flags', icon: ShieldAlert },
    { id: 'reports', label: '15. Analytics & Metrics', icon: BarChart3 },
    { id: 'settings', label: '16. Platform Settings', icon: Settings },
    { id: 'audit', label: '17. Admin Audit Trail', icon: ShieldCheck },
  ];

  const filteredItems = items.filter((item) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const str = JSON.stringify(item).toLowerCase();
    return str.includes(query);
  });

  return (
    <div className="min-h-screen bg-[#F7F7F8] flex flex-col lg:flex-row">
      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Persistent Left Sidebar */}
      <aside
        className={`bg-white border-r border-[#E5E7EB] flex flex-col justify-between shrink-0 transition-all duration-200 ${
          collapsed ? 'lg:w-20' : 'lg:w-64'
        } ${
          sidebarOpen
            ? 'fixed inset-y-0 left-0 z-50 w-64 shadow-xl'
            : 'hidden lg:flex lg:sticky lg:top-0 lg:h-screen'
        }`}
      >
        <div className="flex flex-col flex-1 overflow-y-auto">
          <div className="h-16 px-4 flex items-center justify-between border-b border-[#E5E7EB]">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="w-8 h-8 rounded-lg bg-[#F95700] flex items-center justify-center font-black text-white shrink-0">
                T
              </div>
              {!collapsed && (
                <div className="flex items-center gap-1.5">
                  <span className="text-lg font-black tracking-tight text-[#111827]">
                    Temu<span className="text-[#F95700]">Tasks</span>
                  </span>
                  <span className="text-[9px] bg-[#FFF5F0] text-[#F95700] border border-[#F95700]/30 font-bold px-1.5 py-0.5 rounded">
                    ADMIN
                  </span>
                </div>
              )}
            </div>

            <button
              onClick={() => setCollapsed(!collapsed)}
              className="hidden lg:flex p-1.5 rounded-lg text-[#6B7280] hover:text-[#F95700] hover:bg-[#FFF5F0]"
            >
              {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>

            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1.5 text-[#6B7280] hover:text-[#111827]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="p-2.5 space-y-1 flex-1">
            {navTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setSidebarOpen(false);
                  }}
                  title={collapsed ? tab.label : undefined}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-[#F95700] text-white shadow-xs'
                      : 'text-[#4B5563] hover:text-[#F95700] hover:bg-[#FFF5F0]'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-[#6B7280]'}`}
                  />
                  {!collapsed && <span className="truncate">{tab.label}</span>}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-3 border-t border-[#E5E7EB] bg-[#F9FAFB] space-y-2">
          <Link
            href="/dashboard"
            className="text-xs font-semibold text-[#4B5563] hover:text-[#F95700] flex items-center gap-2 px-2 py-1"
          >
            ← {!collapsed && 'User Dashboard'}
          </Link>
          <button
            onClick={() => signOut()}
            className="text-xs font-semibold text-[#EF4444] hover:underline flex items-center gap-2 px-2 py-1"
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" /> {!collapsed && 'Sign Out'}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <header className="bg-white border-b border-[#E5E7EB] h-16 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg text-[#4B5563] hover:text-[#111827]"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="text-base font-bold text-[#111827] capitalize">
              {navTabs.find((t) => t.id === activeTab)?.label}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <Button
              size="sm"
              variant="outline"
              onClick={runNightlyReviewManually}
              isLoading={isLoading}
              leftIcon={<Play className="w-3.5 h-3.5 text-[#F95700]" />}
            >
              Run 10:00 AM Daily Review
            </Button>
          </div>
        </header>

        <main className="p-4 sm:p-6 space-y-6">
          {/* Notification Alert Banner */}
          {msg && (
            <div
              className={`p-4 rounded-xl text-xs font-semibold flex items-center justify-between ${
                msg.type === 'success'
                  ? 'bg-[#ECFDF5] border border-[#A7F3D0] text-[#059669]'
                  : 'bg-[#FEF2F2] border border-[#FECACA] text-[#DC2626]'
              }`}
            >
              <span>{msg.text}</span>
              <button onClick={() => setMsg(null)} className="font-bold ml-4">
                ✕
              </button>
            </div>
          )}

          {/* TAB 1: OVERVIEW / 11. EARNINGS / 15. REPORTS */}
          {(activeTab === 'overview' || activeTab === 'reports' || activeTab === 'earnings') && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card padding="sm" className="p-5">
                  <span className="text-xs text-[#6B7280]">Total Registered Users</span>
                  <div className="text-2xl font-bold text-[#111827] mt-1">{stats.users}</div>
                  <span className="text-[11px] text-[#F95700] font-semibold">
                    {stats.proUsers} Pro Members
                  </span>
                </Card>

                <Card padding="sm" className="p-5">
                  <span className="text-xs text-[#6B7280]">Published Tasks</span>
                  <div className="text-2xl font-bold text-[#111827] mt-1">{stats.tasks}</div>
                  <span className="text-[11px] text-[#6B7280]">
                    {stats.pendingReviews} submissions awaiting review
                  </span>
                </Card>

                <Card padding="sm" className="p-5">
                  <span className="text-xs text-[#6B7280]">Platform Revenue (Non-Liability)</span>
                  <div className="text-2xl font-bold text-[#10B981] mt-1">
                    {formatNaira(stats.platformRevenueKobo)}
                  </div>
                  <span className="text-[11px] text-[#6B7280]">Fees &amp; Unallocated Commissions</span>
                </Card>

                <Card padding="sm" className="p-5">
                  <span className="text-xs text-[#6B7280]">Pending Disputes &amp; Cashouts</span>
                  <div className="text-2xl font-bold text-[#EF4444] mt-1">
                    {stats.disputes} disputes / {stats.pendingWithdrawals} payouts
                  </div>
                  <span className="text-[11px] text-[#6B7280]">Require action in admin queue</span>
                </Card>
              </div>

              <Card className="p-6 space-y-2">
                <h3 className="text-sm font-bold text-[#111827]">Financial Separation Policy</h3>
                <p className="text-xs text-[#6B7280] leading-relaxed">
                  Gross payments from funded tasks ({formatNaira(stats.totalPaidTasksKobo)}) remain
                  reserved until approved participants receive rewards and referrers receive
                  commissions. Standard ₦200 platform fees, ₦200 premium fees, ₦200 Pro passes, and
                  unallocated referral shares belong strictly to platform revenue (
                  {formatNaira(stats.platformRevenueKobo)}).
                </p>
              </Card>
            </div>
          )}

          {/* TAB 2: USERS / 10. REFERRALS / 14. FRAUD */}
          {(activeTab === 'users' || activeTab === 'referrals' || activeTab === 'fraud') && (
            <Card className="p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-[#111827]">
                    {activeTab === 'referrals'
                      ? 'Referral Attribution Ledger'
                      : activeTab === 'fraud'
                      ? 'Fraud & Account Risk Monitoring'
                      : `Registered Users (${filteredItems.length})`}
                  </h3>
                  <p className="text-xs text-[#6B7280]">
                    Credit wallets, upgrade accounts to Pro, and manage user statuses.
                  </p>
                </div>

                <div className="w-full sm:w-64">
                  <Input
                    placeholder="Search by email, name, or ref..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    leftIcon={<Search className="w-4 h-4 text-[#9CA3AF]" />}
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F7F7F8] text-[#6B7280]">
                    <tr>
                      <th className="p-3 rounded-l-md">User</th>
                      <th className="p-3">Ref Code</th>
                      <th className="p-3">Referred By</th>
                      <th className="p-3">Tier</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Balance</th>
                      <th className="p-3 text-right rounded-r-md">Admin Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E7EB]">
                    {filteredItems.map((u) => {
                      const walletObj = Array.isArray(u.temutask_wallets)
                        ? u.temutask_wallets[0]
                        : u.temutask_wallets;
                      const balanceKobo = BigInt(walletObj?.balance_kobo || 0);
                      const tier = u.tier || 'basic';
                      const status = u.status || 'active';
                      return (
                        <tr key={u.id} className="hover:bg-[#F9FAFB]">
                          <td className="p-3 font-semibold text-[#111827]">
                            {u.full_name || 'Member'}
                            <span className="block text-[11px] text-[#9CA3AF] font-normal">
                              {u.email}
                            </span>
                          </td>
                          <td className="p-3 font-mono font-bold text-[#F95700]">
                            {u.referral_code}
                          </td>
                          <td className="p-3 font-mono text-[#6B7280]">{u.referred_by || '—'}</td>
                          <td className="p-3">
                            <Badge variant={tier === 'pro' ? 'premium' : 'secondary'}>
                              {tier.toUpperCase()}
                            </Badge>
                          </td>
                          <td className="p-3">
                            <Badge variant={status === 'active' ? 'success' : 'danger'}>
                              {status.toUpperCase()}
                            </Badge>
                          </td>
                          <td className="p-3 text-right font-bold text-[#111827]">
                            {formatNaira(balanceKobo)}
                          </td>
                          <td className="p-3 text-right space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedUserForCredit(u);
                                setCreditAmountNaira('');
                                setCreditReason('');
                              }}
                              leftIcon={<PlusCircle className="w-3.5 h-3.5 text-[#10B981]" />}
                            >
                              Credit ₦
                            </Button>
                            <Button
                              size="sm"
                              variant={u.tier === 'pro' ? 'secondary' : 'primary'}
                              onClick={() => {
                                setSelectedUserForPro(u);
                                setProDays('14');
                                setProReason('');
                              }}
                              leftIcon={<Sparkles className="w-3.5 h-3.5" />}
                            >
                              {u.tier === 'pro' ? 'Extend Pro' : 'Grant Pro'}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleToggleUserStatus(u.id, u.status)}
                            >
                              {u.status === 'active' ? 'Suspend' : 'Activate'}
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* TAB 3: TASKS */}
          {activeTab === 'tasks' && (
            <Card className="p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-[#111827]">
                    Marketplace Tasks ({filteredItems.length})
                  </h3>
                  <div className="flex items-center gap-2 mt-1 text-xs text-[#6B7280]">
                    <span>Auto-Email Alerts:</span>
                    <Badge variant={taskEmailAudience === 'all' ? 'success' : 'premium'} className="text-[10px]">
                      {taskEmailAudience === 'all' ? '⚡ ALL USERS' : '⭐ PRO ONLY'}
                    </Badge>
                    <button
                      type="button"
                      onClick={() => setActiveTab('settings')}
                      className="text-[#F95700] hover:underline font-medium text-[11px] ml-1"
                    >
                      Change in Settings →
                    </button>
                  </div>
                </div>
                <div className="w-full sm:w-64">
                  <Input
                    placeholder="Search tasks..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    leftIcon={<Search className="w-4 h-4 text-[#9CA3AF]" />}
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F7F7F8] text-[#6B7280]">
                    <tr>
                      <th className="p-3 rounded-l-md">Task Title &amp; Link</th>
                      <th className="p-3">Creator</th>
                      <th className="p-3">Type</th>
                      <th className="p-3">Progress</th>
                      <th className="p-3">Reward/Slot</th>
                      <th className="p-3">Total Paid</th>
                      <th className="p-3 text-right rounded-r-md">Status &amp; Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E7EB]">
                    {filteredItems.map((t) => (
                      <tr key={t.id} className="hover:bg-[#F9FAFB]">
                        <td className="p-3 font-bold text-[#111827]">
                          <div className="flex items-center gap-1.5">
                            {t.title}
                            {t.is_premium && (
                              <Badge variant="premium" className="text-[9px]">
                                PREMIUM
                              </Badge>
                            )}
                          </div>
                          <a
                            href={t.invitation_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-[#0090FE] hover:underline flex items-center gap-1 font-mono truncate max-w-xs mt-0.5"
                          >
                            {t.invitation_link} <ExternalLink className="w-3 h-3" />
                          </a>
                        </td>
                        <td className="p-3 text-[#4B5563]">{t.temutask_profiles?.email}</td>
                        <td className="p-3 font-semibold">{t.task_type}</td>
                        <td className="p-3 font-bold">
                          {t.quantity_approved} / {t.quantity_requested}
                        </td>
                        <td className="p-3 text-[#10B981] font-bold">
                          {formatNaira(BigInt(t.reward_per_participant_kobo || 0))}
                        </td>
                        <td className="p-3 font-bold text-[#111827]">
                          {formatNaira(BigInt(t.total_paid_kobo || 0))}
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Badge variant={t.status === 'active' ? 'success' : 'secondary'}>
                              {(t.status || 'pending').toUpperCase()}
                            </Badge>
                            {t.status === 'active' && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-[11px] h-7 px-2 border-[#E5E7EB] hover:border-[#F95700] hover:text-[#F95700] flex items-center gap-1 font-semibold"
                                onClick={() => {
                                  setSelectedTaskForBroadcast(t);
                                  setBroadcastAudience(taskEmailAudience);
                                }}
                              >
                                <Mail className="w-3 h-3 text-[#F95700]" />
                                <span>Broadcast</span>
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* TAB 4: SUBMISSIONS & 5. DISPUTES */}
          {(activeTab === 'submissions' || activeTab === 'disputes') && (
            <Card className="p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h3 className="text-base font-bold text-[#111827]">
                  {activeTab === 'disputes'
                    ? `Disputes & Unreviewed Submissions (${filteredItems.length})`
                    : `All Submissions (${filteredItems.length})`}
                </h3>
                <div className="w-full sm:w-64">
                  <Input
                    placeholder="Search by participant or task..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    leftIcon={<Search className="w-4 h-4 text-[#9CA3AF]" />}
                  />
                </div>
              </div>

              {filteredItems.length === 0 ? (
                <div className="text-center py-12 text-[#9CA3AF] text-xs">
                  No submissions found in this queue.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F7F7F8] text-[#6B7280]">
                      <tr>
                        <th className="p-3 rounded-l-md">Task</th>
                        <th className="p-3">Participant</th>
                        <th className="p-3">Temu Account Details</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Decline Note</th>
                        <th className="p-3 text-right rounded-r-md">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E7EB]">
                      {filteredItems.map((sub) => (
                        <tr key={sub.id} className="hover:bg-[#F9FAFB]">
                          <td className="p-3 font-bold text-[#111827]">
                            {sub.temutask_tasks?.title}
                          </td>
                          <td className="p-3 text-[#4B5563]">
                            {sub.temutask_profiles?.full_name}
                            <span className="block text-[10px] text-[#9CA3AF]">
                              {sub.temutask_profiles?.email}
                            </span>
                          </td>
                          <td className="p-3 font-mono">
                            <span className="font-bold text-[#111827]">{sub.temu_username}</span>
                            <span className="block text-[11px] text-[#6B7280]">
                              {sub.temu_email}
                            </span>
                          </td>
                          <td className="p-3">
                            <Badge
                              variant={
                                sub.status === 'approved'
                                  ? 'success'
                                  : sub.status === 'declined_disputed'
                                  ? 'danger'
                                  : 'warning'
                              }
                            >
                              {(sub.status || 'pending').toUpperCase()}
                            </Badge>
                          </td>
                          <td className="p-3 text-[#EF4444] font-medium max-w-xs">
                            {(() => {
                              if (!sub.decline_reason) return '—';
                              try {
                                const parsed = typeof sub.decline_reason === 'string' ? JSON.parse(sub.decline_reason) : sub.decline_reason;
                                if (parsed && typeof parsed === 'object') {
                                  return (
                                    <div className="space-y-1">
                                      <div>{parsed.reason || 'No reason provided'}</div>
                                      {parsed.proofUrl && (
                                        <a
                                          href={parsed.proofUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-[11px] text-[#0090FE] hover:underline flex items-center gap-1 font-semibold"
                                        >
                                          View Rejection Proof Image →
                                        </a>
                                      )}
                                    </div>
                                  );
                                }
                              } catch {}
                              return String(sub.decline_reason);
                            })()}
                          </td>
                          <td className="p-3 text-right">
                            {sub.status !== 'approved' && (
                              <Button
                                size="sm"
                                variant="primary"
                                onClick={() => {
                                  fetch('/api/tasks/review', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      submissionId: sub.id,
                                      action: 'approve',
                                    }),
                                  }).then(() => loadTabContent());
                                }}
                              >
                                Approve &amp; Credit
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}

          {/* TAB 8: WITHDRAWALS */}
          {activeTab === 'withdrawals' && (
            <Card className="p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h3 className="text-base font-bold text-[#111827]">
                  Withdrawal Cash Out Requests ({filteredItems.length})
                </h3>
                <div className="w-full sm:w-64">
                  <Input
                    placeholder="Search account or user..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    leftIcon={<Search className="w-4 h-4 text-[#9CA3AF]" />}
                  />
                </div>
              </div>

              {filteredItems.length === 0 ? (
                <div className="text-center py-12 text-[#9CA3AF] text-xs">
                  No withdrawal requests found.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F7F7F8] text-[#6B7280]">
                      <tr>
                        <th className="p-3 rounded-l-md">User</th>
                        <th className="p-3">Destination</th>
                        <th className="p-3">Account Number</th>
                        <th className="p-3">Account Name</th>
                        <th className="p-3">Net to Pay</th>
                        <th className="p-3">Status</th>
                        <th className="p-3 text-right rounded-r-md">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E7EB]">
                      {filteredItems.map((wth) => {
                        const netKobo = BigInt(wth.amount_kobo || 0);
                        const grossKobo = BigInt(wth.total_debit_kobo || wth.amount_kobo || 0);
                        return (
                          <tr key={wth.id} className="hover:bg-[#F9FAFB]">
                            <td className="p-3 font-semibold text-[#111827]">
                              {wth.temutask_profiles?.full_name || 'Member'}
                              <span className="block text-[11px] text-[#9CA3AF]">
                                {wth.temutask_profiles?.email}
                              </span>
                            </td>
                            <td className="p-3 font-bold uppercase text-[#F95700]">
                              {wth.payment_destination}
                            </td>
                            <td className="p-3 font-mono font-bold">{wth.account_number}</td>
                            <td className="p-3">{wth.account_name}</td>
                            <td className="p-3">
                              <span className="font-extrabold text-[#10B981] text-sm block">
                                {formatNaira(netKobo)}
                              </span>
                              <span className="text-[10px] text-[#6B7280] font-normal block">
                                Gross: {formatNaira(grossKobo)} (Fee: ₦50)
                              </span>
                            </td>
                            <td className="p-3">
                              <Badge variant={wth.status === 'paid' ? 'success' : 'warning'}>
                                {wth.status?.toUpperCase() || 'PENDING'}
                              </Badge>
                            </td>
                            <td className="p-3 text-right">
                              {wth.status === 'pending' && (
                                <Button
                                  size="sm"
                                  variant="primary"
                                  onClick={() => handleMarkWithdrawalPaid(wth.id)}
                                >
                                  Mark Paid
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}

          {/* TAB 6: PAYMENT ORDERS */}
          {activeTab === 'payments' && (
            <Card className="p-6 space-y-4">
              <h3 className="text-base font-bold text-[#111827]">
                Novac Payment Orders ({filteredItems.length})
              </h3>
              {filteredItems.length === 0 ? (
                <div className="text-center py-12 text-[#9CA3AF] text-xs">
                  No payment orders found.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F7F7F8] text-[#6B7280]">
                      <tr>
                        <th className="p-3 rounded-l-md">Date</th>
                        <th className="p-3">User</th>
                        <th className="p-3">Type</th>
                        <th className="p-3">Reference</th>
                        <th className="p-3">Amount</th>
                        <th className="p-3 text-right rounded-r-md">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E7EB]">
                      {filteredItems.map((p) => (
                        <tr key={p.id} className="hover:bg-[#F9FAFB]">
                          <td className="p-3 text-[#6B7280]">
                            {new Date(p.created_at).toLocaleString()}
                          </td>
                          <td className="p-3 font-semibold text-[#111827]">
                            {p.temutask_profiles?.email}
                          </td>
                          <td className="p-3 capitalize">
                            {(p.related_payload?.order_type || p.order_type)?.replace('_', ' ')}
                          </td>
                          <td className="p-3 font-mono font-bold text-[#F95700]">{p.reference}</td>
                          <td className="p-3 font-bold text-[#111827]">
                            {formatNaira(BigInt(p.amount_kobo || 0))}
                          </td>
                          <td className="p-3 text-right">
                            <Badge variant={p.status === 'successful' ? 'success' : 'warning'}>
                              {p.status?.toUpperCase()}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}

          {/* TAB 7: WALLET LEDGER */}
          {activeTab === 'ledger' && (
            <Card className="p-6 space-y-4">
              <h3 className="text-base font-bold text-[#111827]">
                Master Wallet Ledger ({filteredItems.length})
              </h3>
              {filteredItems.length === 0 ? (
                <div className="text-center py-12 text-[#9CA3AF] text-xs">
                  No ledger entries recorded yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F7F7F8] text-[#6B7280]">
                      <tr>
                        <th className="p-3 rounded-l-md">Timestamp</th>
                        <th className="p-3">User</th>
                        <th className="p-3">Type</th>
                        <th className="p-3">Description</th>
                        <th className="p-3">Reference</th>
                        <th className="p-3 text-right rounded-r-md">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E7EB]">
                      {filteredItems.map((l) => (
                        <tr key={l.id} className="hover:bg-[#F9FAFB]">
                          <td className="p-3 text-[#6B7280]">
                            {new Date(l.created_at).toLocaleString()}
                          </td>
                          <td className="p-3 font-semibold text-[#111827]">
                            {l.temutask_profiles?.email || l.user_id}
                          </td>
                          <td className="p-3 font-mono font-semibold">{l.transaction_type}</td>
                          <td className="p-3 text-[#4B5563]">{l.description || '—'}</td>
                          <td className="p-3 font-mono text-[#9CA3AF]">{l.reference}</td>
                          <td
                            className={`p-3 text-right font-bold ${
                              l.direction === 'credit' ? 'text-[#10B981]' : 'text-[#EF4444]'
                            }`}
                          >
                            {l.direction === 'credit' ? '+' : '-'}
                            {formatNaira(BigInt(l.amount_kobo || 0))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}

          {/* TAB 9: AIRTIME LOGS */}
          {activeTab === 'airtime' && (
            <Card className="p-6 space-y-4">
              <h3 className="text-base font-bold text-[#111827]">
                SmartAPI Airtime Purchases ({filteredItems.length})
              </h3>
              {filteredItems.length === 0 ? (
                <div className="text-center py-12 text-[#9CA3AF] text-xs">
                  No airtime transactions recorded yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F7F7F8] text-[#6B7280]">
                      <tr>
                        <th className="p-3 rounded-l-md">Date</th>
                        <th className="p-3">User</th>
                        <th className="p-3">Network</th>
                        <th className="p-3">Phone</th>
                        <th className="p-3">Amount</th>
                        <th className="p-3">Reference</th>
                        <th className="p-3 text-right rounded-r-md">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E7EB]">
                      {filteredItems.map((a) => (
                        <tr key={a.id} className="hover:bg-[#F9FAFB]">
                          <td className="p-3 text-[#6B7280]">
                            {new Date(a.created_at).toLocaleString()}
                          </td>
                          <td className="p-3 font-semibold text-[#111827]">
                            {a.temutask_profiles?.email}
                          </td>
                          <td className="p-3 font-bold text-[#F95700]">{a.network}</td>
                          <td className="p-3 font-mono font-bold">{a.phone}</td>
                          <td className="p-3 font-bold text-[#111827]">
                            ₦{Number(a.amount_naira || 0).toLocaleString()}
                          </td>
                          <td className="p-3 font-mono text-[#9CA3AF]">{a.reference}</td>
                          <td className="p-3 text-right">
                            <Badge variant={a.status === 'successful' ? 'success' : 'warning'}>
                              {a.status?.toUpperCase()}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}

          {/* TAB 12: PRO MEMBERSHIPS */}
          {activeTab === 'pro' && (
            <Card className="p-6 space-y-4">
              <h3 className="text-base font-bold text-[#111827]">
                Pro Membership Subscriptions ({filteredItems.length})
              </h3>
              {filteredItems.length === 0 ? (
                <div className="text-center py-12 text-[#9CA3AF] text-xs">
                  No Pro subscriptions found.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F7F7F8] text-[#6B7280]">
                      <tr>
                        <th className="p-3 rounded-l-md">User</th>
                        <th className="p-3">Method</th>
                        <th className="p-3">Starts At</th>
                        <th className="p-3">Expires At</th>
                        <th className="p-3">Reference</th>
                        <th className="p-3 text-right rounded-r-md">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E7EB]">
                      {filteredItems.map((pr) => (
                        <tr key={pr.id} className="hover:bg-[#F9FAFB]">
                          <td className="p-3 font-semibold text-[#111827]">
                            {pr.temutask_profiles?.email}
                          </td>
                          <td className="p-3 uppercase font-mono font-semibold">
                            {pr.payment_method}
                          </td>
                          <td className="p-3 text-[#6B7280]">
                            {new Date(pr.starts_at).toLocaleDateString()}
                          </td>
                          <td className="p-3 text-[#6B7280]">
                            {new Date(pr.expires_at).toLocaleDateString()}
                          </td>
                          <td className="p-3 font-mono text-[#9CA3AF]">{pr.reference}</td>
                          <td className="p-3 text-right">
                            <Badge variant={pr.status === 'active' ? 'premium' : 'secondary'}>
                              {pr.status?.toUpperCase()}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}

          {/* TAB 13: EMAILS & 17. AUDIT */}
          {(activeTab === 'emails' || activeTab === 'audit') && (
            <Card className="p-6 space-y-4">
              <h3 className="text-base font-bold text-[#111827]">
                {activeTab === 'emails'
                  ? `Sendbyte Africa Email Logs (${filteredItems.length})`
                  : `Admin Audit Logs (${filteredItems.length})`}
              </h3>
              {filteredItems.length === 0 ? (
                <div className="text-center py-12 text-[#9CA3AF] text-xs">No logs recorded yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F7F7F8] text-[#6B7280]">
                      <tr>
                        <th className="p-3 rounded-l-md">Timestamp</th>
                        <th className="p-3">
                          {activeTab === 'emails' ? 'Recipient' : 'Admin'}
                        </th>
                        <th className="p-3">Action / Subject</th>
                        <th className="p-3 text-right rounded-r-md">Status / Target</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E7EB]">
                      {filteredItems.map((item) => (
                        <tr key={item.id} className="hover:bg-[#F9FAFB]">
                          <td className="p-3 text-[#6B7280]">
                            {new Date(item.created_at).toLocaleString()}
                          </td>
                          <td className="p-3 font-semibold text-[#111827]">
                            {activeTab === 'emails'
                              ? item.recipient_email
                              : item.temutask_profiles?.email || item.admin_id}
                          </td>
                          <td className="p-3">
                            <span className="font-bold text-[#111827]">
                              {activeTab === 'emails' ? item.subject : item.action}
                            </span>
                            {activeTab === 'emails' && (
                              <span className="block text-[11px] text-[#9CA3AF]">
                                Event: {item.event_type}
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-right">
                            <Badge variant="secondary">
                              {activeTab === 'emails'
                                ? item.status?.toUpperCase()
                                : item.target_type?.toUpperCase()}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}

          {/* TAB 16: SETTINGS */}
          {activeTab === 'settings' && (
            <div className="space-y-6">
              {/* NEW TASK EMAIL NOTIFICATIONS AUDIENCE SETTING */}
              <Card className="p-6 space-y-4 border-2 border-[#F95700]/20 bg-linear-to-br from-white to-[#FFFBF9]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E5E7EB]">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-[#FFF5F0] text-[#F95700] flex items-center justify-center font-bold">
                        <Mail className="w-4 h-4" />
                      </div>
                      <h3 className="text-base font-bold text-[#111827]">
                        New Task Email Alerts Audience
                      </h3>
                    </div>
                    <p className="text-xs text-[#6B7280]">
                      Configure which audience automatically receives email notifications whenever a new task is published.
                    </p>
                  </div>
                  <div>
                    <Badge variant={taskEmailAudience === 'all' ? 'success' : 'premium'}>
                      CURRENT: {taskEmailAudience === 'all' ? '⚡ ALL REGISTERED USERS' : '⭐ PRO MEMBERS ONLY'}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  {/* Option 1: All Registered Users */}
                  <div
                    onClick={() => handleSaveAudience('all')}
                    className={`cursor-pointer p-4 rounded-xl border-2 transition-all flex flex-col justify-between space-y-3 ${
                      taskEmailAudience === 'all'
                        ? 'border-[#F95700] bg-[#FFF8F5] shadow-xs'
                        : 'border-[#E5E7EB] bg-white hover:border-[#F95700]/40'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-[#111827]">All Registered Users</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#10B981]/15 text-[#10B981]">
                            Recommended
                          </span>
                        </div>
                        <p className="text-xs text-[#6B7280]">
                          Every registered user with a valid email receives an instant task alert email. Maximizes reach and accelerates task completion.
                        </p>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                          taskEmailAudience === 'all'
                            ? 'border-[#F95700] bg-[#F95700] text-white'
                            : 'border-[#D1D5DB] bg-white'
                        }`}
                      >
                        {taskEmailAudience === 'all' && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant={taskEmailAudience === 'all' ? 'primary' : 'outline'}
                      className="w-full text-xs font-semibold"
                      disabled={isSavingAudience}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSaveAudience('all');
                      }}
                    >
                      {taskEmailAudience === 'all' ? 'Active Setting' : 'Switch to All Users'}
                    </Button>
                  </div>

                  {/* Option 2: Pro Members Only */}
                  <div
                    onClick={() => handleSaveAudience('pro_only')}
                    className={`cursor-pointer p-4 rounded-xl border-2 transition-all flex flex-col justify-between space-y-3 ${
                      taskEmailAudience === 'pro_only'
                        ? 'border-[#F95700] bg-[#FFF8F5] shadow-xs'
                        : 'border-[#E5E7EB] bg-white hover:border-[#F95700]/40'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-[#111827]">Pro Members Only</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#F59E0B]/15 text-[#D97706]">
                            VIP Exclusive
                          </span>
                        </div>
                        <p className="text-xs text-[#6B7280]">
                          Only members with an active Pro membership pass receive task alert emails. Keeps alerts exclusive to paying Pro users.
                        </p>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                          taskEmailAudience === 'pro_only'
                            ? 'border-[#F95700] bg-[#F95700] text-white'
                            : 'border-[#D1D5DB] bg-white'
                        }`}
                      >
                        {taskEmailAudience === 'pro_only' && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant={taskEmailAudience === 'pro_only' ? 'primary' : 'outline'}
                      className="w-full text-xs font-semibold"
                      disabled={isSavingAudience}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSaveAudience('pro_only');
                      }}
                    >
                      {taskEmailAudience === 'pro_only' ? 'Active Setting' : 'Switch to Pro Only'}
                    </Button>
                  </div>
                </div>
              </Card>

              {/* PLATFORM CONFIGURATION REFERENCE */}
              <Card className="p-6 space-y-4">
                <h3 className="text-base font-bold text-[#111827]">Platform Default Configuration</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="p-3 bg-[#F7F7F8] rounded-xl border border-[#E5E7EB]">
                    <span className="text-[#6B7280] block">Existing User Price Default / Split</span>
                    <span className="font-bold text-sm text-[#111827]">₦100 (₦80 / ₦20)</span>
                  </div>
                  <div className="p-3 bg-[#F7F7F8] rounded-xl border border-[#E5E7EB]">
                    <span className="text-[#6B7280] block">New User Price Default / Split</span>
                    <span className="font-bold text-sm text-[#111827]">₦500 (₦400 / ₦100)</span>
                  </div>
                  <div className="p-3 bg-[#F7F7F8] rounded-xl border border-[#E5E7EB]">
                    <span className="text-[#6B7280] block">Standard Platform Fee / Premium Add-on</span>
                    <span className="font-bold text-sm text-[#111827]">₦200 / +₦200</span>
                  </div>
                  <div className="p-3 bg-[#F7F7F8] rounded-xl border border-[#E5E7EB]">
                    <span className="text-[#6B7280] block">Pro Pass Price &amp; Duration</span>
                    <span className="font-bold text-sm text-[#111827]">₦200 / 14 Days</span>
                  </div>
                  <div className="p-3 bg-[#F7F7F8] rounded-xl border border-[#E5E7EB]">
                    <span className="text-[#6B7280] block">Nightly Auto-Review Cutoff</span>
                    <span className="font-bold text-sm text-[#111827]">23:00 (Africa/Lagos)</span>
                  </div>
                  <div className="p-3 bg-[#F7F7F8] rounded-xl border border-[#E5E7EB]">
                    <span className="text-[#6B7280] block">Supported Cash Out Channels</span>
                    <span className="font-bold text-sm text-[#111827]">OPay, PalmPay, Moniepoint</span>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </main>
      </div>

      {/* MODAL 1: CREDIT USER WALLET */}
      {selectedUserForCredit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2.5rem)] flex flex-col shadow-2xl relative border border-[#E5E7EB] overflow-hidden my-auto animate-in zoom-in-95 duration-200">
            <div className="p-3.5 sm:p-4 border-b border-[#E5E7EB] flex items-center justify-between shrink-0 bg-white">
              <h3 className="text-sm sm:text-base font-bold text-[#111827]">
                Credit User Wallet
              </h3>
              <button
                onClick={() => setSelectedUserForCredit(null)}
                className="p-1 rounded-full text-[#9CA3AF] hover:text-[#111827] hover:bg-[#F3F4F6] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreditWallet} className="flex flex-col flex-1 overflow-hidden min-h-0">
              <div className="overflow-y-auto p-4 sm:p-5 space-y-3.5 flex-1">
                <div className="p-3 bg-[#F7F7F8] rounded-xl border border-[#E5E7EB] text-xs space-y-1">
                  <span className="text-[#6B7280] block">Target Account:</span>
                  <strong className="text-sm text-[#111827] block truncate">
                    {selectedUserForCredit.email}
                  </strong>
                  <span className="text-[#6B7280]">
                    Current Balance:{' '}
                    <strong className="text-[#10B981]">
                      {formatNaira(
                        BigInt(selectedUserForCredit.temutask_wallets?.balance_kobo || 0)
                      )}
                    </strong>
                  </span>
                </div>

                <Input
                  label="Credit Amount (₦)"
                  placeholder="e.g. 500 or 2000"
                  type="number"
                  min="1"
                  step="1"
                  value={creditAmountNaira}
                  onChange={(e) => setCreditAmountNaira(e.target.value)}
                  required
                />

                <Input
                  label="Reason / Audit Note"
                  placeholder="e.g. Compensation for dispute #104 or Promo Bonus"
                  value={creditReason}
                  onChange={(e) => setCreditReason(e.target.value)}
                />
              </div>

              <div className="p-3 sm:p-3.5 border-t border-[#E5E7EB] bg-[#F7F7F8] flex items-center justify-end gap-2.5 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedUserForCredit(null)}
                  disabled={isCrediting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  isLoading={isCrediting}
                  loadingText="Crediting..."
                >
                  Confirm Credit of ₦{Number(creditAmountNaira || 0).toLocaleString()}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: GRANT / EXTEND PRO MEMBERSHIP */}
      {selectedUserForPro && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2.5rem)] flex flex-col shadow-2xl relative border border-[#E5E7EB] overflow-hidden my-auto animate-in zoom-in-95 duration-200">
            <div className="p-3.5 sm:p-4 border-b border-[#E5E7EB] flex items-center justify-between shrink-0 bg-white">
              <h3 className="text-sm sm:text-base font-bold text-[#111827]">
                Grant / Extend Pro Membership
              </h3>
              <button
                onClick={() => setSelectedUserForPro(null)}
                className="p-1 rounded-full text-[#9CA3AF] hover:text-[#111827] hover:bg-[#F3F4F6] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpgradePro} className="flex flex-col flex-1 overflow-hidden min-h-0">
              <div className="overflow-y-auto p-4 sm:p-5 space-y-3.5 flex-1">
                <div className="p-3 bg-[#FFF5F0] rounded-xl border border-[#F95700]/30 text-xs space-y-1">
                  <span className="text-[#6B7280] block">Target Account:</span>
                  <strong className="text-sm text-[#111827] block truncate">
                    {selectedUserForPro.email}
                  </strong>
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-[#6B7280]">Current Tier:</span>
                    <Badge variant={selectedUserForPro.tier === 'pro' ? 'premium' : 'secondary'}>
                      {selectedUserForPro.tier?.toUpperCase()}
                    </Badge>
                    {selectedUserForPro.pro_expires_at && (
                      <span className="text-[11px] text-[#6B7280]">
                        (Expires: {new Date(selectedUserForPro.pro_expires_at).toLocaleDateString()})
                      </span>
                    )}
                  </div>
                </div>

                <Input
                  label="Duration (Days)"
                  type="number"
                  min="1"
                  max="365"
                  value={proDays}
                  onChange={(e) => setProDays(e.target.value)}
                  required
                />

                <Input
                  label="Reason / Note"
                  placeholder="e.g. VIP Creator perk or Platform incentive"
                  value={proReason}
                  onChange={(e) => setProReason(e.target.value)}
                />
              </div>

              <div className="p-3 sm:p-3.5 border-t border-[#E5E7EB] bg-[#F7F7F8] flex items-center justify-end gap-2.5 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedUserForPro(null)}
                  disabled={isUpgradingPro}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  isLoading={isUpgradingPro}
                  loadingText="Granting Pro..."
                >
                  Grant {proDays} Days Pro
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: BROADCAST TASK EMAIL ALERT */}
      {selectedTaskForBroadcast && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2.5rem)] flex flex-col shadow-2xl relative border border-[#E5E7EB] overflow-hidden my-auto animate-in zoom-in-95 duration-200">
            <div className="p-3.5 sm:p-4 border-b border-[#E5E7EB] flex items-center justify-between shrink-0 bg-white">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#FFF5F0] text-[#F95700] flex items-center justify-center font-bold">
                  <Mail className="w-4 h-4" />
                </div>
                <h3 className="text-sm sm:text-base font-bold text-[#111827]">
                  Broadcast Task Email Alert
                </h3>
              </div>
              <button
                onClick={() => setSelectedTaskForBroadcast(null)}
                className="p-1 rounded-full text-[#9CA3AF] hover:text-[#111827] hover:bg-[#F3F4F6] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleBroadcastTask} className="flex flex-col flex-1 overflow-hidden min-h-0">
              <div className="overflow-y-auto p-4 sm:p-5 space-y-4 flex-1">
                {/* Task Details Card */}
                <div className="p-3 bg-[#F9FAFB] rounded-xl border border-[#E5E7EB] text-xs space-y-2">
                  <span className="text-[#6B7280] block text-[11px] font-semibold uppercase tracking-wider">
                    Task To Broadcast
                  </span>
                  <strong className="text-sm text-[#111827] block">
                    {selectedTaskForBroadcast.title?.split('|||')[0]}
                  </strong>
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#E5E7EB]/60">
                    <div>
                      <span className="text-[#6B7280] block text-[10px]">Reward / Participant:</span>
                      <strong className="text-sm text-[#10B981]">
                        ₦{(Number(selectedTaskForBroadcast.reward_per_participant_kobo || 0) / 100).toLocaleString()}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[#6B7280] block text-[10px]">Requested Slots:</span>
                      <strong className="text-sm text-[#111827]">
                        {selectedTaskForBroadcast.quantity_requested} Slots
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Audience Selection */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-[#111827]">
                    Select Target Audience
                  </label>
                  <div className="grid grid-cols-1 gap-2.5">
                    <div
                      onClick={() => setBroadcastAudience('all')}
                      className={`cursor-pointer p-3 rounded-xl border transition-all flex items-center justify-between ${
                        broadcastAudience === 'all'
                          ? 'border-[#F95700] bg-[#FFF8F5]'
                          : 'border-[#E5E7EB] hover:border-[#D1D5DB]'
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs text-[#111827]">All Registered Users</span>
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-[#10B981]/15 text-[#10B981]">
                            All Users
                          </span>
                        </div>
                        <p className="text-[11px] text-[#6B7280]">
                          Dispatches to all active members on TemuTasks.
                        </p>
                      </div>
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                          broadcastAudience === 'all'
                            ? 'border-[#F95700] bg-[#F95700] text-white'
                            : 'border-[#D1D5DB] bg-white'
                        }`}
                      >
                        {broadcastAudience === 'all' && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                      </div>
                    </div>

                    <div
                      onClick={() => setBroadcastAudience('pro_only')}
                      className={`cursor-pointer p-3 rounded-xl border transition-all flex items-center justify-between ${
                        broadcastAudience === 'pro_only'
                          ? 'border-[#F95700] bg-[#FFF8F5]'
                          : 'border-[#E5E7EB] hover:border-[#D1D5DB]'
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs text-[#111827]">Pro Members Only</span>
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-[#F59E0B]/15 text-[#D97706]">
                            Pro Only
                          </span>
                        </div>
                        <p className="text-[11px] text-[#6B7280]">
                          Dispatches exclusively to active Pro subscribers.
                        </p>
                      </div>
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                          broadcastAudience === 'pro_only'
                            ? 'border-[#F95700] bg-[#F95700] text-white'
                            : 'border-[#D1D5DB] bg-white'
                        }`}
                      >
                        {broadcastAudience === 'pro_only' && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                      </div>
                    </div>
                  </div>
                </div>

                <p className="text-[11px] text-[#6B7280] leading-relaxed">
                  Emails are sent via Sendbyte Africa with branded HTML styling and direct CTA button to open and complete the task.
                </p>
              </div>

              <div className="p-3 sm:p-3.5 border-t border-[#E5E7EB] bg-[#F7F7F8] flex items-center justify-end gap-2.5 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedTaskForBroadcast(null)}
                  disabled={isBroadcasting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  isLoading={isBroadcasting}
                  loadingText="Broadcasting..."
                  className="flex items-center gap-1.5"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Send Broadcast Email</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
