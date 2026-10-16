export const dynamic = 'force-dynamic';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { initiateNovacPayment } from '@/lib/novac';
import { generateRef, DEFAULT_TASK_INSTRUCTIONS } from '@/lib/utils';
import { executeWalletTransaction } from '@/lib/wallet';
import { sendEmail, renderEmailTemplate } from '@/lib/sendbyte';
import { dispatchNewTaskAlerts } from '@/lib/task-notifications';

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

    const body = await request.json();
    const {
      taskType,
      title,
      instructions: rawInstructions,
      isPremium,
      durationHours: rawDurationHours,
      paymentMethod = 'novac', // 'wallet' | 'novac'

      // Single task parameters
      quantity,
      pricePerParticipant: customPrice,
      invitationLink,

      // Combined task parameters
      existingQuantity,
      existingPrice,
      existingLink,
      newQuantity,
      newPrice,
      newLink,
    } = body;

    const durationHours = Math.max(1, Math.min(168, parseInt(rawDurationHours, 10) || 24));
    const expiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString();

    const instructions = (rawInstructions || DEFAULT_TASK_INSTRUCTIONS).trim();
    const cleanTitle = (title || '').trim();
    const isCombined = taskType === 'combined';

    interface TaskSpec {
      taskType: 'existing_user' | 'new_user';
      title: string;
      link: string;
      quantity: number;
      pricePerParticipantNaira: number;
      pricePerParticipantKobo: bigint;
      rewardPerPartKobo: bigint;
      commPerRefKobo: bigint;
      baseCostKobo: bigint;
    }

    const tasksToCreate: TaskSpec[] = [];

    if (isCombined) {
      // Validate Existing User task portion
      const exQty = parseInt(existingQuantity, 10);
      if (!exQty || exQty < 1 || exQty > 1000) {
        return NextResponse.json(
          { error: 'Existing user quantity must be between 1 and 1,000' },
          { status: 400 }
        );
      }
      const exLink = (existingLink || '').trim();
      if (!exLink.startsWith('https://')) {
        return NextResponse.json(
          { error: 'Valid HTTPS invitation link required for existing user task' },
          { status: 400 }
        );
      }
      const exPriceNaira = Number(existingPrice) || 100;
      if (exPriceNaira < 30) {
        return NextResponse.json(
          { error: 'Price for existing user task cannot be below ₦30' },
          { status: 400 }
        );
      }

      // Validate New User task portion
      const nwQty = parseInt(newQuantity, 10);
      if (!nwQty || nwQty < 1 || nwQty > 1000) {
        return NextResponse.json(
          { error: 'New user quantity must be between 1 and 1,000' },
          { status: 400 }
        );
      }
      const nwLink = (newLink || existingLink || '').trim();
      if (!nwLink.startsWith('https://')) {
        return NextResponse.json(
          { error: 'Valid HTTPS invitation link required for new user task' },
          { status: 400 }
        );
      }
      const nwPriceNaira = Number(newPrice) || 500;
      if (nwPriceNaira < 100) {
        return NextResponse.json(
          { error: 'Price for new user task cannot be below ₦100' },
          { status: 400 }
        );
      }

      // 1. Existing user spec
      const exPriceKobo = BigInt(Math.round(exPriceNaira * 100));
      const exRewardKobo = (exPriceKobo * BigInt(80)) / BigInt(100);
      const exCommKobo = exPriceKobo - exRewardKobo;
      const exBaseCostKobo = exPriceKobo * BigInt(exQty);

      tasksToCreate.push({
        taskType: 'existing_user',
        title: cleanTitle ? `${cleanTitle} (Existing Users)` : 'Temu Invitation (Existing Users)',
        link: exLink,
        quantity: exQty,
        pricePerParticipantNaira: exPriceNaira,
        pricePerParticipantKobo: exPriceKobo,
        rewardPerPartKobo: exRewardKobo,
        commPerRefKobo: exCommKobo,
        baseCostKobo: exBaseCostKobo,
      });

      // 2. New user spec
      const nwPriceKobo = BigInt(Math.round(nwPriceNaira * 100));
      const nwRewardKobo = (nwPriceKobo * BigInt(400)) / BigInt(500);
      const nwCommKobo = nwPriceKobo - nwRewardKobo;
      const nwBaseCostKobo = nwPriceKobo * BigInt(nwQty);

      tasksToCreate.push({
        taskType: 'new_user',
        title: cleanTitle ? `${cleanTitle} (New Users)` : 'Temu Invitation (New Users)',
        link: nwLink,
        quantity: nwQty,
        pricePerParticipantNaira: nwPriceNaira,
        pricePerParticipantKobo: nwPriceKobo,
        rewardPerPartKobo: nwRewardKobo,
        commPerRefKobo: nwCommKobo,
        baseCostKobo: nwBaseCostKobo,
      });
    } else {
      // Single task mode
      const qty = parseInt(quantity, 10);
      if (!qty || qty < 1 || qty > 1000) {
        return NextResponse.json(
          { error: 'Quantity must be between 1 and 1,000' },
          { status: 400 }
        );
      }

      const link = (invitationLink || '').trim();
      if (!link.startsWith('https://')) {
        return NextResponse.json(
          { error: 'Valid HTTPS invitation link is required' },
          { status: 400 }
        );
      }

      const singleType = taskType === 'new_user' ? 'new_user' : 'existing_user';
      const recommendedPrice = singleType === 'new_user' ? 500 : 100;
      const minPrice = singleType === 'new_user' ? 100 : 30;
      const priceNaira = Number(customPrice) || recommendedPrice;

      if (priceNaira < minPrice) {
        return NextResponse.json(
          { error: `Price per participant cannot be below ₦${minPrice} for this task type.` },
          { status: 400 }
        );
      }

      const priceKobo = BigInt(Math.round(priceNaira * 100));
      let rewardKobo: bigint;
      let commKobo: bigint;

      if (singleType === 'new_user') {
        rewardKobo = (priceKobo * BigInt(400)) / BigInt(500);
        commKobo = priceKobo - rewardKobo;
      } else {
        rewardKobo = (priceKobo * BigInt(80)) / BigInt(100);
        commKobo = priceKobo - rewardKobo;
      }

      const baseCostKobo = priceKobo * BigInt(qty);

      tasksToCreate.push({
        taskType: singleType,
        title:
          cleanTitle ||
          `Temu Invitation (${singleType === 'new_user' ? 'New User' : 'Existing User'})`,
        link,
        quantity: qty,
        pricePerParticipantNaira: priceNaira,
        pricePerParticipantKobo: priceKobo,
        rewardPerPartKobo: rewardKobo,
        commPerRefKobo: commKobo,
        baseCostKobo,
      });
    }

    // Platform Fee & Premium Promotion Calculation
    const totalBaseCostKobo = tasksToCreate.reduce((sum, t) => sum + t.baseCostKobo, BigInt(0));
    const platformFeeKobo = BigInt(20000); // ₦200 standard platform fee
    const premiumFeeKobo = isPremium ? BigInt(20000) : BigInt(0); // +₦200 if featured
    const totalCostKobo = totalBaseCostKobo + platformFeeKobo + premiumFeeKobo;
    const totalCostNaira = Number(totalCostKobo) / 100;

    const reference = generateRef('TASK-PAY');
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://temutasks.top';

    // =========================================================================
    // OPTION A: DIRECT WALLET BALANCE CHECKOUT
    // =========================================================================
    if (paymentMethod === 'wallet') {
      // 1. Fetch user wallet balance
      const { data: wallet } = await adminSupabase
        .from('temutask_wallets')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      const userBalanceKobo = BigInt(wallet?.balance_kobo || 0);

      if (userBalanceKobo < totalCostKobo) {
        const availableNaira = (Number(userBalanceKobo) / 100).toLocaleString();
        return NextResponse.json(
          {
            error: `Insufficient wallet balance. Total cost is ₦${totalCostNaira.toLocaleString()}, but your available balance is ₦${availableNaira}. Please choose Novac or top up your wallet.`,
          },
          { status: 400 }
        );
      }

      // 2. Atomically debit user wallet
      const debitResult = await executeWalletTransaction({
        userId: user.id,
        amountKobo: totalCostKobo,
        direction: 'debit',
        transactionType: 'task_funding',
        description: `Funded ${
          isCombined
            ? 'Combined Temu Tasks (New & Existing Users)'
            : `${tasksToCreate[0].title}`
        }`,
        relatedId: reference,
        idempotencyKey: `WALLET-TASK-${reference}`,
      });

      if (!debitResult.success) {
        return NextResponse.json(
          { error: debitResult.error || 'Failed to debit wallet balance' },
          { status: 400 }
        );
      }

      // 3. Insert and activate each task directly
      const createdTasks: any[] = [];
      for (const t of tasksToCreate) {
        const fullTitle = `${t.title}|||${instructions}|||${durationHours}|||${expiresAt}`;
        const basePayload: any = {
          user_id: user.id,
          task_type: t.taskType,
          title: fullTitle,
          invitation_link: t.link,
          quantity_requested: t.quantity,
          quantity_approved: 0,
          quantity_reserved: 0,
          reward_per_participant_kobo: t.rewardPerPartKobo.toString(),
          commission_per_referrer_kobo: t.commPerRefKobo.toString(),
          base_cost_kobo: t.baseCostKobo.toString(),
          platform_fee_kobo: platformFeeKobo.toString(),
          premium_fee_kobo: premiumFeeKobo.toString(),
          total_cost_kobo: totalCostKobo.toString(),
          is_premium: !!isPremium,
          status: 'active', // Immediately live!
          payment_reference: reference,
        };

        // Try insert with explicit timer columns first
        let { data: inserted, error: insertErr } = await adminSupabase
          .from('temutask_tasks')
          .insert({
            ...basePayload,
            duration_hours: durationHours,
            expires_at: expiresAt,
          })
          .select()
          .single();

        // If columns do not exist in Supabase schema cache, gracefully insert basePayload
        if (insertErr && (insertErr.message?.includes('duration_hours') || insertErr.code === 'PGRST204')) {
          console.warn('temutask_tasks duration_hours column not in schema cache; inserting base payload with encoded metadata');
          const retry = await adminSupabase
            .from('temutask_tasks')
            .insert(basePayload)
            .select()
            .single();
          inserted = retry.data;
          insertErr = retry.error;
        }

        if (insertErr) {
          console.error('Error inserting task via wallet payment:', insertErr);
        } else if (inserted) {
          createdTasks.push(inserted);
        }
      }

      // If task insertion failed completely, auto-refund wallet balance and return error
      if (createdTasks.length === 0) {
        console.error('Task insertion failed completely for ref:', reference);
        await executeWalletTransaction({
          userId: user.id,
          amountKobo: totalCostKobo,
          direction: 'credit',
          transactionType: 'task_refund',
          description: `Auto-refund: Task creation failed to save (${reference})`,
          relatedId: reference,
          idempotencyKey: `AUTO-REFUND-${reference}`,
        });

        return NextResponse.json(
          {
            error:
              'Failed to publish task to marketplace. Your wallet balance has been automatically refunded.',
          },
          { status: 500 }
        );
      }

      // 4. In-app notification to task creator
      await adminSupabase.from('temutask_notifications').insert({
        user_id: user.id,
        title: 'Task(s) Successfully Published! 🚀',
        message: `Your ${
          isCombined ? '2 combined tasks have' : 'task has'
        } been funded with your wallet balance (₦${totalCostNaira.toLocaleString()}) and published to the marketplace.`,
        type: 'task_published',
        link: '/my-tasks',
      });

      // 5. Send confirmation email via Sendbyte
      if (user.email) {
        const emailHtml = renderEmailTemplate({
          title: 'Task(s) Published Successfully! 🎉',
          contentHtml: `<p>Your task funding of <strong>₦${totalCostNaira.toLocaleString()}.00</strong> from your wallet balance was successful!</p>
          <div style="background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 8px; padding: 14px; margin: 16px 0;">
            ${tasksToCreate
              .map(
                (t) =>
                  `<p style="margin: 6px 0;"><strong>${t.title}:</strong> ${t.quantity} slots @ ₦${t.pricePerParticipantNaira} each (${t.taskType === 'new_user' ? 'New User' : 'Existing User'})</p>`
              )
              .join('')}
            <p style="margin: 6px 0; color: #6B7280; font-size: 12px;"><strong>Instructions:</strong> ${instructions}</p>
            <p style="margin: 6px 0; font-family: monospace; font-size: 12px;">Ref: ${reference}</p>
          </div>
          <p>Participants can now view and submit proof for your tasks.</p>`,
          ctaText: 'View My Tasks',
          ctaUrl: `${appUrl}/my-tasks`,
        });

        try {
          await sendEmail({
            to: user.email,
            subject: `[TemuTasks] ${isCombined ? 'Combined Tasks' : 'Task'} Published Live!`,
            html: emailHtml,
            eventType: 'task_published',
          });
        } catch (e) {
          console.error('Sendbyte task confirmation email error:', e);
        }
      }

      // 6. Notify audience (All Users or Pro Members per platform setting)
      if (createdTasks.length > 0) {
        for (const ct of createdTasks) {
          try {
            await dispatchNewTaskAlerts(ct, appUrl);
          } catch (e) {
            console.error('Error dispatching task alert emails:', e);
          }
        }
      }

      return NextResponse.json({
        success: true,
        method: 'wallet',
        reference,
        isCombined,
        tasksCreated: createdTasks.length,
        message: isCombined
          ? 'Both New and Existing user tasks have been published successfully!'
          : 'Task has been published successfully!',
      });
    }

    // =========================================================================
    // OPTION B: NOVAC PAYMENT GATEWAY CHECKOUT
    // =========================================================================
    const redirectUrl = `${appUrl}/api/payments/novac/callback?ref=${reference}&type=task_creation`;

    const { error: orderError } = await adminSupabase.from('temutask_payment_orders').insert({
      user_id: user.id,
      order_type: 'task_creation',
      amount_kobo: totalCostKobo.toString(),
      reference,
      provider: 'novac',
      status: 'pending',
      related_payload: {
        isCombined,
        instructions,
        isPremium: !!isPremium,
        durationHours,
        expiresAt,
        platformFeeKobo: platformFeeKobo.toString(),
        premiumFeeKobo: premiumFeeKobo.toString(),
        totalCostKobo: totalCostKobo.toString(),
        tasks: tasksToCreate.map((t) => ({
          taskType: t.taskType,
          title: t.title,
          invitationLink: t.link,
          quantity: t.quantity,
          pricePerParticipantNaira: t.pricePerParticipantNaira,
          rewardPerPartKobo: t.rewardPerPartKobo.toString(),
          commPerRefKobo: t.commPerRefKobo.toString(),
          baseCostKobo: t.baseCostKobo.toString(),
        })),
        // Backward-compat fields for single task
        taskType: tasksToCreate[0].taskType,
        quantity: tasksToCreate[0].quantity,
        pricePerParticipantNaira: tasksToCreate[0].pricePerParticipantNaira,
        invitationLink: tasksToCreate[0].link,
        title: tasksToCreate[0].title,
        rewardPerPartKobo: tasksToCreate[0].rewardPerPartKobo.toString(),
        commPerRefKobo: tasksToCreate[0].commPerRefKobo.toString(),
        baseCostKobo: tasksToCreate[0].baseCostKobo.toString(),
      },
    });

    if (orderError) {
      return NextResponse.json({ error: orderError.message }, { status: 400 });
    }

    const description = isCombined
      ? `TemuTasks Combined: ${tasksToCreate[0].quantity} Existing + ${tasksToCreate[1].quantity} New Users`
      : `TemuTasks: ${tasksToCreate[0].quantity} ${
          tasksToCreate[0].taskType === 'new_user' ? 'New' : 'Existing'
        } Participants @ ₦${tasksToCreate[0].pricePerParticipantNaira}`;

    const paymentResult = await initiateNovacPayment({
      amount: totalCostNaira,
      reference,
      email: user.email!,
      redirectUrl,
      description,
    });

    if (!paymentResult.success || !paymentResult.paymentUrl) {
      return NextResponse.json(
        { error: paymentResult.message || 'Failed to initiate checkout with Novac' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      method: 'novac',
      reference,
      paymentUrl: paymentResult.paymentUrl,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}

