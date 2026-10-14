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
import { Smartphone, CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react';

export default function AirtimePage() {
  const { user, wallet, refreshProfile, signInWithGoogle } = useAuth();

  const [network, setNetwork] = useState<'MTN' | 'AIRTEL' | 'GLO' | '9MOBILE'>('MTN');
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState<number>(50);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const balance = BigInt(wallet?.balance_kobo || 0);
  const costKobo = BigInt(amount || 0) * BigInt(100);

  const networks = [
    { id: 'MTN', name: 'MTN Nigeria', color: '#FBBF24' },
    { id: 'AIRTEL', name: 'Airtel Nigeria', color: '#EF4444' },
    { id: 'GLO', name: 'Glo Mobile', color: '#10B981' },
    { id: '9MOBILE', name: '9mobile', color: '#059669' },
  ];

  const handlePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!user) {
      setIsLoading(true);
      await signInWithGoogle('/wallet/airtime');
      return;
    }

    if (!phone || phone.length < 11) {
      setErrorMsg('Please enter a valid 11-digit Nigerian mobile number.');
      return;
    }

    if (!amount || amount < 50 || amount > 50000) {
      setErrorMsg('Airtime amount must be between ₦50 and ₦50,000.');
      return;
    }

    if (costKobo > balance) {
      setErrorMsg('Insufficient wallet balance. Complete more tasks or cash in.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/wallet/airtime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          network,
          phone: phone.trim(),
          amount,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to complete airtime recharge');
      } else {
        setSuccessMsg(
          `Success! ₦${amount} ${network} airtime recharge has been sent to ${phone}. Ref: ${data.reference}`
        );
        setPhone('');
        await refreshProfile();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Connection error processing airtime');
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
            <h1 className="text-xl sm:text-2xl font-bold text-[#111827]">Buy Instant Airtime</h1>
            <p className="text-xs text-[#6B7280]">
              Direct VTU top-up powered by SmartAPI / Sabuss with instant delivery.
            </p>
          </div>
        </div>

        {/* Balance pill */}
        <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-[#E5E7EB]">
          <span className="text-xs text-[#6B7280]">Available Wallet Balance:</span>
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
          <form onSubmit={handlePurchase} className="space-y-5">
            {/* Network Selector */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-[#111827]">Select Mobile Network</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {networks.map((net) => (
                  <button
                    key={net.id}
                    type="button"
                    onClick={() => setNetwork(net.id as any)}
                    className={`py-3 px-2 rounded-lg border text-xs font-bold transition-all text-center ${
                      network === net.id
                        ? 'border-[#F95700] bg-[#FFF5F0] text-[#F95700] shadow-xs'
                        : 'border-[#E5E7EB] hover:border-[#D1D5DB] text-[#4B5563]'
                    }`}
                  >
                    {net.id}
                  </button>
                ))}
              </div>
            </div>

            <Input
              label="Recipient Phone Number"
              placeholder="08012345678"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />

            <Input
              label="Recharge Amount (₦, Min ₦50)"
              placeholder="50"
              type="number"
              min="50"
              max="50000"
              value={amount.toString()}
              onChange={(e) => setAmount(parseInt(e.target.value, 10) || 0)}
              required
            />

            {/* Quick denomination buttons */}
            <div className="flex flex-wrap gap-2 pt-1">
              {[50, 100, 200, 500, 1000, 2000].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setAmount(amt)}
                  className="px-3 py-1 rounded-md text-xs font-semibold bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#4B5563]"
                >
                  ₦{amt}
                </button>
              ))}
            </div>

            <Button
              type="submit"
              size="lg"
              variant="primary"
              className="w-full text-base mt-2"
              isLoading={isLoading}
              disabled={costKobo > balance || amount < 50}
            >
              Pay {formatNairaPlain(amount)} with Wallet
            </Button>
          </form>
        </Card>
      </div>
    </AppShell>
  );
}
