'use client';

import React, { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { formatNaira, formatNairaPlain } from '@/lib/utils';
import {
  Sparkles,
  Link as LinkIcon,
  Users,
  AlertCircle,
  CreditCard,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import { StatusModal, StatusModalType } from '@/components/ui/StatusModal';

export default function CreateTaskPage() {
  const [taskType, setTaskType] = useState<'existing_user' | 'new_user'>('existing_user');
  const [pricePerParticipant, setPricePerParticipant] = useState<number>(55);
  const [quantity, setQuantity] = useState<number>(10);
  const [invitationLink, setInvitationLink] = useState('');
  const [isPremium, setIsPremium] = useState(false);
  const [title, setTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  const minPrice = taskType === 'existing_user' ? 55 : 250;

  // Handle switching task type and adjusting price if below new threshold
  const handleSelectTaskType = (type: 'existing_user' | 'new_user') => {
    setTaskType(type);
    const newMin = type === 'existing_user' ? 55 : 250;
    if (pricePerParticipant < newMin || (type === 'existing_user' && pricePerParticipant === 250)) {
      setPricePerParticipant(newMin);
    }
  };

  // Calculate proportional split in kobo using the baseline matrix:
  // - Existing User (baseline 55): Participant = 45/55 (~81.82%), Referrer = 10/55 (~18.18%)
  // - New User (baseline 250): Participant = 200/250 (80.00%), Referrer = 50/250 (20.00%)
  const effectivePrice = Math.max(pricePerParticipant || 0, minPrice);
  const priceKobo = BigInt(Math.round(effectivePrice * 100));

  const participantRewardKobo =
    taskType === 'new_user'
      ? (priceKobo * BigInt(200)) / BigInt(250)
      : (priceKobo * BigInt(45)) / BigInt(55);

  const referrerCommissionKobo = priceKobo - participantRewardKobo;

  const baseCost = (quantity || 0) * effectivePrice;
  const platformFee = 200;
  const premiumFee = isPremium ? 200 : 0;
  const totalAmount = baseCost + platformFee + premiumFee;

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!invitationLink.startsWith('https://')) {
      setErrorMsg('Please enter a valid HTTPS Temu invitation link.');
      return;
    }

    if (!quantity || quantity < 1 || quantity > 1000) {
      setErrorMsg('Please specify between 1 and 1,000 participants.');
      return;
    }

    if (!pricePerParticipant || pricePerParticipant < minPrice) {
      setErrorMsg(
        `Price per participant cannot be lower than the minimum threshold of ₦${minPrice} for ${
          taskType === 'new_user' ? 'New Temu Users' : 'Existing Temu Users'
        }.`
      );
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');
    setModalState({
      isOpen: true,
      type: 'loading',
      title: 'Preparing Your Task...',
      message: 'Setting up secure checkout to fund and publish your task...',
    });

    try {
      const res = await fetch('/api/tasks/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskType,
          quantity,
          pricePerParticipant,
          invitationLink: invitationLink.trim(),
          isPremium,
          title:
            title.trim() ||
            `Temu Invitation (${taskType === 'new_user' ? 'New User' : 'Existing User'})`,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const errorText = data.error || 'Failed to initiate task payment';
        setErrorMsg(errorText);
        setModalState({
          isOpen: true,
          type: 'error',
          title: 'Setup Failed',
          message: errorText,
        });
        setIsSubmitting(false);
        return;
      }

      if (data.paymentUrl) {
        window.location.href = data.paymentUrl;
      } else {
        const errorText = 'No checkout URL returned from payment provider.';
        setErrorMsg(errorText);
        setModalState({
          isOpen: true,
          type: 'error',
          title: 'Checkout Error',
          message: errorText,
        });
        setIsSubmitting(false);
      }
    } catch (err: any) {
      const errorText = err.message || 'Payment initiation error';
      setErrorMsg(errorText);
      setModalState({
        isOpen: true,
        type: 'error',
        title: 'Connection Error',
        message: errorText,
      });
      setIsSubmitting(false);
    }
  };

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[#111827]">Create a Temu Task</h1>
          <p className="text-sm text-[#6B7280] mt-1">
            Configure your invitation link, participant count, and offer higher rewards to attract
            faster completions.
          </p>
        </div>

        {errorMsg && (
          <div className="p-4 bg-[#FEF2F2] border border-[#FECACA] rounded-xl text-xs text-[#DC2626] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleCheckout} className="space-y-6">
          {/* Step 1: Task Type */}
          <Card className="space-y-4">
            <label className="block text-xs font-bold text-[#111827] uppercase tracking-wider">
              Step 1: Choose Participant Type
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div
                onClick={() => handleSelectTaskType('existing_user')}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  taskType === 'existing_user'
                    ? 'border-[#F95700] bg-[#FFF5F0]/50 shadow-xs'
                    : 'border-[#E5E7EB] hover:border-[#D1D5DB]'
                }`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-sm text-[#111827]">Existing Temu User</span>
                  <Badge variant={taskType === 'existing_user' ? 'primary' : 'secondary'}>
                    Min ₦55 / person
                  </Badge>
                </div>
                <p className="text-xs text-[#6B7280]">
                  Participants who already have the Temu app installed.
                </p>
              </div>

              <div
                onClick={() => handleSelectTaskType('new_user')}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  taskType === 'new_user'
                    ? 'border-[#F95700] bg-[#FFF5F0]/50 shadow-xs'
                    : 'border-[#E5E7EB] hover:border-[#D1D5DB]'
                }`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-sm text-[#111827]">New Temu User</span>
                  <Badge variant={taskType === 'new_user' ? 'premium' : 'secondary'}>
                    Min ₦250 / person
                  </Badge>
                </div>
                <p className="text-xs text-[#6B7280]">
                  Participants downloading or registering Temu for the first time.
                </p>
              </div>
            </div>
          </Card>

          {/* Step 2: Custom Price Per Participant & Split Matrix */}
          <Card className="space-y-4">
            <label className="block text-xs font-bold text-[#111827] uppercase tracking-wider">
              Step 2: Price Per Participant &amp; Reward Split
            </label>

            <Input
              label={`Price Per Participant (₦, Minimum Threshold: ₦${minPrice})`}
              type="number"
              min={minPrice}
              step="1"
              value={pricePerParticipant ? pricePerParticipant.toString() : ''}
              onChange={(e) => setPricePerParticipant(parseInt(e.target.value, 10) || 0)}
              hint={`You can increase the price above ₦${minPrice} to incentivize participants to complete your task faster.`}
              required
            />

            {pricePerParticipant < minPrice && (
              <p className="text-xs text-[#EF4444] font-semibold">
                Minimum price threshold for this task type is ₦{minPrice}.
              </p>
            )}

            {/* Live Proportional Matrix Preview */}
            <div className="p-4 rounded-xl bg-[#FFF5F0] border border-[#F95700]/20 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-[#111827]">
                <span className="flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-[#F95700]" />
                  Proportional Reward &amp; Referral Split (per participant)
                </span>
                <span className="text-[#F95700]">{formatNairaPlain(effectivePrice)}</span>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1 text-xs">
                <div className="bg-white p-2.5 rounded-lg border border-[#E5E7EB]">
                  <span className="text-[#6B7280] block text-[11px]">
                    Participant Reward ({taskType === 'new_user' ? '80%' : '81.82%'})
                  </span>
                  <span className="text-sm font-extrabold text-[#10B981]">
                    {formatNaira(participantRewardKobo)}
                  </span>
                </div>

                <div className="bg-white p-2.5 rounded-lg border border-[#E5E7EB]">
                  <span className="text-[#6B7280] block text-[11px]">
                    Referrer Commission ({taskType === 'new_user' ? '20%' : '18.18%'})
                  </span>
                  <span className="text-sm font-extrabold text-[#111827]">
                    {formatNaira(referrerCommissionKobo)}
                  </span>
                </div>
              </div>
            </div>
          </Card>

          {/* Step 3: Quantity & Link */}
          <Card className="space-y-4">
            <label className="block text-xs font-bold text-[#111827] uppercase tracking-wider">
              Step 3: Task Details &amp; Link
            </label>

            <Input
              label="Task Title / Note"
              placeholder="e.g. Free Gifts Invite Link or Hat Trick"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />

            <Input
              label="Temu Invitation Link (HTTPS)"
              placeholder="https://temu.to/m/... or https://temu.com/s/..."
              value={invitationLink}
              onChange={(e) => setInvitationLink(e.target.value)}
              leftIcon={<LinkIcon className="w-4 h-4" />}
              required
            />

            <Input
              label="Participant Quantity (1 to 1,000)"
              type="number"
              min="1"
              max="1000"
              value={quantity.toString()}
              onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 0)}
              leftIcon={<Users className="w-4 h-4" />}
              required
            />
          </Card>

          {/* Step 4: Premium Option */}
          <Card className="space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-sm text-[#111827]">
                  <Sparkles className="w-4 h-4 text-[#F59E0B]" />
                  Promote as Premium Task (+₦200)
                </div>
                <p className="text-xs text-[#6B7280]">
                  Receive an Urgent badge and prioritized top placement in the Available Tasks
                  marketplace for faster completions.
                </p>
              </div>

              <input
                type="checkbox"
                id="isPremium"
                checked={isPremium}
                onChange={(e) => setIsPremium(e.target.checked)}
                className="w-5 h-5 accent-[#F95700] rounded cursor-pointer mt-1"
              />
            </div>
          </Card>

          {/* Step 5: Price Summary & Novac Checkout */}
          <Card className="bg-[#111827] text-white border-none space-y-5 p-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-bold text-white">Transparent Price Summary</h3>
              <span className="text-[11px] bg-[#10B981]/20 text-[#10B981] px-2.5 py-1 rounded-full font-semibold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> Verified Checkout
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-[#9CA3AF]">
                <span>
                  Base Task Cost ({quantity} × ₦{effectivePrice}):
                </span>
                <span className="font-semibold text-white">{formatNairaPlain(baseCost)}</span>
              </div>

              <div className="flex justify-between text-[#9CA3AF]">
                <span>Standard Platform Fee:</span>
                <span className="font-semibold text-white">{formatNairaPlain(platformFee)}</span>
              </div>

              {isPremium && (
                <div className="flex justify-between text-[#F59E0B]">
                  <span>Premium Promotion:</span>
                  <span className="font-semibold">{formatNairaPlain(premiumFee)}</span>
                </div>
              )}

              <div className="border-t border-white/10 pt-3 flex justify-between items-center text-sm font-extrabold text-white">
                <span>Total Amount to Pay:</span>
                <span className="text-2xl text-[#F95700]">{formatNairaPlain(totalAmount)}</span>
              </div>
            </div>

            <Button
              type="submit"
              size="lg"
              variant="primary"
              className="w-full mt-2 text-base bg-[#F95700] hover:bg-[#E04E00]"
              isLoading={isSubmitting}
              disabled={pricePerParticipant < minPrice || quantity < 1}
              loadingText="Redirecting to Novac Checkout..."
              leftIcon={<CreditCard className="w-5 h-5" />}
            >
              Proceed to Novac Checkout ({formatNairaPlain(totalAmount)})
            </Button>
          </Card>
        </form>

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
