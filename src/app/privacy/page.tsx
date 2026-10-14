'use client';

import React from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { ArrowLeft } from 'lucide-react';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#F7F7F8] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <Link href="/" className="inline-flex items-center gap-2 text-xs font-bold text-[#F95700] hover:underline">
          <ArrowLeft className="w-4 h-4" /> Back to TemuTasks
        </Link>

        <Card className="p-8 space-y-6">
          <div>
            <h1 className="text-2xl font-extrabold text-[#111827]">Privacy Policy</h1>
            <p className="text-xs text-[#6B7280] mt-1">Last Updated: October 2026</p>
          </div>

          <div className="space-y-4 text-xs text-[#4B5563] leading-relaxed">
            <h2 className="text-sm font-bold text-[#111827]">1. Data We Collect</h2>
            <p>
              We collect identity information supplied by Google OAuth (name, verified email, avatar),
              self-reported Temu usernames/emails required solely for task verification, and financial
              payout details (OPay, PalmPay, Moniepoint account numbers).
            </p>

            <h2 className="text-sm font-bold text-[#111827]">2. How Data is Handled</h2>
            <p>
              Submitted Temu emails and names are accessible solely to the task owner for verification
              and to authorized administrators for dispute resolution. We do not sell your personal data.
            </p>

            <h2 className="text-sm font-bold text-[#111827]">3. Email Communications</h2>
            <p>
              Transactional notifications (payout receipts, task confirmations) are delivered via Sendbyte
              Africa. Recurring new-task marketing alerts are reserved exclusively for opted-in TemuTasks
              Pro members.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
