'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { formatNaira, formatNairaPlain, DEFAULT_TASK_INSTRUCTIONS } from '@/lib/utils';
import {
  Sparkles,
  Link as LinkIcon,
  Users,
  AlertCircle,
  AlertTriangle,
  CreditCard,
  Wallet,
  ShieldCheck,
  TrendingUp,
  Layers,
  CheckCircle2,
  HelpCircle,
  RotateCcw,
} from 'lucide-react';
import { StatusModal, StatusModalType } from '@/components/ui/StatusModal';

type TaskType = 'existing_user' | 'new_user' | 'combined';

export default function CreateTaskPage() {
  const { user, wallet, refreshProfile, signInWithGoogle } = useAuth();

  // Task configuration
  const [taskType, setTaskType] = useState<TaskType>('existing_user');
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState(DEFAULT_TASK_INSTRUCTIONS);
  const [isPremium, setIsPremium] = useState(false);

  // Single task states
  const [quantity, setQuantity] = useState<number>(10);
  const [pricePerParticipant, setPricePerParticipant] = useState<number>(100);
  const [invitationLink, setInvitationLink] = useState('');

  // Combined task states
  const [existingQuantity, setExistingQuantity] = useState<number>(10);
  const [existingPrice, setExistingPrice] = useState<number>(100);
  const [existingLink, setExistingLink] = useState('');
  const [newQuantity, setNewQuantity] = useState<number>(5);
  const [newPrice, setNewPrice] = useState<number>(500);
  const [newLink, setNewLink] = useState('');
  const [useSeparateNewLink, setUseSeparateNewLink] = useState(false);

  // Payment method selection ('wallet' | 'novac')
  const [paymentMethod, setPaymentMethod] = useState<'wallet' | 'novac'>('wallet');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    type: StatusModalType;
    title: string;
    message?: string;
    actionText?: string;
    onAction?: () => void;
  }>({
    isOpen: false,
    type: null,
    title: '',
    message: '',
  });

  const walletBalanceKobo = BigInt(wallet?.balance_kobo || 0);

  // Handle switching task types
  const handleSelectTaskType = (type: TaskType) => {
    setTaskType(type);
    if (type === 'existing_user') {
      setPricePerParticipant(100);
    } else if (type === 'new_user') {
      setPricePerParticipant(500);
    } else if (type === 'combined') {
      setExistingPrice(100);
      setNewPrice(500);
    }
  };

  // Pricing calculations
  const platformFee = 200; // Standard ₦200 platform service fee
  const premiumFee = isPremium ? 200 : 0;

  let baseCost = 0;
  if (taskType === 'combined') {
    const costEx = (existingQuantity || 0) * (existingPrice || 0);
    const costNw = (newQuantity || 0) * (newPrice || 0);
    baseCost = costEx + costNw;
  } else {
    baseCost = (quantity || 0) * (pricePerParticipant || 0);
  }

  const totalAmount = baseCost + platformFee + premiumFee;
  const totalCostKobo = BigInt(Math.max(0, totalAmount)) * BigInt(100);
  const hasSufficientWalletBalance = walletBalanceKobo >= totalCostKobo && totalCostKobo > BigInt(0);

  // Auto-switch payment method if wallet balance is insufficient
  useEffect(() => {
    if (!hasSufficientWalletBalance && paymentMethod === 'wallet') {
      // Keep wallet selected if user wants to see it, but prefer novac if zero balance
      if (walletBalanceKobo === BigInt(0)) {
        setPaymentMethod('novac');
      }
    }
  }, [hasSufficientWalletBalance, walletBalanceKobo]);

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!user) {
      setIsSubmitting(true);
      await signInWithGoogle('/tasks/create');
      return;
    }

    // Validation for combined vs single
    if (taskType === 'combined') {
      if (!existingLink.trim().startsWith('https://')) {
        setErrorMsg('Please enter a valid HTTPS Temu invitation link for existing users.');
        return;
      }
      if (useSeparateNewLink && !newLink.trim().startsWith('https://')) {
        setErrorMsg('Please enter a valid HTTPS Temu invitation link for new users.');
        return;
      }
      if (!existingQuantity || existingQuantity < 1 || existingQuantity > 1000) {
        setErrorMsg('Existing user count must be between 1 and 1,000 participants.');
        return;
      }
      if (!newQuantity || newQuantity < 1 || newQuantity > 1000) {
        setErrorMsg('New user count must be between 1 and 1,000 participants.');
        return;
      }
      if (!existingPrice || existingPrice < 30) {
        setErrorMsg('Price per existing user participant cannot be lower than ₦30.');
        return;
      }
      if (!newPrice || newPrice < 100) {
        setErrorMsg('Price per new user participant cannot be lower than ₦100.');
        return;
      }
    } else {
      if (!invitationLink.trim().startsWith('https://')) {
        setErrorMsg('Please enter a valid HTTPS Temu invitation link.');
        return;
      }
      if (!quantity || quantity < 1 || quantity > 1000) {
        setErrorMsg('Please specify between 1 and 1,000 participants.');
        return;
      }
      const minPrice = taskType === 'new_user' ? 100 : 30;
      if (!pricePerParticipant || pricePerParticipant < minPrice) {
        setErrorMsg(
          `Price per participant cannot be lower than ₦${minPrice} for ${
            taskType === 'new_user' ? 'New Temu Users' : 'Existing Temu Users'
          }.`
        );
        return;
      }
    }

    if (paymentMethod === 'wallet' && !hasSufficientWalletBalance) {
      setErrorMsg(
        `Insufficient wallet balance. Total cost is ₦${totalAmount.toLocaleString()}, but you have ${formatNaira(
          walletBalanceKobo
        )}. Please switch to Novac or top up your wallet.`
      );
      return;
    }

    setIsSubmitting(true);
    setModalState({
      isOpen: true,
      type: 'loading',
      title: paymentMethod === 'wallet' ? 'Publishing Your Task...' : 'Preparing Novac Checkout...',
      message:
        paymentMethod === 'wallet'
          ? `Debiting ₦${totalAmount.toLocaleString()} from your wallet and launching your task(s) to the marketplace...`
          : 'Connecting to Novac secure payment gateway. Please wait...',
    });

    try {
      const payload: any = {
        taskType,
        title: title.trim(),
        instructions: instructions.trim(),
        isPremium,
        paymentMethod,
      };

      if (taskType === 'combined') {
        payload.existingQuantity;
        payload.existingQuantity = existingQuantity;
        payload.existingPrice = existingPrice;
        payload.existingLink = existingLink.trim();
        payload.newQuantity = newQuantity;
        payload.newPrice = newPrice;
        payload.newLink = (useSeparateNewLink ? newLink : existingLink).trim();
      } else {
        payload.quantity = quantity;
        payload.pricePerParticipant = pricePerParticipant;
        payload.invitationLink = invitationLink.trim();
      }

      const res = await fetch('/api/tasks/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        const errorText = data.error || 'Failed to initiate task publication';
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

      // Wallet Success: Direct In-App Activation & Instant Redirect to My Tasks
      if (data.method === 'wallet') {
        await refreshProfile();
        window.location.href = '/my-tasks?msg=Task+published+successfully';
        return;
      }

      // Novac Checkout Redirect
      if (data.paymentUrl) {
        window.location.href = data.paymentUrl;
      } else {
        throw new Error('No checkout URL received from Novac payment gateway.');
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
            Choose single or combined participant tasks, customize reward pricing, set clear instructions,
            and fund instantly with your wallet or Novac.
          </p>
        </div>

        {errorMsg && (
          <div className="p-4 bg-[#FEF2F2] border border-[#FECACA] rounded-xl text-xs text-[#DC2626] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleCheckout} className="space-y-6">
          {/* STEP 1: TASK TYPE SELECTOR */}
          <Card className="space-y-4">
            <label className="block text-xs font-bold text-[#111827] uppercase tracking-wider">
              Step 1: Choose Participant Type
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Existing User */}
              <div
                onClick={() => handleSelectTaskType('existing_user')}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  taskType === 'existing_user'
                    ? 'border-[#F95700] bg-[#FFF5F0]/60 shadow-xs'
                    : 'border-[#E5E7EB] hover:border-[#D1D5DB]'
                }`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-sm text-[#111827]">Existing User</span>
                </div>
                <Badge variant={taskType === 'existing_user' ? 'primary' : 'secondary'} className="text-[10px] mb-2">
                  ₦100 default
                </Badge>
                <p className="text-xs text-[#6B7280]">
                  Participants who already have Temu installed on their phone.
                </p>
              </div>

              {/* New User */}
              <div
                onClick={() => handleSelectTaskType('new_user')}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  taskType === 'new_user'
                    ? 'border-[#F95700] bg-[#FFF5F0]/60 shadow-xs'
                    : 'border-[#E5E7EB] hover:border-[#D1D5DB]'
                }`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-sm text-[#111827]">New User</span>
                </div>
                <Badge variant={taskType === 'new_user' ? 'premium' : 'secondary'} className="text-[10px] mb-2">
                  ₦500 default
                </Badge>
                <p className="text-xs text-[#6B7280]">
                  Brand new participants downloading &amp; registering Temu.
                </p>
              </div>

              {/* Combined Task */}
              <div
                onClick={() => handleSelectTaskType('combined')}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  taskType === 'combined'
                    ? 'border-[#F95700] bg-[#FFF5F0]/80 shadow-xs ring-1 ring-[#F95700]'
                    : 'border-[#E5E7EB] hover:border-[#D1D5DB]'
                }`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-sm text-[#111827] flex items-center gap-1">
                    <Layers className="w-4 h-4 text-[#F95700]" /> Combined
                  </span>
                </div>
                <Badge variant="success" className="text-[10px] mb-2">
                  New &amp; Existing (2-in-1)
                </Badge>
                <p className="text-xs text-[#6B7280]">
                  Launch both New &amp; Existing user tasks together with separate slots and links!
                </p>
              </div>
            </div>
          </Card>

          {/* STEP 2: COMBINED OR SINGLE CONFIGURATION */}
          {taskType === 'combined' ? (
            <div className="space-y-5">
              {/* Existing User Config Box */}
              <Card className="space-y-4 border-l-4 border-l-[#F95700]">
                <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-2">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-[#F95700]" />
                    <h3 className="text-sm font-bold text-[#111827]">1. Existing User Task Setup</h3>
                  </div>
                  <Badge variant="primary">Default ₦100</Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label="Existing Users Needed (Slots)"
                    type="number"
                    min="1"
                    max="1000"
                    value={existingQuantity.toString()}
                    onChange={(e) => setExistingQuantity(parseInt(e.target.value, 10) || 0)}
                    required
                  />

                  <Input
                    label="Price Per Existing User (₦, Min ₦30)"
                    type="number"
                    min="30"
                    value={existingPrice.toString()}
                    onChange={(e) => setExistingPrice(parseInt(e.target.value, 10) || 0)}
                    required
                  />
                </div>

                {existingPrice < 100 && existingPrice >= 30 && (
                  <div className="p-3 bg-[#FFFBEB] border border-[#FDE68A] rounded-lg text-xs text-[#92400E] flex items-center justify-between">
                    <span>Warning: ₦{existingPrice} is below recommended ₦100 and may get fewer users.</span>
                    <button
                      type="button"
                      onClick={() => setExistingPrice(100)}
                      className="font-bold text-[#F95700] underline ml-2 shrink-0"
                    >
                      Reset to ₦100
                    </button>
                  </div>
                )}

                <Input
                  label="Temu Invite Link for Existing Users"
                  placeholder="https://temu.to/m/... or https://temu.com/s/..."
                  value={existingLink}
                  onChange={(e) => setExistingLink(e.target.value)}
                  leftIcon={<LinkIcon className="w-4 h-4" />}
                  required
                />
              </Card>

              {/* New User Config Box */}
              <Card className="space-y-4 border-l-4 border-l-[#10B981]">
                <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#10B981]" />
                    <h3 className="text-sm font-bold text-[#111827]">2. New User Task Setup</h3>
                  </div>
                  <Badge variant="success">Default ₦500</Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label="New Users Needed (Slots)"
                    type="number"
                    min="1"
                    max="1000"
                    value={newQuantity.toString()}
                    onChange={(e) => setNewQuantity(parseInt(e.target.value, 10) || 0)}
                    required
                  />

                  <Input
                    label="Price Per New User (₦, Min ₦100)"
                    type="number"
                    min="100"
                    value={newPrice.toString()}
                    onChange={(e) => setNewPrice(parseInt(e.target.value, 10) || 0)}
                    required
                  />
                </div>

                {newPrice < 500 && newPrice >= 100 && (
                  <div className="p-3 bg-[#FFFBEB] border border-[#FDE68A] rounded-lg text-xs text-[#92400E] flex items-center justify-between">
                    <span>Warning: ₦{newPrice} is below recommended ₦500 and may get fewer users.</span>
                    <button
                      type="button"
                      onClick={() => setNewPrice(500)}
                      className="font-bold text-[#F95700] underline ml-2 shrink-0"
                    >
                      Reset to ₦500
                    </button>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-[#111827]">
                      Temu Invite Link for New Users
                    </label>
                    <label className="text-xs text-[#6B7280] flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={useSeparateNewLink}
                        onChange={(e) => setUseSeparateNewLink(e.target.checked)}
                        className="accent-[#F95700] rounded"
                      />
                      <span>Use a different link for new users</span>
                    </label>
                  </div>

                  {useSeparateNewLink ? (
                    <Input
                      placeholder="https://temu.to/m/... (Different Link for New Users)"
                      value={newLink}
                      onChange={(e) => setNewLink(e.target.value)}
                      leftIcon={<LinkIcon className="w-4 h-4" />}
                      required
                    />
                  ) : (
                    <p className="text-xs text-[#6B7280] bg-[#F7F7F8] p-3 rounded-lg border border-[#E5E7EB]">
                      Using the same invite link as above: <strong>{existingLink || '(Enter link above)'}</strong>
                    </p>
                  )}
                </div>
              </Card>
            </div>
          ) : (
            /* Single Task Setup */
            <Card className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-[#111827] uppercase tracking-wider">
                  Step 2: Slots, Link &amp; Price Setup
                </label>
                <Badge variant={taskType === 'new_user' ? 'premium' : 'primary'}>
                  {taskType === 'new_user' ? 'New User (₦500 rec.)' : 'Existing User (₦100 rec.)'}
                </Badge>
              </div>

              <Input
                label="Temu Invitation Link (HTTPS)"
                placeholder="https://temu.to/m/... or https://temu.com/s/..."
                value={invitationLink}
                onChange={(e) => setInvitationLink(e.target.value)}
                leftIcon={<LinkIcon className="w-4 h-4" />}
                required
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Participants Quantity (1 to 1,000)"
                  type="number"
                  min="1"
                  max="1000"
                  value={quantity.toString()}
                  onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 0)}
                  leftIcon={<Users className="w-4 h-4" />}
                  required
                />

                <Input
                  label={`Price Per Participant (₦, Min ₦${taskType === 'new_user' ? '100' : '30'})`}
                  type="number"
                  min={taskType === 'new_user' ? 100 : 30}
                  value={pricePerParticipant.toString()}
                  onChange={(e) => setPricePerParticipant(parseInt(e.target.value, 10) || 0)}
                  required
                />
              </div>

              {/* Warning when below recommended */}
              {taskType === 'existing_user' && pricePerParticipant < 100 && pricePerParticipant >= 30 && (
                <div className="p-3 bg-[#FFFBEB] border border-[#FDE68A] rounded-lg text-xs text-[#92400E] flex items-center justify-between">
                  <span>Warning: This price (₦{pricePerParticipant}) might not get users. Recommended: ₦100.</span>
                  <button
                    type="button"
                    onClick={() => setPricePerParticipant(100)}
                    className="font-bold text-[#F95700] underline ml-2 shrink-0"
                  >
                    Reset to ₦100
                  </button>
                </div>
              )}

              {taskType === 'new_user' && pricePerParticipant < 500 && pricePerParticipant >= 100 && (
                <div className="p-3 bg-[#FFFBEB] border border-[#FDE68A] rounded-lg text-xs text-[#92400E] flex items-center justify-between">
                  <span>Warning: This price (₦{pricePerParticipant}) might not get users. Recommended: ₦500.</span>
                  <button
                    type="button"
                    onClick={() => setPricePerParticipant(500)}
                    className="font-bold text-[#F95700] underline ml-2 shrink-0"
                  >
                    Reset to ₦500
                  </button>
                </div>
              )}
            </Card>
          )}

          {/* STEP 3: TITLE & INSTRUCTIONS FIELD */}
          <Card className="space-y-4">
            <label className="block text-xs font-bold text-[#111827] uppercase tracking-wider">
              Step 3: Title &amp; Participant Instructions
            </label>

            <Input
              label="Task Title / Note (Optional)"
              placeholder="e.g. Free Gifts Invite Link or Hat Trick"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-[#111827]">
                  Participant Instructions (Default Provided)
                </label>
                <button
                  type="button"
                  onClick={() => setInstructions(DEFAULT_TASK_INSTRUCTIONS)}
                  className="text-[11px] font-semibold text-[#F95700] hover:underline flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" /> Reset to default
                </button>
              </div>

              <textarea
                rows={4}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Enter detailed instructions for participants..."
                className="w-full rounded-lg border border-[#E5E7EB] p-3 text-xs text-[#111827] focus:border-[#F95700] focus:ring-1 focus:ring-[#F95700]/30 outline-none transition-all leading-relaxed"
                required
              />
              <p className="text-[11px] text-[#6B7280]">
                Participants will read these instructions before accepting and submitting proof for your task.
              </p>
            </div>
          </Card>

          {/* STEP 4: PROMOTION */}
          <Card className="space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-sm text-[#111827]">
                  <Sparkles className="w-4 h-4 text-[#F59E0B]" />
                  Promote as Premium Task (+₦200)
                </div>
                <p className="text-xs text-[#6B7280]">
                  Receive an Urgent badge and prioritized top placement in the marketplace for faster completions.
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

          {/* STEP 5: PAYMENT METHOD SELECTOR */}
          <Card className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-[#111827] uppercase tracking-wider">
                Step 5: Select Payment Method
              </label>
              <div className="text-xs text-[#6B7280]">
                Wallet Balance: <strong className="text-[#111827]">{formatNaira(walletBalanceKobo)}</strong>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Option 1: Pay with Wallet */}
              <div
                onClick={() => setPaymentMethod('wallet')}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  paymentMethod === 'wallet'
                    ? 'border-[#F95700] bg-[#FFF5F0]/70 ring-1 ring-[#F95700]'
                    : 'border-[#E5E7EB] hover:border-[#D1D5DB]'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2 font-bold text-sm text-[#111827]">
                    <Wallet className="w-4 h-4 text-[#F95700]" />
                    <span>Wallet Balance</span>
                  </div>
                  {hasSufficientWalletBalance ? (
                    <Badge variant="success" className="text-[10px]">
                      Sufficient
                    </Badge>
                  ) : (
                    <Badge variant="danger" className="text-[10px]">
                      Low Balance
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-[#4B5563]">
                  Available: <strong className="text-[#111827]">{formatNaira(walletBalanceKobo)}</strong>
                </div>
                <p className="text-[11px] text-[#6B7280] mt-1">
                  Instant 1-click publishing directly debited from your earnings &amp; deposit balance.
                </p>
              </div>

              {/* Option 2: Pay with Novac */}
              <div
                onClick={() => setPaymentMethod('novac')}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  paymentMethod === 'novac'
                    ? 'border-[#F95700] bg-[#FFF5F0]/70 ring-1 ring-[#F95700]'
                    : 'border-[#E5E7EB] hover:border-[#D1D5DB]'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2 font-bold text-sm text-[#111827]">
                    <CreditCard className="w-4 h-4 text-[#0090FE]" />
                    <span>Novac Gateway</span>
                  </div>
                  <Badge variant="secondary" className="text-[10px]">
                    Card / Transfer
                  </Badge>
                </div>
                <div className="text-xs text-[#4B5563]">Instant Bank Checkout</div>
                <p className="text-[11px] text-[#6B7280] mt-1">
                  Pay with Nigerian Debit Card, OPay/PalmPay transfer, or direct bank transfer.
                </p>
              </div>
            </div>
          </Card>

          {/* STEP 6: SUMMARY & ACTION BUTTON */}
          <Card className="bg-[#111827] text-white border-none space-y-5 p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-bold text-white">Transparent Price Summary</h3>
              <span className="text-[11px] bg-[#10B981]/20 text-[#10B981] px-2.5 py-1 rounded-full font-semibold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                {paymentMethod === 'wallet' ? 'Instant Wallet Debit' : 'Novac Secured'}
              </span>
            </div>

            <div className="space-y-2 text-xs">
              {taskType === 'combined' ? (
                <>
                  <div className="flex justify-between text-[#9CA3AF]">
                    <span>Existing User Tasks ({existingQuantity} × ₦{existingPrice}):</span>
                    <span className="font-semibold text-white">
                      {formatNairaPlain(existingQuantity * existingPrice)}
                    </span>
                  </div>
                  <div className="flex justify-between text-[#9CA3AF]">
                    <span>New User Tasks ({newQuantity} × ₦{newPrice}):</span>
                    <span className="font-semibold text-white">
                      {formatNairaPlain(newQuantity * newPrice)}
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between text-[#9CA3AF]">
                  <span>
                    Base Task Cost ({quantity} × ₦{pricePerParticipant}):
                  </span>
                  <span className="font-semibold text-white">{formatNairaPlain(baseCost)}</span>
                </div>
              )}

              <div className="flex justify-between text-[#9CA3AF]">
                <span>Standard Platform Launch Fee:</span>
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

            {paymentMethod === 'wallet' ? (
              <Button
                type="submit"
                size="lg"
                variant="primary"
                className="w-full mt-2 text-base bg-[#F95700] hover:bg-[#E04E00]"
                isLoading={isSubmitting}
                disabled={!hasSufficientWalletBalance || totalAmount <= 0}
                loadingText="Publishing Task(s)..."
                leftIcon={<Wallet className="w-5 h-5" />}
              >
                {hasSufficientWalletBalance
                  ? `Pay ${formatNairaPlain(totalAmount)} with Wallet Balance`
                  : `Insufficient Wallet Balance (${formatNaira(walletBalanceKobo)})`}
              </Button>
            ) : (
              <Button
                type="submit"
                size="lg"
                variant="primary"
                className="w-full mt-2 text-base bg-[#F95700] hover:bg-[#E04E00]"
                isLoading={isSubmitting}
                disabled={totalAmount <= 0}
                loadingText="Redirecting to Novac Checkout..."
                leftIcon={<CreditCard className="w-5 h-5" />}
              >
                Proceed to Novac Checkout ({formatNairaPlain(totalAmount)})
              </Button>
            )}
          </Card>
        </form>

        {/* Status Modal Popup */}
        <StatusModal
          isOpen={modalState.isOpen}
          type={modalState.type}
          title={modalState.title}
          message={modalState.message}
          actionText={modalState.actionText || 'Close'}
          onAction={modalState.onAction || (() => setModalState((prev) => ({ ...prev, isOpen: false })))}
          onClose={() => setModalState((prev) => ({ ...prev, isOpen: false }))}
        />
      </div>
    </AppShell>
  );
}
