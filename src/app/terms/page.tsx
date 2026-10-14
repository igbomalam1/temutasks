'use client';

import React from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ArrowLeft } from 'lucide-react';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#F7F7F8] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <Link href="/" className="inline-flex items-center gap-2 text-xs font-bold text-[#F95700] hover:underline">
          <ArrowLeft className="w-4 h-4" /> Back to TemuTasks
        </Link>

        <Card className="p-8 space-y-6">
          <div>
            <h1 className="text-2xl font-extrabold text-[#111827]">Terms of Service</h1>
            <p className="text-xs text-[#6B7280] mt-1">Last Updated: October 2026</p>
          </div>

          <div className="space-y-4 text-xs text-[#4B5563] leading-relaxed">
            <h2 className="text-sm font-bold text-[#111827]">1. Introduction & Independence</h2>
            <p>
              TemuTasks is an independent digital community marketplace connecting users distributing
              invitation referral links with participants willing to perform tasks. TemuTasks is not
              owned, affiliated with, or officially endorsed by Temu or PDD Holdings.
            </p>

            <h2 className="text-sm font-bold text-[#111827]">2. Task Creation & Pricing</h2>
            <p>
              Task creators fund their tasks in advance. Existing-user slots are priced at ₦55 each,
              and new-user slots at ₦250 each. A standard platform creation fee of ₦200 applies to every task.
              Optional premium promotion (₦200) grants urgent badge visibility. Payments are processed
              securely via Novac.
            </p>

            <h2 className="text-sm font-bold text-[#111827]">3. Task Submissions & Approval</h2>
            <p>
              Participants submit their self-reported Temu username and email. Task creators review
              submissions. Submissions not resolved by 11:00 PM (Africa/Lagos) undergo automated nightly
              platform clearance under our review policy.
            </p>

            <h2 className="text-sm font-bold text-[#111827]">4. Permanent Referral Commissions</h2>
            <p>
              Referrers receive ₦10 per existing-user task and ₦50 per new-user task completed by
              their directly referred participants. Self-referrals and duplicate accounts are strictly
              prohibited.
            </p>

            <h2 className="text-sm font-bold text-[#111827]">5. Wallets, Airtime & Withdrawals</h2>
            <p>
              All balances are maintained on an append-only financial ledger. Airtime top-ups are fulfilled
              via SmartAPI. Withdrawals are processed to OPay, PalmPay, and Moniepoint with a ₦1,000 minimum.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
