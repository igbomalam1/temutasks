export const dynamic = 'force-dynamic';
import { createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { verifyNovacPayment } from '@/lib/novac';
import { executeWalletTransaction } from '@/lib/wallet';
import { sendEmail, renderEmailTemplate } from '@/lib/sendbyte';
import { dispatchNewTaskAlerts } from '@/lib/task-notifications';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const reference = url.searchParams.get('ref') || url.searchParams.get('transactionReference') || url.searchParams.get('trxref');
  const type = url.searchParams.get('type') || 'task_creation';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://temutasks.top';

  if (!reference) {
    return NextResponse.redirect(`${appUrl}/dashboard?error=Missing+payment+reference`);
  }

  const supabase = createAdminClient();

  // Find payment order
  const { data: order } = await supabase
    .from('temutask_payment_orders')
    .select('*, temutask_profiles!user_id(email, full_name)')
    .eq('reference', reference)
    .maybeSingle();

  if (!order) {
    return NextResponse.redirect(`${appUrl}/dashboard?error=Payment+order+not+found`);
  }

  const payload = order.related_payload || {};
  const effectiveType = payload.order_type || payload.orderType || type || order.order_type;

  // Idempotency: If already successful, redirect directly
  if (order.status === 'successful') {
    if (effectiveType === 'task_creation') {
      return NextResponse.redirect(`${appUrl}/my-tasks?msg=Task+already+published`);
    } else if (effectiveType === 'pro_membership') {
      return NextResponse.redirect(`${appUrl}/dashboard?msg=Pro+membership+already+active`);
    } else if (effectiveType === 'wallet_deposit') {
      return NextResponse.redirect(`${appUrl}/wallet?msg=Deposit+already+credited`);
    } else if (effectiveType === 'task_reward_topup') {
      return NextResponse.redirect(`${appUrl}/my-tasks?msg=Task+reward+already+updated`);
    }
  }

  // Verify directly with Novac
  const verifyResult = await verifyNovacPayment(reference);

  if (!verifyResult.success || verifyResult.status !== 'successful') {
    await supabase
      .from('temutask_payment_orders')
      .update({ status: 'failed' })
      .eq('reference', reference);

    return NextResponse.redirect(
      `${appUrl}/dashboard?error=${encodeURIComponent(verifyResult.message || 'Payment verification failed')}`
    );
  }

  // Payment confirmed successful!
  await supabase
    .from('temutask_payment_orders')
    .update({ status: 'successful', verified_at: new Date().toISOString() })
    .eq('reference', reference);

  if (effectiveType === 'task_creation') {
    // Publish task(s) - supports both single and combined tasks
    const isCombined = payload.isCombined && Array.isArray(payload.tasks);
    const instructions = payload.instructions || '';
    const tasksToInsert = isCombined
      ? payload.tasks
      : [
          {
            taskType: payload.taskType,
            title: payload.title,
            invitationLink: payload.invitationLink,
            quantity: payload.quantity,
            rewardPerPartKobo: payload.rewardPerPartKobo,
            commPerRefKobo: payload.commPerRefKobo,
            baseCostKobo: payload.baseCostKobo,
          },
        ];

    const createdTasks: any[] = [];
    const durationHours = payload.durationHours || 24;
    const expiresAt = payload.expiresAt || new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString();

    for (const t of tasksToInsert) {
      const fullTitle = `${t.title}|||${instructions}|||${durationHours}|||${expiresAt}`;
      const basePayload: any = {
        user_id: order.user_id,
        task_type: t.taskType,
        title: fullTitle,
        invitation_link: t.invitationLink,
        quantity_requested: t.quantity,
        quantity_approved: 0,
        reward_per_participant_kobo: t.rewardPerPartKobo,
        commission_per_referrer_kobo: t.commPerRefKobo,
        base_cost_kobo: t.baseCostKobo,
        platform_fee_kobo: payload.platformFeeKobo,
        premium_fee_kobo: payload.premiumFeeKobo,
        total_cost_kobo: payload.totalCostKobo,
        is_premium: !!payload.isPremium,
        status: 'active', // Published
        payment_reference: reference,
      };

      let { data: createdTask, error: taskCreateError } = await supabase
        .from('temutask_tasks')
        .insert({
          ...basePayload,
          duration_hours: durationHours,
          expires_at: expiresAt,
        })
        .select()
        .single();

      if (taskCreateError && (taskCreateError.message?.includes('duration_hours') || taskCreateError.code === 'PGRST204')) {
        console.warn('temutask_tasks duration_hours column not in schema cache; inserting base payload');
        const retry = await supabase
          .from('temutask_tasks')
          .insert(basePayload)
          .select()
          .single();
        createdTask = retry.data;
        taskCreateError = retry.error;
      }

      if (taskCreateError) {
        console.error('Error publishing task after payment:', taskCreateError);
      } else if (createdTask) {
        createdTasks.push(createdTask);
      }
    }

    if (createdTasks.length === 0) {
      return NextResponse.redirect(
        `${appUrl}/dashboard?error=Payment+received+but+task+activation+failed`
      );
    }

    // In-app notification to task creator
    await supabase.from('temutask_notifications').insert({
      user_id: order.user_id,
      title: 'Task(s) Successfully Published! 🚀',
      message: `Your ${
        isCombined ? '2 combined tasks have' : 'task has'
      } been published live to the marketplace.`,
      type: 'task_published',
      link: '/my-tasks',
    });

    // Send confirmation email via Sendbyte
    const userEmail = order.temutask_profiles?.email;
    if (userEmail) {
      const emailHtml = renderEmailTemplate({
        title: 'Task(s) Published Successfully! 🎉',
        contentHtml: `<p>Your payment has been confirmed and your Temu invitation ${
          isCombined ? 'tasks are' : 'task is'
        } now live:</p>
        <p><strong>Tasks Published:</strong> ${createdTasks.length}<br>
        <strong>Reference:</strong> ${reference}</p>
        <p>You can track submissions and approve participants from your task dashboard.</p>`,
        ctaText: 'View My Tasks',
        ctaUrl: `${appUrl}/my-tasks`,
      });

      try {
        await sendEmail({
          to: userEmail,
          subject: `[TemuTasks] ${isCombined ? 'Combined Tasks' : 'Task'} Published Live!`,
          html: emailHtml,
          eventType: 'task_published',
        });
      } catch (e) {
        console.error('Sendbyte email error:', e);
      }
    }

    // Task Alert: Send email alert to audience (All Users or Pro Only based on admin setting)
    for (const ct of createdTasks) {
      try {
        await dispatchNewTaskAlerts(ct, appUrl);
      } catch (e) {
        console.error('Error dispatching task alert emails:', e);
      }
    }

    return NextResponse.redirect(`${appUrl}/my-tasks?msg=Task+published+successfully`);
  } else if (effectiveType === 'pro_membership') {
    // Activate Pro membership
    const startsAt = new Date();
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 days

    await supabase
      .from('temutask_profiles')
      .update({
        tier: 'pro',
        pro_expires_at: expiresAt.toISOString(),
      })
      .eq('id', order.user_id);

    await supabase.from('temutask_pro_memberships').insert({
      user_id: order.user_id,
      payment_method: 'novac',
      amount_kobo: order.amount_kobo,
      reference,
      starts_at: startsAt.toISOString(),
      expires_at: expiresAt.toISOString(),
      status: 'active',
    });

    // Enable task alerts
    await supabase.from('temutask_notification_preferences').upsert({
      user_id: order.user_id,
      email_task_alerts: true,
    });

    const userEmail = order.temutask_profiles?.email;
    if (userEmail) {
      const proEmailHtml = renderEmailTemplate({
        title: 'Welcome to TemuTasks Pro! ⭐',
        contentHtml: `<p>Congratulations! Your payment for <strong>TemuTasks Pro</strong> (14 Days) was received successfully.</p>
        <p><strong>Expiry Date:</strong> ${expiresAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}<br>
        <strong>Payment Gateway:</strong> Novac<br>
        <strong>Reference:</strong> ${reference}</p>
        <p><strong>Pro Privileges Unlocked:</strong></p>
        <ul>
          <li><strong>Batch Submissions:</strong> Pro users can submit multiple tasks at once and earn for all</li>
          <li><strong>Instant Task Alerts:</strong> Receive immediate email notifications whenever tasks are posted</li>
          <li><strong>Priority Clearance:</strong> Fastest approval during nightly clearance rounds</li>
          <li><strong>Pro Verified Badge</strong> on your profile and dashboard</li>
        </ul>`,
        ctaText: 'Access Dashboard',
        ctaUrl: `${appUrl}/dashboard`,
      });

      sendEmail({
        to: userEmail,
        subject: `[TemuTasks Pro] Welcome to Pro Membership! ⭐`,
        html: proEmailHtml,
        eventType: 'pro_upgrade_novac',
      }).catch((e) => console.error('Error sending pro email via novac callback:', e));
    }

    return NextResponse.redirect(`${appUrl}/dashboard?msg=Upgraded+to+TemuTasks+Pro`);
  } else if (effectiveType === 'wallet_deposit') {
    const amountKobo = BigInt(order.amount_kobo);
    const amountNaira = Number(amountKobo) / 100;

    // Credit user wallet atomically with immutable ledger record
    await executeWalletTransaction({
      userId: order.user_id,
      amountKobo,
      direction: 'credit',
      transactionType: 'wallet_deposit',
      description: `Wallet deposit via Novac (${reference})`,
      relatedId: reference,
      idempotencyKey: `DEP-${reference}`,
    });

    // In-app notification
    await supabase.from('temutask_notifications').insert({
      user_id: order.user_id,
      title: 'Wallet Deposit Credited 💰',
      message: `₦${amountNaira.toLocaleString()} has been added to your wallet balance. Reference: ${reference}.`,
      type: 'wallet_deposit',
      link: '/wallet',
    });

    // Send confirmation email
    const userEmail = order.temutask_profiles?.email;
    if (userEmail) {
      const emailHtml = renderEmailTemplate({
        title: 'Wallet Deposit Confirmed 💰',
        contentHtml: `<p>Your payment via Novac was confirmed and your TemuTasks wallet has been credited:</p>
        <p><strong>Amount Credited:</strong> ₦${amountNaira.toLocaleString()}.00<br>
        <strong>Payment Gateway:</strong> Novac<br>
        <strong>Reference:</strong> ${reference}</p>
        <p>Your new balance is available immediately for airtime top-up, creating tasks, or upgrading to Pro.</p>`,
        ctaText: 'View Wallet Balance',
        ctaUrl: `${appUrl}/wallet`,
      });

      sendEmail({
        to: userEmail,
        subject: `[TemuTasks] Wallet Credited: ₦${amountNaira.toLocaleString()} (Deposit)`,
        html: emailHtml,
        eventType: 'wallet_deposit_confirmation',
      }).catch((e) => console.error('Sendbyte deposit email error:', e));
    }

    return NextResponse.redirect(`${appUrl}/wallet?msg=Deposit+of+₦${amountNaira.toLocaleString()}+successful`);
  } else if (effectiveType === 'task_reward_topup') {
    const { taskId, newRewardKobo, newCommKobo, newBaseCostKobo, newTotalCostKobo, newPrice, topupNaira } = payload;

    await supabase
      .from('temutask_tasks')
      .update({
        reward_per_participant_kobo: newRewardKobo,
        commission_per_referrer_kobo: newCommKobo,
        base_cost_kobo: newBaseCostKobo,
        total_cost_kobo: newTotalCostKobo,
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId);

    // In-app notification
    await supabase.from('temutask_notifications').insert({
      user_id: order.user_id,
      title: 'Task Reward Increased! 🚀',
      message: `Your task price was successfully increased to ₦${newPrice}. Top-up payment of ₦${topupNaira} confirmed via Novac.`,
      type: 'task_reward_increased',
      link: '/my-tasks',
    });

    return NextResponse.redirect(`${appUrl}/my-tasks?msg=Task+reward+increased+successfully`);
  }

  return NextResponse.redirect(`${appUrl}/dashboard`);
}
