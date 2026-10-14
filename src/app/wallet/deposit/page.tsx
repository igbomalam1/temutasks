'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { formatNaira, formatNairaPlain } from '@/lib/utils';
import Link from 'next/link';
import { ArrowLeft, ArrowDownLeft, AlertCircle, ShieldCheck } from 'lucide-react';
import { StatusModal, StatusModalType } from '@/components/ui/StatusModal';

export default function DepositPage() {
  const { user, wallet, signInWithGoogle } = useAuth();
  const [amount, setAmount] = useState<number>(1000);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    type: StatusModalType;
    title: string;
    message?: string;
  }>({
    isOpen: false,
    type: null,
    title: '',
    message: '',
  });

  const balance = BigInt(wallet?.balance_kobo || 0);
  const presetAmounts = [500, 1000, 2000, 5000, 10000];

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!user) {
      setIsLoading(true);
      await signInWithGoogle('/wallet/deposit');
      return;
    }

    if (!amount || amount < 100) {
      setErrorMsg('Minimum deposit amount is ₦100.00.');
      return;
    }

    setIsLoading(true);
    setModalState({
      isOpen: true,
      type: 'loading',
      title: 'Connecting to Payment Gateway...',
      message: `Setting up secure Novac checkout for ₦${amount}. Redirecting...`,
    });

    try {
      const res = await fetch('/api/wallet/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      });

      const data = await res.json();

      if (!res.ok || !data.paymentUrl) {
        const errorText = data.error || 'Failed to initialize deposit checkout';
        setErrorMsg(errorText);
        setModalState({
          isOpen: true,
          type: 'error',
          title: 'Deposit Error',
          message: errorText,
        });
        setIsLoading(false);
      } else {
        // Redirect directly to Novac checkout
        window.location.href = data.paymentUrl;
      }
    } catch (err: any) {
      const errorText = err.message || 'Error initializing deposit';
      setErrorMsg(errorText);
      setModalState({
        isOpen: true,
        type: 'error',
        title: 'Connection Error',
        message: errorText,
      });
      setIsLoading(false);
    }
  };

  return (
    <AppShell>
      <div className="max-w-xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-[#6B7280] hover:text-[#111827]">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#111827]">Deposit Funds</h1>
            <p className="text-xs text-[#6B7280]">
              Instant, secure wallet top-up powered by Novac checkout.
            </p>
          </div>
        </div>

        {/* Balance overview pill */}
        <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-[#E5E7EB]">
          <span className="text-xs text-[#6B7280]">Current Available Balance:</span>
          <span className="text-base font-bold text-[#111827]">{formatNaira(balance)}</span>
        </div>

        {errorMsg && (
          <div className="p-4 bg-[#FEF2F2] border border-[#FECACA] rounded-xl text-xs text-[#DC2626] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <Card className="p-6">
          <form onSubmit={handleDeposit} className="space-y-5">
            <div className="space-y-2">
              <label className="block text-xs font-bold text-[#111827]">
                Quick Select Amount (₦)
              </label>
              <div className="grid grid-cols-5 gap-2">
                {presetAmounts.map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setAmount(amt)}
                    className={`py-2.5 px-2 rounded-lg border text-xs font-bold transition-all text-center ${
                      amount === amt
                        ? 'border-[#F95700] bg-[#FFF5F0] text-[#F95700] shadow-xs'
                        : 'border-[#E5E7EB] hover:border-[#D1D5DB] text-[#4B5563]'
                    }`}
                  >
                    ₦{amt.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            <Input
              label="Deposit Amount (₦, Min ₦100)"
              type="number"
              min="100"
              max="500000"
              value={amount.toString()}
              onChange={(e) => setAmount(parseInt(e.target.value, 10) || 0)}
              required
            />

            <div className="p-3 bg-[#F9FAFB] rounded-lg border border-[#E5E7EB] flex items-center gap-2.5 text-xs text-[#6B7280]">
              <ShieldCheck className="w-4 h-4 text-[#10B981] shrink-0" />
              <span>Payments are processed securely via Novac with bank transfer, card, and USSD.</span>
            </div>

            <Button
              type="submit"
              size="lg"
              variant="primary"
              className="w-full text-base mt-2"
              isLoading={isLoading}
              disabled={amount < 100}
              leftIcon={<ArrowDownLeft className="w-5 h-5" />}
            >
              Deposit {formatNairaPlain(amount)} with Novac
            </Button>
          </form>
        </Card>

        {/* Status Modal Popup */}
        <StatusModal
          isOpen={modalState.isOpen}
          type={modalState.type}
          title={modalState.title}
          message={modalState.message}
          actionText="Close"
          onAction={() => setModalState((prev) => ({ ...prev, isOpen: false }))}
          onClose={() => setModalState((prev) => ({ ...prev, isOpen: false }))}
        />
      </div>
    </AppShell>
  );
}
