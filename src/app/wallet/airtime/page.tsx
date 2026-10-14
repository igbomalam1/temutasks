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
import { StatusModal, StatusModalType } from '@/components/ui/StatusModal';
import {
  TransactionReceiptModal,
  TransactionReceiptData,
} from '@/components/wallet/TransactionReceiptModal';

export default function AirtimePage() {
  const { user, wallet, refreshProfile, signInWithGoogle } = useAuth();

  const [network, setNetwork] = useState<'MTN' | 'AIRTEL' | 'GLO' | '9MOBILE'>('MTN');
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState<number>(50);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Receipt Preview state
  const [receiptData, setReceiptData] = useState<TransactionReceiptData | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);

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

  const PLATFORM_FEE = 10;
  const balance = BigInt(wallet?.balance_kobo || 0);
  const totalChargeNaira = (amount || 0) + PLATFORM_FEE;
  const costKobo = BigInt(totalChargeNaira) * BigInt(100);

  const networks = [
    { id: 'MTN', name: 'MTN Nigeria', color: '#FBBF24' },
    { id: 'AIRTEL', name: 'Airtel Nigeria', color: '#EF4444' },
    { id: 'GLO', name: 'Glo Mobile', color: '#10B981' },
    { id: '9MOBILE', name: '9mobile', color: '#059669' },
  ];

  const detectNetworkFromPhone = (num: string): 'MTN' | 'AIRTEL' | 'GLO' | '9MOBILE' | null => {
    let clean = num.replace(/[^0-9]/g, '');
    if (clean.startsWith('234') && clean.length >= 7) {
      clean = '0' + clean.slice(3);
    }
    if (clean.length < 4) return null;
    const prefix = clean.slice(0, 4);
    if (['0702', '0703', '0704', '0706', '0803', '0806', '0810', '0813', '0814', '0816', '0903', '0906', '0913', '0916'].includes(prefix)) return 'MTN';
    if (['0802', '0808', '0708', '0812', '0701', '0902', '0901', '0904', '0907', '0912'].includes(prefix)) return 'AIRTEL';
    if (['0805', '0807', '0705', '0815', '0811', '0905', '0915'].includes(prefix)) return 'GLO';
    if (['0809', '0818', '0817', '0909', '0908'].includes(prefix)) return '9MOBILE';
    return null;
  };

  const detectedNetwork = detectNetworkFromPhone(phone);

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
      setErrorMsg(`Insufficient wallet balance. You need ₦${totalChargeNaira} (₦${amount} airtime + ₦${PLATFORM_FEE} platform fee).`);
      return;
    }

    setIsLoading(true);
    setModalState({
      isOpen: true,
      type: 'loading',
      title: 'Processing Airtime Recharge...',
      message: `Connecting to ${network} and recharging ₦${amount} to ${phone.trim()} (Total charged: ₦${totalChargeNaira}). Please wait a moment...`,
    });

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
        const errorText = data.error || 'Failed to complete airtime recharge';
        setErrorMsg(errorText);
        setModalState({
          isOpen: true,
          type: 'error',
          title: 'Recharge Failed',
          message: errorText,
        });
      } else {
        const successText = `Success! ₦${amount} ${network} airtime recharge has been sent to ${phone}. Ref: ${data.reference}`;
        setSuccessMsg(successText);

        const createdReceipt: TransactionReceiptData = {
          reference: data.reference,
          description: `${network} airtime recharge to ${phone.trim()} (₦${amount} + ₦${PLATFORM_FEE} platform fee = ₦${totalChargeNaira})`,
          transactionType: 'airtime_recharge',
          direction: 'debit',
          amountKobo: BigInt(totalChargeNaira) * BigInt(100),
          date: new Date().toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' }),
          status: 'Completed',
        };
        setReceiptData(createdReceipt);

        setModalState({
          isOpen: true,
          type: 'success',
          title: 'Airtime Recharged Successfully! 📱',
          message: `₦${amount} ${network} airtime has been delivered to ${phone}. Total charged: ₦${totalChargeNaira} (including ₦${PLATFORM_FEE} platform fee). Ref: ${data.reference}`,
        });
        await refreshProfile();
      }
    } catch (err: any) {
      const errorText = err.message || 'Connection error processing airtime';
      setErrorMsg(errorText);
      setModalState({
        isOpen: true,
        type: 'error',
        title: 'Connection Error',
        message: errorText,
      });
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
              Direct VTU top-up powered by SmartAPI with instant delivery across all Nigerian networks.
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

            <div>
              <Input
                label="Recipient Phone Number"
                placeholder="08012345678"
                type="tel"
                value={phone}
                onChange={(e) => {
                  const val = e.target.value;
                  setPhone(val);
                  const detected = detectNetworkFromPhone(val);
                  if (detected && detected !== network) {
                    // auto-suggest or let user know
                  }
                }}
                required
              />

              {detectedNetwork && detectedNetwork !== network && phone.length >= 4 && (
                <div className="mt-1.5 p-2 bg-[#FFFBEB] border border-[#FDE68A] rounded-lg text-[11px] text-[#92400E] flex items-center justify-between">
                  <span>
                    Prefix looks like <strong>{detectedNetwork}</strong>. Selected is <strong>{network}</strong>.
                  </span>
                  <button
                    type="button"
                    onClick={() => setNetwork(detectedNetwork)}
                    className="ml-2 font-bold text-[#F95700] underline shrink-0 hover:opacity-80"
                  >
                    Switch to {detectedNetwork}
                  </button>
                </div>
              )}
            </div>

            <Input
              label="Recharge Face Value (₦, Min ₦50)"
              placeholder="50"
              type="number"
              min="50"
              max="50000"
              value={amount.toString()}
              onChange={(e) => setAmount(parseInt(e.target.value, 10) || 0)}
              required
            />

            {/* Quick denomination buttons */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[11px] font-semibold text-[#6B7280]">Quick Amounts:</span>
              <div className="flex flex-wrap gap-2">
                {[50, 100, 200, 500, 1000, 2000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setAmount(amt)}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                      amount === amt
                        ? 'bg-[#F95700] text-white shadow-xs'
                        : 'bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#4B5563]'
                    }`}
                  >
                    ₦{amt}
                  </button>
                ))}
              </div>
            </div>

            {/* Transparent fee breakdown */}
            <div className="p-3.5 bg-[#F9FAFB] rounded-xl border border-[#E5E7EB] text-xs space-y-2">
              <div className="flex justify-between text-[#6B7280]">
                <span>Airtime Face Value:</span>
                <span className="font-semibold text-[#111827]">₦{(amount || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-[#6B7280]">
                <span>Platform Service Fee:</span>
                <span className="font-semibold text-[#F95700]">+ ₦{PLATFORM_FEE}</span>
              </div>
              <div className="border-t border-[#E5E7EB] pt-2 flex justify-between font-bold text-sm text-[#111827]">
                <span>Total Amount Charged:</span>
                <span className="text-[#F95700]">₦{totalChargeNaira.toLocaleString()}</span>
              </div>
            </div>

            <Button
              type="submit"
              size="lg"
              variant="primary"
              className="w-full text-base mt-2"
              isLoading={isLoading}
              disabled={costKobo > balance || (amount || 0) < 50}
            >
              Pay ₦{totalChargeNaira.toLocaleString()} with Wallet
            </Button>
          </form>
        </Card>

        {/* Status Modal Popup */}
        <StatusModal
          isOpen={modalState.isOpen}
          type={modalState.type}
          title={modalState.title}
          message={modalState.message}
          actionText={modalState.type === 'success' ? 'Download Receipt' : 'Close'}
          onAction={() => {
            if (modalState.type === 'success') {
              setModalState((prev) => ({ ...prev, isOpen: false }));
              setIsReceiptOpen(true);
            } else {
              setModalState((prev) => ({ ...prev, isOpen: false }));
            }
          }}
          secondaryText={modalState.type === 'success' ? 'Recharge Another' : undefined}
          onSecondary={
            modalState.type === 'success'
              ? () => {
                  setModalState((prev) => ({ ...prev, isOpen: false }));
                  setPhone('');
                }
              : undefined
          }
          onClose={() => setModalState((prev) => ({ ...prev, isOpen: false }))}
        />

        {/* Beautiful Digital Receipt Modal */}
        <TransactionReceiptModal
          isOpen={isReceiptOpen}
          onClose={() => {
            setIsReceiptOpen(false);
            setPhone('');
          }}
          tx={receiptData}
          onRechargeAnother={() => {
            setIsReceiptOpen(false);
            setPhone('');
          }}
        />
      </div>
    </AppShell>
  );
}
