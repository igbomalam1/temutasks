import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { purchaseAirtime } from '@/lib/smartapi';
import { executeWalletTransaction } from '@/lib/wallet';
import { generateRef } from '@/lib/utils';

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

    if (!phone || phone.length < 11) {
      return NextResponse.json({ error: 'Valid 11-digit mobile phone number is required' }, { status: 400 });
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
      phone,
      amount: amt,
      reference,
    });

    // 3. Record airtime purchase row
    const status = airtimeResult.status;
    await adminSupabase.from('temutask_airtime_purchases').insert({
      user_id: user.id,
      network,
      phone,
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
