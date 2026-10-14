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

    const { taskType, quantity, pricePerParticipant: customPrice, invitationLink, isPremium, title } =
      await request.json();

    const qty = parseInt(quantity, 10);
    if (!qty || qty < 1 || qty > 1000) {
      return NextResponse.json({ error: 'Quantity must be between 1 and 1,000' }, { status: 400 });
    }

    if (!invitationLink || !invitationLink.startsWith('https://')) {
      return NextResponse.json({ error: 'Valid HTTPS invitation link is required' }, { status: 400 });
    }

    // Threshold enforcement: Minimum ₦55 for existing_user, Minimum ₦250 for new_user
    const minPriceNaira = taskType === 'new_user' ? 250 : 55;
    const requestedPriceNaira =
      customPrice !== undefined && customPrice !== null
        ? Number(customPrice)
        : minPriceNaira;

    if (isNaN(requestedPriceNaira) || requestedPriceNaira < minPriceNaira) {
      return NextResponse.json(
        {
          error: `Price per participant cannot be below the minimum threshold of ₦${minPriceNaira} for ${
            taskType === 'new_user' ? 'New Temu User' : 'Existing Temu User'
          } tasks.`,
        },
        { status: 400 }
      );
    }

    const pricePerParticipantKobo = BigInt(Math.round(requestedPriceNaira * 100));

    // Proportional split using the exact baseline matrix:
    // - Existing User (baseline 55): Participant = 45/55 (~81.82%), Referrer = 10/55 (~18.18%)
    // - New User (baseline 250): Participant = 200/250 (80.00%), Referrer = 50/250 (20.00%)
    let rewardPerPartKobo: bigint;
    let commPerRefKobo: bigint;

    if (taskType === 'new_user') {
      rewardPerPartKobo = (pricePerParticipantKobo * BigInt(200)) / BigInt(250);
      commPerRefKobo = pricePerParticipantKobo - rewardPerPartKobo;
    } else {
      rewardPerPartKobo = (pricePerParticipantKobo * BigInt(45)) / BigInt(55);
      commPerRefKobo = pricePerParticipantKobo - rewardPerPartKobo;
    }

    const baseCostKobo = pricePerParticipantKobo * BigInt(qty);
    const platformFeeKobo = BigInt(20000); // ₦200
    const premiumFeeKobo = isPremium ? BigInt(20000) : BigInt(0); // +₦200 if premium
    const totalKobo = baseCostKobo + platformFeeKobo + premiumFeeKobo;
    const totalNaira = Number(totalKobo) / 100;

    const reference = generateRef('TASK-PAY');
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const redirectUrl = `${appUrl}/api/payments/novac/callback?ref=${reference}&type=task_creation`;

    // 1. Record pending payment order
    const { error: orderError } = await adminSupabase.from('temutask_payment_orders').insert({
      user_id: user.id,
      order_type: 'task_creation',
      amount_kobo: totalKobo.toString(),
      reference,
      provider: 'novac',
      status: 'pending',
      related_payload: {
        taskType,
        quantity: qty,
        pricePerParticipantNaira: requestedPriceNaira,
        invitationLink,
        isPremium: !!isPremium,
        title: title || 'Temu Invitation Task',
        rewardPerPartKobo: rewardPerPartKobo.toString(),
        commPerRefKobo: commPerRefKobo.toString(),
        baseCostKobo: baseCostKobo.toString(),
        platformFeeKobo: platformFeeKobo.toString(),
        premiumFeeKobo: premiumFeeKobo.toString(),
        totalCostKobo: totalKobo.toString(),
      },
    });

    if (orderError) {
      return NextResponse.json({ error: orderError.message }, { status: 400 });
    }

    // 2. Initiate Novac checkout
    const paymentResult = await initiateNovacPayment({
      amount: totalNaira,
      reference,
      email: user.email!,
      redirectUrl,
      description: `TemuTasks: ${qty} ${
        taskType === 'new_user' ? 'New' : 'Existing'
      } Participants @ ₦${requestedPriceNaira}`,
    });

    if (!paymentResult.success || !paymentResult.paymentUrl) {
      return NextResponse.json(
        { error: paymentResult.message || 'Failed to initiate checkout with Novac' },
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
