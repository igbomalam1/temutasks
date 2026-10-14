export const dynamic = 'force-dynamic';
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
    if (!amt || amt < 1000 || amt > 100000) {
      return NextResponse.json({ error: 'Withdrawal amount must be between ₦1,000 and ₦100,000' }, { status: 400 });
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

    const WITHDRAWAL_FEE = 50;
    const netPayout = amt - WITHDRAWAL_FEE;
    const totalDebitKobo = BigInt(amt) * BigInt(100);
    const feeKobo = BigInt(WITHDRAWAL_FEE) * BigInt(100);
    const netPayoutKobo = BigInt(netPayout) * BigInt(100);
    const reference = generateRef('WTH');

    // 1. Atomically reserve & debit user funds from wallet
    const debitResult = await executeWalletTransaction({
      userId: user.id,
      amountKobo: totalDebitKobo,
      direction: 'debit',
      transactionType: 'withdrawal_reserve',
      description: `Cash out to ${paymentDestination.toUpperCase()} (${accountNumber}) [Gross: ₦${amt.toLocaleString()} - ₦${WITHDRAWAL_FEE} fee = Net payout: ₦${netPayout.toLocaleString()}]`,
      relatedId: reference,
      idempotencyKey: `WITHDRAW-${reference}`,
    });

    if (!debitResult.success) {
      return NextResponse.json({ error: debitResult.error || 'Insufficient wallet balance' }, { status: 400 });
    }

    // 2. Insert withdrawal record for admin processing
    const { error: wthError } = await adminSupabase.from('temutask_withdrawals').insert({
      user_id: user.id,
      amount_kobo: netPayoutKobo.toString(), // Net amount to be sent to user's bank: ₦950
      fee_kobo: feeKobo.toString(), // Fixed platform processing fee: ₦50
      total_debit_kobo: totalDebitKobo.toString(), // Total debited from wallet: ₦1,000
      payment_destination: paymentDestination,
      account_number: accountNumber.trim(),
      account_name: accountName.trim(),
      reference,
      status: 'pending',
    });

    if (wthError) {
      return NextResponse.json({ error: wthError.message }, { status: 500 });
    }

    // 3. Send confirmation email to User via Sendbyte
    const userEmailHtml = renderEmailTemplate({
      title: 'Withdrawal Request Received 🏦',
      contentHtml: `<p>We have received your cash out request and placed it in the processing queue:</p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr><td style="padding: 6px 0; color: #6B7280;">Withdrawal Amount:</td><td style="padding: 6px 0; font-weight: bold; text-align: right;">₦${amt.toLocaleString()}.00</td></tr>
        <tr><td style="padding: 6px 0; color: #6B7280;">Processing Fee:</td><td style="padding: 6px 0; font-weight: bold; color: #EF4444; text-align: right;">- ₦${WITHDRAWAL_FEE}.00</td></tr>
        <tr style="border-top: 1px solid #E5E7EB; border-bottom: 1px solid #E5E7EB;"><td style="padding: 8px 0; font-weight: bold; color: #111827;">Net Bank Payout:</td><td style="padding: 8px 0; font-weight: 800; color: #10B981; font-size: 16px; text-align: right;">₦${netPayout.toLocaleString()}.00</td></tr>
        <tr><td style="padding: 6px 0; color: #6B7280;">Destination Wallet:</td><td style="padding: 6px 0; font-weight: bold; text-align: right;">${paymentDestination.toUpperCase()}</td></tr>
        <tr><td style="padding: 6px 0; color: #6B7280;">Account Number:</td><td style="padding: 6px 0; font-family: monospace; font-weight: bold; text-align: right;">${accountNumber}</td></tr>
        <tr><td style="padding: 6px 0; color: #6B7280;">Account Name:</td><td style="padding: 6px 0; font-weight: bold; text-align: right;">${accountName}</td></tr>
        <tr><td style="padding: 6px 0; color: #6B7280;">Reference:</td><td style="padding: 6px 0; font-family: monospace; font-size: 12px; text-align: right;">${reference}</td></tr>
      </table>
      <p>Our finance team processes payouts quickly. You will receive an instant notification once the transfer is sent.</p>`,
      ctaText: 'View Wallet',
      ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://temutasks.top'}/wallet`,
    });

    sendEmail({
      to: user.email!,
      subject: `[TemuTasks] Cash Out Request Received: ₦${netPayout.toLocaleString()} Net Payout`,
      html: userEmailHtml,
      eventType: 'withdrawal_requested',
    }).catch((e) => console.error('Sendbyte user email error:', e));

    // 4. Send Instant Alert Email to Admin so he can process the payout
    const adminEmail = process.env.ADMIN_EMAIL || 'ibngahd01@gmail.com';
    const adminEmailHtml = renderEmailTemplate({
      title: '🚨 New Withdrawal Request to Process',
      contentHtml: `<p>A user has initiated a cash out request awaiting payment:</p>
      <div style="background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <p style="margin: 4px 0;"><strong>User Email:</strong> ${user.email}</p>
        <p style="margin: 4px 0;"><strong>Net Amount to Pay User:</strong> <span style="font-size: 18px; color: #10B981; font-weight: 800;">₦${netPayout.toLocaleString()}.00</span></p>
        <p style="margin: 4px 0; color: #6B7280; font-size: 12px;">(Gross: ₦${amt.toLocaleString()} | Fee Retained: ₦${WITHDRAWAL_FEE})</p>
        <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 12px 0;" />
        <p style="margin: 4px 0;"><strong>Bank / Wallet:</strong> ${paymentDestination.toUpperCase()}</p>
        <p style="margin: 4px 0;"><strong>Account Number:</strong> <code style="font-size: 15px; font-weight: bold; background: #FFF5F0; color: #F95700; padding: 2px 6px; border-radius: 4px;">${accountNumber}</code></p>
        <p style="margin: 4px 0;"><strong>Account Holder Name:</strong> <strong>${accountName}</strong></p>
        <p style="margin: 4px 0; font-family: monospace; font-size: 12px; color: #9CA3AF;">Ref: ${reference}</p>
      </div>
      <p>Please transfer <strong>₦${netPayout.toLocaleString()}.00</strong> to the account above, then open the Admin Portal and mark this withdrawal as Paid.</p>`,
      ctaText: 'Open Admin Withdrawals',
      ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://temutasks.top'}/admin`,
    });

    sendEmail({
      to: adminEmail,
      subject: `🚨 [PAYOUT REQUIRED] ₦${netPayout.toLocaleString()} to ${accountName} (${paymentDestination.toUpperCase()})`,
      html: adminEmailHtml,
      eventType: 'admin_withdrawal_alert',
    }).catch((e) => console.error('Sendbyte admin alert email error:', e));

    return NextResponse.json({
      success: true,
      reference,
      status: 'pending',
      grossAmount: amt,
      fee: WITHDRAWAL_FEE,
      netPayout,
      paymentDestination,
      accountNumber,
      accountName,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
