'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { formatNaira } from '@/lib/utils';
import { Sparkles, CheckCircle2, AlertCircle, CreditCard, Wallet } from 'lucide-react';

export default function ProPage() {
  const { user, profile, wallet, refreshProfile, signInWithGoogle } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const balance = BigInt(wallet?.balance_kobo || 0);
  const proCostKobo = BigInt(20000); // ₦200 in kobo

  const handleWalletUpgrade = async () => {
    if (!user) {
      setIsProcessing(true);
      await signInWithGoogle('/pro');
      return;
    }

    setIsProcessing(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await fetch('/api/pro/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentMethod: 'wallet' }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to activate Pro membership');
      } else {
        setSuccessMsg('🎉 Successfully upgraded to TemuTasks Pro for 14 days!');
        await refreshProfile();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Upgrade error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleNovacUpgrade = async () => {
    if (!user) {
      setIsProcessing(true);
      await signInWithGoogle('/pro');
      return;
    }

    setIsProcessing(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await fetch('/api/pro/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentMethod: 'novac' }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to initiate Novac checkout');
        setIsProcessing(false);
      } else if (data.paymentUrl) {
        window.location.href = data.paymentUrl;
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error processing payment');
      setIsProcessing(false);
    }
  };

  const isPro = profile?.tier === 'pro';

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFF5F0] border border-[#F95700]/20 text-[#F95700] text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5" />
            TemuTasks Pro Membership
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#111827]">
            Stay ahead with instant new-task alerts
          </h1>
          <p className="text-xs sm:text-sm text-[#6B7280] max-w-md mx-auto">
            Upgrade to Pro for just <strong>₦200 every 14 days</strong> and receive real-time email
            alerts whenever lucrative new tasks are published.
          </p>
        </div>

        {errorMsg && (
          <div className="p-4 bg-[#FEF2F2] border border-[#FECACA] rounded-xl text-xs text-[#DC2626] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-4 bg-[#ECFDF5] border border-[#A7F3D0] rounded-xl text-xs text-[#059669] flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Pricing Box */}
        <Card className="border-2 border-[#F95700] shadow-md p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E5E7EB] pb-6">
            <div>
              <span className="text-xs font-bold text-[#F95700] uppercase tracking-wider">
                14-Day Pro Pass
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-3xl font-black text-[#111827]">₦200.00</span>
                <span className="text-xs text-[#6B7280]">/ 14 days</span>
              </div>
            </div>

            {isPro ? (
              <Badge variant="premium" className="px-3 py-1 text-xs">
                CURRENTLY ACTIVE
              </Badge>
            ) : (
              <Badge variant="secondary" className="px-3 py-1 text-xs">
                BASIC TIER
              </Badge>
            )}
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-bold text-[#111827]">Pro Benefits Included:</h3>
            <ul className="space-y-2.5 text-xs text-[#4B5563]">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0" />
                <span>
                  <strong>Multi-Task Batch Submission:</strong> Pro user can submit multiple tasks
                  at once and earn for all!
                </span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0" />
                <span>
                  <strong>Recurring Task Alert Emails:</strong> Instant notification via Sendbyte
                  Africa when eligible tasks are published.
                </span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0" />
                <span>
                  <strong>First to Complete:</strong> High-paying ₦200 tasks fill up quickly; Pro
                  alerts and multi-task select give you a massive speed advantage.
                </span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0" />
                <span>
                  <strong>Flexible Renewal:</strong> Pay with your wallet balance or Novac checkout.
                  Renew anytime to extend your time.
                </span>
              </li>
            </ul>
          </div>

          {/* Payment Selection */}
          <div className="pt-4 border-t border-[#E5E7EB] space-y-3">
            <h4 className="text-xs font-bold text-[#111827] uppercase tracking-wider">
              Choose Payment Method
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button
                variant="primary"
                size="lg"
                onClick={handleWalletUpgrade}
                isLoading={isProcessing}
                disabled={balance < proCostKobo}
                leftIcon={<Wallet className="w-4 h-4" />}
                className="w-full text-xs"
              >
                Pay ₦200 with Wallet ({formatNaira(balance)})
              </Button>

              <Button
                variant="secondary"
                size="lg"
                onClick={handleNovacUpgrade}
                isLoading={isProcessing}
                leftIcon={<CreditCard className="w-4 h-4" />}
                className="w-full text-xs"
              >
                Pay ₦200 with Novac
              </Button>
            </div>

            {balance < proCostKobo && (
              <p className="text-[11px] text-[#6B7280] text-center">
                Insufficient wallet balance for wallet checkout. You can use Novac to pay with Card
                or Transfer.
              </p>
            )}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
