'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { formatNaira } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { Users, Copy, Check, Sparkles, TrendingUp, UserCheck } from 'lucide-react';

export default function ReferralsPage() {
  const { user, profile, wallet } = useAuth();
  const [copied, setCopied] = useState(false);
  const [referredUsers, setReferredUsers] = useState<any[]>([]);
  const [commissions, setCommissions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    const userId = profile?.id || user?.id;
    if (!userId) {
      setIsLoading(false);
      return;
    }

    const loadReferralData = async () => {
      setIsLoading(true);

      // Fetch users referred by current user
      const { data: users } = await supabase
        .from('temutask_profiles')
        .select('id, full_name, email, created_at, tier')
        .eq('referred_by', userId)
        .order('created_at', { ascending: false });

      if (users) setReferredUsers(users);

      // Fetch referral commission ledger items
      const { data: comms } = await supabase
        .from('temutask_wallet_ledger')
        .select('*')
        .eq('user_id', userId)
        .eq('transaction_type', 'commission')
        .order('created_at', { ascending: false })
        .limit(50);

      if (comms) setCommissions(comms);

      setIsLoading(false);
    };

    loadReferralData();
  }, [profile, user]);

  const effectiveReferralCode =
    profile?.referral_code ||
    (user ? `TEMU${user.id.replace(/[^a-zA-Z0-9]/g, '').substring(0, 6).toUpperCase()}` : '');

  const referralUrl =
    typeof window !== 'undefined' && effectiveReferralCode
      ? `${window.location.origin}/?ref=${effectiveReferralCode}`
      : effectiveReferralCode
      ? `https://temutasks.com/?ref=${effectiveReferralCode}`
      : '';

  const copyReferralLink = async () => {
    if (!referralUrl) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(referralUrl);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = referralUrl;
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

  const totalCommKobo = BigInt(wallet?.total_referral_earned_kobo || 0);

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white p-5 rounded-xl border border-[#E5E7EB] space-y-1">
          <h1 className="text-xl sm:text-2xl font-bold text-[#111827]">Referral Program</h1>
          <p className="text-xs sm:text-sm text-[#6B7280]">
            Earn lifetime passive income from everyone you invite to TemuTasks.
          </p>
        </div>

        {/* Hero Referral Link Card */}
        <Card className="bg-gradient-to-r from-[#FFF5F0] to-[#FFFBEB] border-[#F95700]/30 p-6 sm:p-8 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-xs font-bold text-[#F95700] uppercase tracking-wider">
                Permanent Referral Link
              </span>
              <h2 className="text-xl font-extrabold text-[#111827]">
                Share your link, earn lifetime commissions
              </h2>
              <p className="text-xs text-[#6B7280] max-w-lg">
                Whenever your referred friends complete tasks, you get <strong>₦10+</strong> on
                every existing-user task and <strong>₦50+</strong> on every new-user task. Forever!
              </p>
            </div>

            <div className="text-right sm:border-l sm:border-[#E5E7EB] sm:pl-6">
              <span className="text-xs text-[#6B7280] block">Lifetime Commissions</span>
              <span className="text-2xl font-extrabold text-[#10B981]">
                {formatNaira(totalCommKobo)}
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            <div
              onClick={copyReferralLink}
              title="Click to copy referral link"
              className="w-full bg-white px-4 py-3 rounded-lg border border-[#E5E7EB] text-sm font-mono text-[#111827] truncate cursor-pointer hover:border-[#F95700] select-all"
            >
              {referralUrl || 'Generating referral link...'}
            </div>
            <Button
              size="md"
              variant="primary"
              onClick={copyReferralLink}
              className="w-full sm:w-auto shrink-0"
              leftIcon={copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            >
              {copied ? 'Copied Link!' : 'Copy Referral Link'}
            </Button>
          </div>
        </Card>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card padding="sm" className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 bg-[#EFF6FF] text-[#0090FE] rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs text-[#6B7280]">Referred Friends</span>
              <div className="text-2xl font-bold text-[#111827]">{referredUsers.length}</div>
            </div>
          </Card>

          <Card padding="sm" className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 bg-[#ECFDF5] text-[#10B981] rounded-xl flex items-center justify-center">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs text-[#6B7280]">Total Commission Transactions</span>
              <div className="text-2xl font-bold text-[#111827]">{commissions.length}</div>
            </div>
          </Card>
        </div>

        {/* Commission History */}
        <Card className="p-6">
          <h3 className="text-base font-bold text-[#111827] mb-4">Referral Commission Ledger</h3>

          {isLoading ? (
            <div className="text-center py-12 text-[#9CA3AF] text-sm">Loading referral data...</div>
          ) : commissions.length === 0 ? (
            <div className="text-center py-12 text-[#9CA3AF] text-sm">
              No referral commissions recorded yet. Share your referral link to begin earning!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F7F7F8] text-[#6B7280]">
                  <tr>
                    <th className="p-3 rounded-l-md">Date</th>
                    <th className="p-3">Description</th>
                    <th className="p-3">Reference</th>
                    <th className="p-3 text-right rounded-r-md">Commission</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E7EB]">
                  {commissions.map((comm) => (
                    <tr key={comm.id} className="hover:bg-[#F9FAFB]">
                      <td className="p-3 text-[#6B7280]">
                        {new Date(comm.created_at).toLocaleString('en-NG', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="p-3 font-semibold text-[#111827]">{comm.description}</td>
                      <td className="p-3 text-[#9CA3AF] font-mono">{comm.reference}</td>
                      <td className="p-3 text-right font-bold text-[#10B981]">
                        +{formatNaira(BigInt(comm.amount_kobo))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
