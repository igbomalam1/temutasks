export const dynamic = 'force-dynamic';
import { createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { executeWalletTransaction } from '@/lib/wallet';

export async function POST(request: Request) {
  try {
    const adminSupabase = createAdminClient();
    const body = await request.json();

    const { reference, code } = body;
    if (!reference) {
      return NextResponse.json({ error: 'Missing reference' }, { status: 400 });
    }

    const numericCode = parseInt(code, 10);

    // Look up transaction
    const { data: airtimeTx } = await adminSupabase
      .from('temutask_airtime_purchases')
      .select('*')
      .eq('reference', reference)
      .maybeSingle();

    if (!airtimeTx) {
      return NextResponse.json({ status: 'received', message: 'Reference not found' });
    }

    if (airtimeTx.status === 'successful' && numericCode === 200) {
      return NextResponse.json({ status: 'already_completed' });
    }

    if (numericCode === 200) {
      // Mark successful
      await adminSupabase
        .from('temutask_airtime_purchases')
        .update({ status: 'successful', provider_code: numericCode })
        .eq('reference', reference);
    } else if (numericCode === 800 || numericCode === 900) {
      // Failed / Reversed - refund wallet if not previously refunded
      await adminSupabase
        .from('temutask_airtime_purchases')
        .update({ status: 'reversed', provider_code: numericCode })
        .eq('reference', reference);

      await executeWalletTransaction({
        userId: airtimeTx.user_id,
        amountKobo: BigInt(airtimeTx.amount_kobo),
        direction: 'credit',
        transactionType: 'airtime_refund',
        description: `Refund: Airtime reversed by network for ${airtimeTx.phone}`,
        relatedId: reference,
        idempotencyKey: `WEBHOOK-REFUND-${reference}`,
      });
    }

    return NextResponse.json({ status: 'processed' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
