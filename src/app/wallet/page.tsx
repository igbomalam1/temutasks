'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { formatNaira } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import {
  Wallet,
  Smartphone,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  Filter,
  CheckCircle2,
  Clock,
  Sparkles,
  Receipt,
} from 'lucide-react';
import {
  TransactionReceiptModal,
  TransactionReceiptData,
} from '@/components/wallet/TransactionReceiptModal';

export default function WalletPage() {
  const { user, wallet, profile } = useAuth();
  const [ledger, setLedger] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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

    const loadLedger = async () => {
      setIsLoading(true);
      const { data } = await supabase
        .from('temutask_wallet_ledger')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (data) setLedger(data);
      setIsLoading(false);
    };

    loadLedger();
  }, [user]);

  const balance = BigInt(wallet?.balance_kobo || 0);
  const earned = BigInt(wallet?.total_earned_kobo || 0);
  const withdrawn = BigInt(wallet?.total_withdrawn_kobo || 0);
  const airtime = BigInt(wallet?.total_airtime_kobo || 0);
  const refEarned = BigInt(wallet?.total_referral_earned_kobo || 0);

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-[#E5E7EB]">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#111827]">Wallet & Ledger</h1>
            <p className="text-xs sm:text-sm text-[#6B7280] mt-1">
              Your real-time financial balance, withdrawable funds, and immutable audit trail.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Link href="/wallet/airtime">
              <Button size="sm" variant="primary" leftIcon={<Smartphone className="w-4 h-4" />}>
                Buy Airtime
              </Button>
            </Link>
            <Link href="/wallet/cashout">
              <Button size="sm" variant="outline" leftIcon={<ArrowUpRight className="w-4 h-4" />}>
                Cash Out
              </Button>
            </Link>
          </div>
        </div>

        {/* Balance Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Card className="bg-gradient-to-br from-[#111827] to-[#1F2937] text-white border-none space-y-2 p-6">
            <div className="flex items-center justify-between text-xs text-[#9CA3AF]">
              <span>AVAILABLE BALANCE</span>
              <Wallet className="w-4 h-4 text-[#F95700]" />
            </div>
            <div className="text-3xl font-extrabold text-white">{formatNaira(balance)}</div>
            <p className="text-xs text-[#9CA3AF]">Ready for instant airtime or payout requests</p>
          </Card>

          <Card className="space-y-2 p-6">
            <div className="flex items-center justify-between text-xs text-[#6B7280]">
              <span>TOTAL TASK EARNINGS</span>
              <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
            </div>
            <div className="text-2xl font-extrabold text-[#111827]">{formatNaira(earned)}</div>
            <p className="text-xs text-[#6B7280]">From approved Temu participant tasks</p>
          </Card>

          <Card className="space-y-2 p-6">
            <div className="flex items-center justify-between text-xs text-[#6B7280]">
              <span>REFERRAL COMMISSIONS</span>
              <Sparkles className="w-4 h-4 text-[#F59E0B]" />
            </div>
            <div className="text-2xl font-extrabold text-[#F95700]">{formatNaira(refEarned)}</div>
            <p className="text-xs text-[#6B7280]">Lifetime commissions from your invitees</p>
          </Card>
        </div>

        {/* Ledger Transactions Table */}
        <Card className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-4">
            <div>
              <h2 className="text-base font-bold text-[#111827]">Financial Audit Ledger</h2>
              <p className="text-xs text-[#6B7280]">
                Click any transaction row to view, download, or share its official receipt.
              </p>
            </div>
            <span className="text-xs text-[#9CA3AF]">Showing last 50 transactions</span>
          </div>

          {isLoading ? (
            <div className="text-center py-12 text-[#9CA3AF] text-sm">Loading ledger...</div>
          ) : ledger.length === 0 ? (
            <div className="text-center py-12 text-[#9CA3AF] text-sm">
              No transactions recorded in your ledger yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F7F7F8] text-[#6B7280]">
                  <tr>
                    <th className="p-3 rounded-l-md">Date & Time</th>
                    <th className="p-3">Description</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Reference</th>
                    <th className="p-3 text-right">Amount</th>
                    <th className="p-3 text-center rounded-r-md">Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E7EB]">
                  {ledger.map((tx) => (
                    <tr
                      key={tx.id}
                      onClick={() => openReceiptForTx(tx)}
                      className="hover:bg-[#FFF5F0]/60 active:bg-[#FFEAE0] cursor-pointer transition-colors group"
                    >
                      <td className="p-3 text-[#6B7280] whitespace-nowrap">
                        {new Date(tx.created_at).toLocaleString('en-NG', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="p-3 font-semibold text-[#111827] group-hover:text-[#F95700] transition-colors">
                        {tx.description}
                      </td>
                      <td className="p-3">
                        <Badge variant={tx.direction === 'credit' ? 'success' : 'secondary'}>
                          {tx.transaction_type.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="p-3 text-[#9CA3AF] font-mono">{tx.reference}</td>
                      <td
                        className={`p-3 text-right font-bold whitespace-nowrap ${
                          tx.direction === 'credit' ? 'text-[#10B981]' : 'text-[#EF4444]'
                        }`}
                      >
                        {tx.direction === 'credit' ? '+' : '-'}
                        {formatNaira(BigInt(tx.amount_kobo))}
                      </td>
                      <td className="p-3 text-center whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold text-[#F95700] bg-white border border-[#FDBA74] shadow-2xs group-hover:bg-[#F95700] group-hover:text-white transition-all">
                          <Receipt className="w-3 h-3" />
                          Receipt
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
