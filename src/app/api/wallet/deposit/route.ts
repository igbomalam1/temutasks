export const dynamic = 'force-dynamic';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { initiateNovacPayment } from '@/lib/novac';
import { generateRef } from '@/lib/utils';

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const adminSupabase = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { amount } = await request.json();
    const amt = parseInt(amount, 10);

    if (!amt || amt < 100 || amt > 500000) {
      return NextResponse.json({ error: 'Deposit amount must be between ₦100 and ₦500,000' }, { status: 400 });
    }

    const amountKobo = BigInt(amt) * BigInt(100);
    const reference = generateRef('DEP-NVC');
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://temutasks.top';
    const redirectUrl = `${appUrl}/api/payments/novac/callback?ref=${reference}&type=wallet_deposit`;

    // 1. Record pending payment order
    let { error: orderError } = await adminSupabase.from('temutask_payment_orders').insert({
      user_id: user.id,
      order_type: 'wallet_deposit',
      amount_kobo: amountKobo.toString(),
      reference,
      provider: 'novac',
      status: 'pending',
      related_payload: {
        order_type: 'wallet_deposit',
        depositAmountNaira: amt,
      },
    });

    // Fallback: If DB constraint temutask_payment_orders_order_type_check is restricted to ('task_creation', 'pro_membership')
    if (orderError && (orderError.message.includes('check constraint') || orderError.message.includes('order_type'))) {
      const fallback = await adminSupabase.from('temutask_payment_orders').insert({
        user_id: user.id,
        order_type: 'task_creation',
        amount_kobo: amountKobo.toString(),
        reference,
        provider: 'novac',
        status: 'pending',
        related_payload: {
          order_type: 'wallet_deposit',
          depositAmountNaira: amt,
        },
      });
      orderError = fallback.error;
    }

    if (orderError) {
      return NextResponse.json({ error: orderError.message }, { status: 500 });
    }

    // 2. Initiate Novac checkout
    const paymentResult = await initiateNovacPayment({
      amount: amt,
      reference,
      email: user.email!,
      redirectUrl,
      description: `TemuTasks Wallet Deposit: ₦${amt.toLocaleString()}`,
    });

    if (!paymentResult.success || !paymentResult.paymentUrl) {
      return NextResponse.json(
        { error: paymentResult.message || 'Failed to initiate Novac checkout' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      reference,
      paymentUrl: paymentResult.paymentUrl,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
