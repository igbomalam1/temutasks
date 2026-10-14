export const dynamic = 'force-dynamic';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { initiateNovacPayment } from '@/lib/novac';
import { generateRef } from '@/lib/utils';
import { executeWalletTransaction } from '@/lib/wallet';

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const adminSupabase = createAdminClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { taskId, newPrice, paymentMethod = 'wallet' } = await request.json();

    if (!taskId) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 });
    }

    const priceNaira = Number(newPrice);
    if (!priceNaira || priceNaira <= 0) {
      return NextResponse.json({ error: 'Please enter a valid price amount' }, { status: 400 });
    }

    // Fetch the task
    const { data: task, error: taskErr } = await adminSupabase
      .from('temutask_tasks')
      .select('*')
      .eq('id', taskId)
      .maybeSingle();

    if (taskErr || !task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    if (task.user_id !== user.id) {
      return NextResponse.json({ error: 'Only the task owner can increase the reward' }, { status: 403 });
    }

    // Remaining slots to fund
    const remainingSlots = Math.max(0, task.quantity_requested - task.quantity_approved);
    if (remainingSlots <= 0) {
      return NextResponse.json(
        { error: 'All slots for this task have already been completed and approved.' },
        { status: 400 }
      );
    }

    // Current price per participant
    const currentPriceNaira = Math.round(
      Number(task.base_cost_kobo) / (Number(task.quantity_requested) * 100)
    );

    if (priceNaira <= currentPriceNaira) {
      return NextResponse.json(
        {
          error: `New price (₦${priceNaira}) must be greater than current price (₦${currentPriceNaira}).`,
        },
        { status: 400 }
      );
    }

    const priceDiffNaira = priceNaira - currentPriceNaira;
    const topupKobo = BigInt(Math.round(priceDiffNaira * 100)) * BigInt(remainingSlots);
    const topupNaira = Number(topupKobo) / 100;

    // Calculate new reward & commission per participant
    const newPriceKobo = BigInt(Math.round(priceNaira * 100));
    let newRewardKobo: bigint;
    let newCommKobo: bigint;

    if (task.task_type === 'new_user') {
      newRewardKobo = (newPriceKobo * BigInt(400)) / BigInt(500);
      newCommKobo = newPriceKobo - newRewardKobo;
    } else {
      newRewardKobo = (newPriceKobo * BigInt(80)) / BigInt(100);
      newCommKobo = newPriceKobo - newRewardKobo;
    }

    const newBaseCostKobo = BigInt(task.base_cost_kobo) + topupKobo;
    const newTotalCostKobo = BigInt(task.total_cost_kobo) + topupKobo;

    const reference = generateRef('TOPUP');
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://temutasks.top';

    // OPTION A: DIRECT WALLET CHECKOUT
    if (paymentMethod === 'wallet') {
      const { data: wallet } = await adminSupabase
        .from('temutask_wallets')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      const userBalanceKobo = BigInt(wallet?.balance_kobo || 0);

      if (userBalanceKobo < topupKobo) {
        const availableNaira = (Number(userBalanceKobo) / 100).toLocaleString();
        return NextResponse.json(
          {
            error: `Insufficient wallet balance. Top-up cost is ₦${topupNaira.toLocaleString()} for ${remainingSlots} remaining slots (+₦${priceDiffNaira}/slot), but your available balance is ₦${availableNaira}. Please choose Novac or top up your wallet.`,
          },
          { status: 400 }
        );
      }

      // Debit wallet atomically
      const debitRes = await executeWalletTransaction({
        userId: user.id,
        amountKobo: topupKobo,
        direction: 'debit',
        transactionType: 'task_funding',
        description: `Reward increase on task (+₦${priceDiffNaira} × ${remainingSlots} slots = ₦${topupNaira})`,
        relatedId: reference,
        idempotencyKey: `WALLET-TOPUP-${reference}`,
      });

      if (!debitRes.success) {
        return NextResponse.json(
          { error: debitRes.error || 'Failed to debit wallet balance' },
          { status: 400 }
        );
      }

      // Update task in database
      const { error: updateErr } = await adminSupabase
        .from('temutask_tasks')
        .update({
          reward_per_participant_kobo: newRewardKobo.toString(),
          commission_per_referrer_kobo: newCommKobo.toString(),
          base_cost_kobo: newBaseCostKobo.toString(),
          total_cost_kobo: newTotalCostKobo.toString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', taskId);

      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }

      // In-app notification
      await adminSupabase.from('temutask_notifications').insert({
        user_id: user.id,
        title: 'Task Reward Increased! 🚀',
        message: `Task price successfully increased to ₦${priceNaira} (Participant reward: ₦${(
          Number(newRewardKobo) / 100
        ).toLocaleString()}). Top-up of ₦${topupNaira.toLocaleString()} debited from wallet.`,
        type: 'task_reward_increased',
        link: '/my-tasks',
      });

      return NextResponse.json({
        success: true,
        method: 'wallet',
        newPrice: priceNaira,
        newRewardNaira: Number(newRewardKobo) / 100,
        topupNaira,
        remainingSlots,
        message: `Task reward increased to ₦${Number(newRewardKobo) / 100} for remaining ${remainingSlots} slots!`,
      });
    }

    // OPTION B: NOVAC CHECKOUT
    const redirectUrl = `${appUrl}/api/payments/novac/callback?ref=${reference}&type=task_reward_topup`;

    let { error: orderError } = await adminSupabase.from('temutask_payment_orders').insert({
      user_id: user.id,
      order_type: 'task_reward_topup',
      amount_kobo: topupKobo.toString(),
      reference,
      provider: 'novac',
      status: 'pending',
      related_payload: {
        order_type: 'task_reward_topup',
        taskId,
        newPrice: priceNaira,
        newRewardKobo: newRewardKobo.toString(),
        newCommKobo: newCommKobo.toString(),
        newBaseCostKobo: newBaseCostKobo.toString(),
        newTotalCostKobo: newTotalCostKobo.toString(),
        remainingSlots,
        priceDiffNaira,
        topupNaira,
      },
    });

    // Fallback if check constraint doesn't have 'task_reward_topup' yet
    if (orderError && (orderError.message.includes('check constraint') || orderError.message.includes('order_type'))) {
      const fallback = await adminSupabase.from('temutask_payment_orders').insert({
        user_id: user.id,
        order_type: 'task_creation',
        amount_kobo: topupKobo.toString(),
        reference,
        provider: 'novac',
        status: 'pending',
        related_payload: {
          order_type: 'task_reward_topup',
          taskId,
          newPrice: priceNaira,
          newRewardKobo: newRewardKobo.toString(),
          newCommKobo: newCommKobo.toString(),
          newBaseCostKobo: newBaseCostKobo.toString(),
          newTotalCostKobo: newTotalCostKobo.toString(),
          remainingSlots,
          priceDiffNaira,
          topupNaira,
        },
      });
      orderError = fallback.error;
    }

    if (orderError) {
      return NextResponse.json({ error: orderError.message }, { status: 400 });
    }

    const paymentResult = await initiateNovacPayment({
      amount: topupNaira,
      reference,
      email: user.email!,
      redirectUrl,
      description: `TemuTasks Topup: +₦${priceDiffNaira}/slot for ${remainingSlots} slots`,
    });

    if (!paymentResult.success || !paymentResult.paymentUrl) {
      return NextResponse.json(
        { error: paymentResult.message || 'Failed to initiate Novac checkout' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      method: 'novac',
      paymentUrl: paymentResult.paymentUrl,
      reference,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
