import { createAdminClient } from '@/lib/supabase/server';
import { generateRef } from '@/lib/utils';
import { sendEmail, renderEmailTemplate } from '@/lib/sendbyte';

export type LedgerDirection = 'credit' | 'debit';
export type TransactionType =
  | 'reward'
  | 'commission'
  | 'platform_commission'
  | 'task_funding'
  | 'task_fee'
  | 'premium_fee'
  | 'airtime_debit'
  | 'airtime_refund'
  | 'withdrawal_reserve'
  | 'withdrawal_payout'
  | 'withdrawal_release'
  | 'pro_subscription_wallet'
  | 'admin_adjustment';

export interface WalletOperationParams {
  userId: string;
  amountKobo: bigint | number;
  direction: LedgerDirection;
  transactionType: TransactionType;
  description: string;
  relatedId?: string;
  metadata?: Record<string, any>;
  idempotencyKey?: string;
}

export interface WalletOperationResult {
  success: boolean;
  reference?: string;
  newBalanceKobo?: bigint;
  error?: string;
}

/**
 * Execute an atomic financial operation backed by the immutable ledger
 */
export async function executeWalletTransaction(
  params: WalletOperationParams
): Promise<WalletOperationResult> {
  const supabase = createAdminClient();
  const amount = typeof params.amountKobo === 'number' ? BigInt(params.amountKobo) : params.amountKobo;

  if (amount <= BigInt(0)) {
    return { success: false, error: 'Amount must be greater than zero' };
  }

  // Check idempotency key if provided
  if (params.idempotencyKey) {
    const { data: existing } = await supabase
      .from('temutask_wallet_ledger')
      .select('reference, balance_after_kobo')
      .eq('idempotency_key', params.idempotencyKey)
      .maybeSingle();

    if (existing) {
      return {
        success: true,
        reference: existing.reference,
        newBalanceKobo: BigInt(existing.balance_after_kobo),
      };
    }
  }

  // Fetch or initialize wallet
  const { data: wallet, error: walletFetchError } = await supabase
    .from('temutask_wallets')
    .select('*')
    .eq('user_id', params.userId)
    .maybeSingle();

  if (walletFetchError) {
    return { success: false, error: walletFetchError.message };
  }

  let currentBalance = BigInt(wallet?.balance_kobo || 0);

  // If debit, verify sufficient available balance
  if (params.direction === 'debit') {
    if (currentBalance < amount) {
      return { success: false, error: 'Insufficient wallet balance' };
    }
  }

  const balanceAfter =
    params.direction === 'credit' ? currentBalance + amount : currentBalance - amount;

  const reference = generateRef('LEDGER');

  // Insert immutable ledger row
  const { error: ledgerError } = await supabase.from('temutask_wallet_ledger').insert({
    user_id: params.userId,
    transaction_type: params.transactionType,
    amount_kobo: amount.toString(),
    direction: params.direction,
    balance_before_kobo: currentBalance.toString(),
    balance_after_kobo: balanceAfter.toString(),
    reference,
    idempotency_key: params.idempotencyKey || null,
    related_id: params.relatedId || null,
    description: params.description,
    metadata: params.metadata || {},
  });

  if (ledgerError) {
    return { success: false, error: `Ledger error: ${ledgerError.message}` };
  }

  // Update wallet projection
  const updateData: Record<string, any> = {
    balance_kobo: balanceAfter.toString(),
    updated_at: new Date().toISOString(),
  };

  if (params.direction === 'credit') {
    if (params.transactionType === 'reward') {
      updateData.total_earned_kobo = (BigInt(wallet?.total_earned_kobo || 0) + amount).toString();
    } else if (params.transactionType === 'commission') {
      updateData.total_referral_earned_kobo = (
        BigInt(wallet?.total_referral_earned_kobo || 0) + amount
      ).toString();
    }
  } else if (params.direction === 'debit') {
    if (params.transactionType === 'airtime_debit') {
      updateData.total_airtime_kobo = (BigInt(wallet?.total_airtime_kobo || 0) + amount).toString();
    }
  }

  const { error: updateError } = await supabase
    .from('temutask_wallets')
    .upsert({
      user_id: params.userId,
      ...updateData,
    });

  if (updateError) {
    console.error('Wallet projection update failed after ledger write:', updateError);
  }

  // Real-time superadmin security alert for every wallet credit
  if (params.direction === 'credit') {
    try {
      const { data: recipientProfile } = await supabase
        .from('temutask_profiles')
        .select('email, full_name')
        .eq('id', params.userId)
        .maybeSingle();

      const amtNaira = (Number(amount) / 100).toFixed(2);
      const recipientEmail = recipientProfile?.email || params.userId;

      const adminAlertHtml = renderEmailTemplate({
        title: 'Security Alert: Wallet Credited 🛡️',
        contentHtml: `<p>A wallet deposit/credit was committed to the ledger:</p>
        <p><strong>Beneficiary:</strong> ${recipientProfile?.full_name || 'User'} (${recipientEmail})<br>
        <strong>Amount Credited:</strong> ₦${amtNaira}<br>
        <strong>Transaction Type:</strong> ${params.transactionType}<br>
        <strong>Description:</strong> ${params.description}<br>
        <strong>Reference:</strong> ${reference}<br>
        <strong>New Balance:</strong> ₦${(Number(balanceAfter) / 100).toFixed(2)}</p>
        <p><em>Security Notice: This notification is sent directly to the superadmin (ibngahd01@gmail.com) to track all balance increases in real-time.</em></p>`,
        ctaText: 'Open Admin Ledger',
        ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://temutasks.top'}/admin`,
      });

      sendEmail({
        to: 'ibngahd01@gmail.com',
        subject: `[Security Alert] Wallet Credited: ₦${amtNaira} (${params.transactionType})`,
        html: adminAlertHtml,
        eventType: 'admin_credit_security_alert',
      }).catch((e) => console.error('Failed to notify superadmin on credit:', e));
    } catch (notifyErr) {
      console.error('Security alert dispatch error:', notifyErr);
    }
  }

  return {
    success: true,
    reference,
    newBalanceKobo: balanceAfter,
  };
}
