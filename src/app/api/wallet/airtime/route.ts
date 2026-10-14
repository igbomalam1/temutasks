export const dynamic = 'force-dynamic';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { purchaseAirtime } from '@/lib/smartapi';
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

    const { network, phone, amount } = await request.json();

    const amt = parseInt(amount, 10);
    if (!amt || amt < 50 || amt > 50000) {
      return NextResponse.json({ error: 'Amount must be between ₦50 and ₦50,000' }, { status: 400 });
    }

    if (!['MTN', 'AIRTEL', 'GLO', '9MOBILE'].includes(network)) {
      return NextResponse.json({ error: 'Unsupported mobile network' }, { status: 400 });
    }

    let cleanPhone = phone ? String(phone).replace(/[^0-9]/g, '') : '';
    if (cleanPhone.startsWith('234') && cleanPhone.length === 13) {
      cleanPhone = '0' + cleanPhone.slice(3);
    }

    if (!cleanPhone || cleanPhone.length !== 11) {
      return NextResponse.json({ error: 'Valid 11-digit mobile phone number is required (e.g. 08012345678)' }, { status: 400 });
    }

    const amountKobo = BigInt(amt) * BigInt(100);
    const reference = generateRef('AIR');

    // 1. Atomically debit user wallet before calling external airtime provider
    const debitResult = await executeWalletTransaction({
      userId: user.id,
      amountKobo,
      direction: 'debit',
      transactionType: 'airtime_debit',
      description: `Airtime purchase of ₦${amt} on ${network} (${phone})`,
      relatedId: reference,
      idempotencyKey: `AIRTIME-${reference}`,
    });

    if (!debitResult.success) {
      return NextResponse.json({ error: debitResult.error || 'Insufficient wallet balance' }, { status: 400 });
    }

    // 2. Call SmartAPI (Sabuss) provider
    const airtimeResult = await purchaseAirtime({
      network,
      phone: cleanPhone,
      amount: amt,
      reference,
    });

    // 3. Record airtime purchase row
    const status = airtimeResult.status;
    await adminSupabase.from('temutask_airtime_purchases').insert({
      user_id: user.id,
      network,
      phone: cleanPhone,
      amount_naira: amt,
      amount_kobo: amountKobo.toString(),
      reference,
      provider_plan_id: network,
      provider_code: airtimeResult.code,
      provider_message: airtimeResult.message,
      status: status === 'successful' ? 'successful' : status === 'pending' ? 'pending' : 'failed',
    });

    // 4. If transaction failed definitively (code 800/900), refund user wallet
    if (!airtimeResult.success && airtimeResult.code !== 400) {
      await executeWalletTransaction({
        userId: user.id,
        amountKobo,
        direction: 'credit',
        transactionType: 'airtime_refund',
        description: `Refund: Failed airtime recharge on ${network} (${phone})`,
        relatedId: reference,
        idempotencyKey: `REFUND-${reference}`,
      });

      return NextResponse.json({
        error: `Recharge failed: ${airtimeResult.message}. Your wallet balance has been refunded.`,
      }, { status: 502 });
    }

    // 5. If successful, send in-app notification and email receipt
    if (airtimeResult.success || airtimeResult.code === 400) {
      await adminSupabase.from('temutask_notifications').insert({
        user_id: user.id,
        title: 'Airtime Recharge Successful 📱',
        message: `₦${amt.toLocaleString()} airtime to ${phone} (${network}) has been processed. Reference: ${reference}.`,
        type: 'airtime_purchase',
        link: '/wallet',
      });

      if (user.email) {
        const emailHtml = renderEmailTemplate({
          title: 'Airtime Purchase Successful 📱',
          contentHtml: `<p>Your airtime recharge has been processed successfully:</p>
          <p><strong>Network:</strong> ${network}<br>
          <strong>Phone:</strong> ${phone}<br>
          <strong>Amount:</strong> ₦${amt.toLocaleString()}.00<br>
          <strong>Reference:</strong> ${reference}<br>
          <strong>Status:</strong> ${airtimeResult.status.toUpperCase()}</p>
          <p>The airtime will reflect on the destination number immediately.</p>`,
          ctaText: 'View Wallet Balance',
          ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://temutasks.top'}/wallet`,
        });

        sendEmail({
          to: user.email,
          subject: `[TemuTasks] Airtime Purchase Receipt: ₦${amt} (${network})`,
          html: emailHtml,
          eventType: 'airtime_receipt',
        }).catch((e) => console.error('Sendbyte airtime receipt error:', e));
      }
    }

    return NextResponse.json({
      success: true,
      reference,
      status: airtimeResult.status,
      message: airtimeResult.message,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error processing airtime' }, { status: 500 });
  }
}
