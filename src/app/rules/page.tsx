'use client';

import React from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { ArrowLeft, Clock, ShieldCheck, AlertCircle } from 'lucide-react';

export default function RulesPage() {
  return (
    <div className="min-h-screen bg-[#F7F7F8] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <Link href="/" className="inline-flex items-center gap-2 text-xs font-bold text-[#F95700] hover:underline">
          <ArrowLeft className="w-4 h-4" /> Back to TemuTasks
        </Link>

        <Card className="p-8 space-y-6">
          <div>
            <h1 className="text-2xl font-extrabold text-[#111827]">Task Rules & Dispute Resolution</h1>
            <p className="text-xs text-[#6B7280] mt-1">Platform Guidelines & Fair Play Standards</p>
          </div>

          <div className="space-y-5 text-xs text-[#4B5563] leading-relaxed">
            <div className="p-4 bg-[#FFF5F0] rounded-xl border border-[#F95700]/20 space-y-1">
              <div className="flex items-center gap-2 font-bold text-[#F95700]">
                <Clock className="w-4 h-4" /> Daily 10:00 AM Admin Clearance Policy
              </div>
              <p>
                “Pending submissions are reviewed by the task owner. Our admin team reviews unresolved
                submissions daily at 10:00 AM Africa/Lagos. This gives task creators overnight coverage
                to verify participants before unreviewed eligible submissions are cleared automatically.”
              </p>
            </div>

            <h2 className="text-sm font-bold text-[#111827]">1. Participant Eligibility & Submissions</h2>
            <p>
              Participants must complete the required Temu invitation steps through the provided link
              before submitting their Temu username and email. Duplicate claims for the same task are
              blocked by database constraints.
            </p>

            <h2 className="text-sm font-bold text-[#111827]">2. Owner Review & Declines</h2>
            <p>
              Task owners have the right to decline submissions if the user failed to complete the
              invitation. A decline requires a documented explanation and is transferred to the
              administrator dispute queue. False declines designed to withhold valid rewards result
              in account suspension.
            </p>

            <h2 className="text-sm font-bold text-[#111827]">3. Financial Guarantees</h2>
            <p>
              Every reward (₦45 for existing users, ₦200 for new users) and referral commission (₦10 or
              ₦50) is funded prior to task publication and held safely until approval or nightly clearance.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
