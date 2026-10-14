'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/AuthContext';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Logo } from '@/components/ui/Logo';
import { TestimonyCollage } from '@/components/landing/TestimonyCollage';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Zap,
  Smartphone,
  CheckCircle2,
  TrendingUp,
  Sparkles,
} from 'lucide-react';

export default function LandingPage() {
  const { user, signInWithGoogle, isLoading } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (user && !isLoading) {
      window.location.replace('/dashboard');
    }
  }, [user, isLoading]);

  return (
    <div className="min-h-screen bg-[#F7F7F8] flex flex-col">
      {/* Header with Navbrand Logo */}
      <header className="border-b border-[#E5E7EB] bg-white sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/">
            <Logo size="md" />
          </Link>

          <div className="flex items-center gap-3">
            {user ? (
              <Link href="/dashboard">
                <Button size="sm">Go to Dashboard</Button>
              </Link>
            ) : (
              <Button
                size="sm"
                variant="primary"
                onClick={() => signInWithGoogle()}
                isLoading={isLoading}
              >
                Sign in
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-16 md:py-20 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto text-center">
        <h1 className="text-4xl sm:text-6xl font-extrabold text-[#111827] tracking-tight mb-6 leading-tight">
          Get real people to accept your{' '}
          <span className="text-[#F95700] underline decoration-[#F95700]/30">Temu invites</span>,{' '}
          earn cash doing tasks.
        </h1>

        <p className="text-lg sm:text-xl text-[#6B7280] max-w-2xl mx-auto mb-10 leading-relaxed">
          Need participants to win your Temu games? Post a paid task in seconds. Want to make money?
          Complete easy invitation tasks, buy cheap airtime, and cash out straight to OPay,
          PalmPay, or Moniepoint.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-14">
          <Button
            size="lg"
            variant="primary"
            className="w-full sm:w-auto text-base"
            onClick={() => (user ? (window.location.href = '/dashboard') : signInWithGoogle())}
            rightIcon={<ArrowRight className="w-5 h-5" />}
          >
            {user ? 'Open Dashboard' : 'Get started'}
          </Button>

          <Link href="/tasks" className="w-full sm:w-auto">
            <Button size="lg" variant="outline" className="w-full sm:w-auto text-base">
              Browse Available Tasks
            </Button>
          </Link>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          <Card className="hover:border-[#F95700]/40 transition-colors">
            <div className="w-10 h-10 rounded-lg bg-[#FFF5F0] flex items-center justify-center text-[#F95700] mb-4">
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-[#111827] mb-2">Instant Task Distribution</h3>
            <p className="text-sm text-[#6B7280]">
              Create tasks for existing or new Temu users with automated capacity tracking and
              verified reviews.
            </p>
          </Card>

          <Card className="hover:border-[#F95700]/40 transition-colors">
            <div className="w-10 h-10 rounded-lg bg-[#ECFDF5] flex items-center justify-center text-[#10B981] mb-4">
              <TrendingUp className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-[#111827] mb-2">Guaranteed Rewards</h3>
            <p className="text-sm text-[#6B7280]">
              Earn ₦45 for existing user tasks and ₦200 for new user tasks. Fast review by owners
              and automatic nightly admin clearance.
            </p>
          </Card>

          <Card className="hover:border-[#F95700]/40 transition-colors">
            <div className="w-10 h-10 rounded-lg bg-[#EFF6FF] flex items-center justify-center text-[#0090FE] mb-4">
              <Smartphone className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-[#111827] mb-2">Airtime & Fast Cash Out</h3>
            <p className="text-sm text-[#6B7280]">
              Use wallet balances to top up MTN, Airtel, Glo, and 9mobile in seconds or withdraw to
              OPay, PalmPay, and Moniepoint.
            </p>
          </Card>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-14 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <Badge variant="primary" className="mb-2 px-3 py-1 text-xs">
            Simple 4-Step Process
          </Badge>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#111827]">
            How TemuTasks Works
          </h2>
          <p className="text-sm text-[#6B7280] max-w-lg mx-auto mt-1.5">
            Follow four simple steps to complete tasks and earn real cash credited directly to your wallet.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
          {/* Step 1 */}
          <div className="bg-white rounded-xl p-5 border border-[#E5E7EB] shadow-xs flex flex-col justify-between hover:border-[#F95700]/50 transition-all">
            <div>
              <div className="w-9 h-9 rounded-lg bg-[#FFF5F0] text-[#F95700] font-black flex items-center justify-center text-base mb-3">
                1
              </div>
              <h3 className="text-sm font-bold text-[#111827] mb-1">
                Download &amp; Register
              </h3>
              <p className="text-xs text-[#6B7280] leading-relaxed">
                Download the Temu app and register your account, or prepare your existing Temu account.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-[#F3F4F6] text-[11px] font-semibold text-[#F95700]">
              Android &amp; iOS compatible
            </div>
          </div>

          {/* Step 2 */}
          <div className="bg-white rounded-xl p-5 border border-[#E5E7EB] shadow-xs flex flex-col justify-between hover:border-[#F95700]/50 transition-all">
            <div>
              <div className="w-9 h-9 rounded-lg bg-[#EFF6FF] text-[#0090FE] font-black flex items-center justify-center text-base mb-3">
                2
              </div>
              <h3 className="text-sm font-bold text-[#111827] mb-1">
                Join Task &amp; Click Link
              </h3>
              <p className="text-xs text-[#6B7280] leading-relaxed">
                Browse open tasks on TemuTasks, click the creator&apos;s link, and open it in the Temu app.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-[#F3F4F6] text-[11px] font-semibold text-[#0090FE]">
              Real-time available slots
            </div>
          </div>

          {/* Step 3 */}
          <div className="bg-white rounded-xl p-5 border border-[#E5E7EB] shadow-xs flex flex-col justify-between hover:border-[#F95700]/50 transition-all">
            <div>
              <div className="w-9 h-9 rounded-lg bg-[#FEF3C7] text-[#D97706] font-black flex items-center justify-center text-base mb-3">
                3
              </div>
              <h3 className="text-sm font-bold text-[#111827] mb-1">
                Complete &amp; Submit Proof
              </h3>
              <p className="text-xs text-[#6B7280] leading-relaxed">
                Accept the invitation on Temu, then return to TemuTasks and submit your Temu username / email.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-[#F3F4F6] text-[11px] font-semibold text-[#D97706]">
              Instant submission tracking
            </div>
          </div>

          {/* Step 4 */}
          <div className="bg-white rounded-xl p-5 border border-[#E5E7EB] shadow-xs flex flex-col justify-between hover:border-[#F95700]/50 transition-all">
            <div>
              <div className="w-9 h-9 rounded-lg bg-[#ECFDF5] text-[#10B981] font-black flex items-center justify-center text-base mb-3">
                4
              </div>
              <h3 className="text-sm font-bold text-[#111827] mb-1">
                Get Verified &amp; Get Paid
              </h3>
              <p className="text-xs text-[#6B7280] leading-relaxed">
                Once verified by the task owner, your wallet is credited! Cash out to bank or buy instant airtime.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-[#F3F4F6] text-[11px] font-semibold text-[#10B981]">
              Instant OPay, PalmPay &amp; VTU
            </div>
          </div>
        </div>

        {/* Pro Upsell Callout Banner */}
        <div className="bg-gradient-to-r from-[#111827] to-[#1E293B] rounded-2xl p-6 sm:p-7 text-white shadow-md border border-[#334155] flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-1.5 max-w-xl">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#F95700]/20 border border-[#F95700]/40 text-[#F95700] text-[11px] font-bold uppercase tracking-wider">
              <Sparkles className="w-3 h-3" />
              Pro Earner Advantage
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-white">
              Want to submit many tasks on a single task?
            </h3>
            <p className="text-xs sm:text-sm text-[#94A3B8] leading-relaxed">
              Standard users can only submit once per task. Upgrade to <strong>TemuTasks Pro</strong> for just ₦200 to submit multiple times on the same task and earn for your total submissions!
            </p>
          </div>

          <div className="shrink-0 flex items-center">
            <Link href="/pro" className="w-full sm:w-auto">
              <Button size="lg" variant="primary" className="w-full sm:w-auto text-sm font-bold shadow-md">
                Upgrade to Pro (₦200) →
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Photo Collage of Testimonies and Proof */}
      <TestimonyCollage />

      {/* Pricing / Commission Banner */}
      <section className="bg-white border-y border-[#E5E7EB] py-14 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#111827]">
              Transparent Pricing & Lifetime Commissions
            </h2>
            <p className="text-sm text-[#6B7280] mt-2">
              Every kobo is tracked on an immutable financial ledger with zero hidden fees.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="border border-[#E5E7EB] rounded-xl p-6 bg-[#F7F7F8]">
              <div className="flex justify-between items-center mb-4">
                <span className="font-bold text-base text-[#111827]">Existing Temu User Task</span>
                <Badge variant="primary">₦100 / slot</Badge>
              </div>
              <ul className="space-y-2.5 text-sm text-[#4B5563]">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
                  <span>Participant reward: <strong>₦80.00</strong></span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
                  <span>Referrer lifetime commission: <strong>₦20.00</strong></span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
                  <span>Standard platform task fee: ₦200</span>
                </li>
              </ul>
            </div>

            <div className="border border-[#E5E7EB] rounded-xl p-6 bg-[#F7F7F8]">
              <div className="flex justify-between items-center mb-4">
                <span className="font-bold text-base text-[#111827]">New Temu User Task</span>
                <Badge variant="premium">₦500 / slot</Badge>
              </div>
              <ul className="space-y-2.5 text-sm text-[#4B5563]">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
                  <span>Participant reward: <strong>₦400.00</strong></span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
                  <span>Referrer lifetime commission: <strong>₦100.00</strong></span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
                  <span>Optional premium promotion: ₦200 (Urgent badge)</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Pro Pass Highlight Banner */}
          <div className="mt-8 border-2 border-[#F95700] rounded-xl p-6 bg-[#FFF5F0] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base text-[#111827]">
                  TemuTasks Pro Membership
                </span>
                <Badge variant="premium">₦200 / 14 Days</Badge>
              </div>
              <p className="text-xs sm:text-sm text-[#4B5563]">
                <strong>Pro user can submit multiple tasks at once and earn for all!</strong> Plus
                receive instant recurring email alerts whenever new tasks are published.
              </p>
            </div>
            <Link href="/pro" className="shrink-0">
              <Button size="md" variant="primary">
                Upgrade to Pro
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer with Footbrand Logo */}
      <footer className="bg-white border-t border-[#E5E7EB] py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <Logo size="sm" />
            <span className="text-xs text-[#9CA3AF]">
              © {new Date().getFullYear()} TemuTasks Nigeria. Independent task & reward platform.
            </span>
          </div>

          <div className="flex items-center gap-6 text-xs text-[#6B7280]">
            <Link href="/terms" className="hover:text-[#111827]">
              Terms of Service
            </Link>
            <Link href="/privacy" className="hover:text-[#111827]">
              Privacy Policy
            </Link>
            <Link href="/rules" className="hover:text-[#111827]">
              Task Rules & Disputes
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
