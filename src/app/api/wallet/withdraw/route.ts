import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { executeWalletTransaction } from '@/lib/wallet';
import { generateRef } from '@/lib/utils';
import { sendEmail, renderEmailTemplate } from '@/lib/sendbyte';

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const adminSupabase = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { paymentDestination, accountNumber, accountName, amount } = await request.json();

    const amt = parseInt(amount, 10);
    if (!amt || amt < 500 || amt > 100000) {
      return NextResponse.json({ error: 'Withdrawal amount must be between ₦500 and ₦100,000' }, { status: 400 });
    }

    if (!['opay', 'palmpay', 'moniepoint'].includes(paymentDestination)) {
      return NextResponse.json({ error: 'Unsupported withdrawal destination' }, { status: 400 });
    }

    if (!accountNumber || accountNumber.length < 10) {
      return NextResponse.json({ error: 'Valid 10-digit account number required' }, { status: 400 });
    }

    if (!accountName?.trim()) {
      return NextResponse.json({ error: 'Account holder name required' }, { status: 400 });
    }

    const amountKobo = BigInt(amt) * BigInt(100);
    const reference = generateRef('WTH');

    // 1. Atomically reserve & debit user funds from wallet
    const debitResult = await executeWalletTransaction({
      userId: user.id,
      amountKobo,
      direction: 'debit',
      transactionType: 'withdrawal_reserve',
      description: `Cash out request to ${paymentDestination.toUpperCase()} (${accountNumber})`,
      relatedId: reference,
      idempotencyKey: `WITHDRAW-${reference}`,
    });

    if (!debitResult.success) {
      return NextResponse.json({ error: debitResult.error || 'Insufficient wallet balance' }, { status: 400 });
    }

    // 2. Insert withdrawal record for admin processing
    const { error: wthError } = await adminSupabase.from('temutask_withdrawals').insert({
      user_id: user.id,
      amount_kobo: amountKobo.toString(),
      total_debit_kobo: amountKobo.toString(),
      payment_destination: paymentDestination,
      account_number: accountNumber.trim(),
      account_name: accountName.trim(),
      reference,
      status: 'pending',
    });

    if (wthError) {
      return NextResponse.json({ error: wthError.message }, { status: 500 });
    }

    // 3. Send confirmation email via Sendbyte
    const emailHtml = renderEmailTemplate({
      title: 'Withdrawal Request Received 🏦',
      contentHtml: `<p>We have received your cash out request:</p>
      <p><strong>Amount:</strong> ₦${amt.toLocaleString()}.00<br>
      <strong>Destination:</strong> ${paymentDestination.toUpperCase()}<br>
      <strong>Account Number:</strong> ${accountNumber}<br>
      <strong>Account Name:</strong> ${accountName}<br>
      <strong>Reference:</strong> ${reference}</p>
      <p>Our finance team processes payouts quickly. You will be notified once transfer is completed.</p>`,
      ctaText: 'View Wallet',
      ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://temutasks.top'}/wallet`,
    });

    sendEmail({
      to: user.email!,
      subject: `[TemuTasks] Cash Out Request Received: ₦${amt}`,
      html: emailHtml,
      eventType: 'withdrawal_requested',
    }).catch((e) => console.error('Sendbyte email error:', e));

    return NextResponse.json({
      success: true,
      reference,
      status: 'pending',
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
