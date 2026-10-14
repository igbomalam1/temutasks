'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { formatNaira, formatNairaPlain } from '@/lib/utils';
import Link from 'next/link';
import { ArrowUpRight, ArrowLeft, CheckCircle2, AlertCircle, Building2 } from 'lucide-react';

export default function CashOutPage() {
  const { user, wallet, refreshProfile, signInWithGoogle } = useAuth();

  const [destination, setDestination] = useState<'opay' | 'palmpay' | 'moniepoint'>('opay');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [amount, setAmount] = useState<number>(1000);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const balance = BigInt(wallet?.balance_kobo || 0);
  const requestedKobo = BigInt(amount || 0) * BigInt(100);

  const paymentDestinations = [
    { id: 'opay', name: 'OPay', color: '#10B981' },
    { id: 'palmpay', name: 'PalmPay', color: '#6366F1' },
    { id: 'moniepoint', name: 'Moniepoint', color: '#0090FE' },
  ];

  const handleWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!user) {
      setIsLoading(true);
      await signInWithGoogle('/wallet/cashout');
      return;
    }

    if (!accountNumber || accountNumber.length < 10) {
      setErrorMsg('Please enter a valid 10-digit account number.');
      return;
    }

    if (!accountName.trim()) {
      setErrorMsg('Please provide your account holder name.');
      return;
    }

    if (!amount || amount < 1000) {
      setErrorMsg('Minimum cash out amount is ₦1,000.00.');
      return;
    }

    if (requestedKobo > balance) {
      setErrorMsg('Insufficient wallet balance.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/wallet/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentDestination: destination,
          accountNumber: accountNumber.trim(),
          accountName: accountName.trim(),
          amount,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to submit withdrawal request');
      } else {
        setSuccessMsg(
          `Withdrawal request submitted! ₦${amount} has been reserved from your wallet and placed into the admin queue. Ref: ${data.reference}`
        );
        setAccountNumber('');
        setAccountName('');
        await refreshProfile();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error processing withdrawal');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AppShell>
      <div className="max-w-xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/wallet" className="text-[#6B7280] hover:text-[#111827]">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#111827]">Cash Out Funds</h1>
            <p className="text-xs text-[#6B7280]">
              Fast withdrawals to your OPay, PalmPay, or Moniepoint accounts.
            </p>
          </div>
        </div>

        {/* Balance pill */}
        <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-[#E5E7EB]">
          <span className="text-xs text-[#6B7280]">Available Balance:</span>
          <span className="text-base font-bold text-[#111827]">{formatNaira(balance)}</span>
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

        <Card className="p-6">
          <form onSubmit={handleWithdrawal} className="space-y-5">
            {/* Destination Selector */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-[#111827]">
                Select Payout Destination
              </label>
              <div className="grid grid-cols-3 gap-3">
                {paymentDestinations.map((dest) => (
                  <button
                    key={dest.id}
                    type="button"
                    onClick={() => setDestination(dest.id as any)}
                    className={`py-3 px-2 rounded-lg border text-xs font-bold transition-all text-center ${
                      destination === dest.id
                        ? 'border-[#F95700] bg-[#FFF5F0] text-[#F95700] shadow-xs'
                        : 'border-[#E5E7EB] hover:border-[#D1D5DB] text-[#4B5563]'
                    }`}
                  >
                    {dest.name}
                  </button>
                ))}
              </div>
            </div>

            <Input
              label="Account Number (10 Digits)"
              placeholder="e.g. 8012345678"
              type="text"
              maxLength={10}
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              required
            />

            <Input
              label="Account Name"
              placeholder="e.g. John Doe"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              required
            />

            <Input
              label="Withdrawal Amount (₦, Min ₦1,000)"
              type="number"
              min="1000"
              value={amount.toString()}
              onChange={(e) => setAmount(parseInt(e.target.value, 10) || 0)}
              required
            />

            <Button
              type="submit"
              size="lg"
              variant="primary"
              className="w-full text-base mt-2"
              isLoading={isLoading}
              disabled={requestedKobo > balance || amount < 500}
            >
              Request Cash Out of {formatNairaPlain(amount)}
            </Button>
          </form>
        </Card>
      </div>
    </AppShell>
  );
}
