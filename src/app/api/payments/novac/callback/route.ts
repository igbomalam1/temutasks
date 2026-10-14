import { createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { verifyNovacPayment } from '@/lib/novac';
import { sendEmail, renderEmailTemplate } from '@/lib/sendbyte';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const reference = url.searchParams.get('ref') || url.searchParams.get('transactionReference') || url.searchParams.get('trxref');
  const type = url.searchParams.get('type') || 'task_creation';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

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

  // Idempotency: If already successful, redirect directly
  if (order.status === 'successful') {
    if (order.order_type === 'task_creation') {
      return NextResponse.redirect(`${appUrl}/my-tasks?msg=Task+already+published`);
    } else {
      return NextResponse.redirect(`${appUrl}/dashboard?msg=Pro+membership+already+active`);
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

  const payload = order.related_payload;

  if (order.order_type === 'task_creation') {
    // Publish the task
    const { data: createdTask, error: taskCreateError } = await supabase
      .from('temutask_tasks')
      .insert({
        user_id: order.user_id,
        task_type: payload.taskType,
        title: payload.title,
        invitation_link: payload.invitationLink,
        quantity_requested: payload.quantity,
        quantity_approved: 0,
        reward_per_participant_kobo: payload.rewardPerPartKobo,
        commission_per_referrer_kobo: payload.commPerRefKobo,
        base_cost_kobo: payload.baseCostKobo,
        platform_fee_kobo: payload.platformFeeKobo,
        premium_fee_kobo: payload.premiumFeeKobo,
        total_cost_kobo: payload.totalCostKobo,
        is_premium: payload.isPremium,
        status: 'active', // Published
        payment_reference: reference,
      })
      .select()
      .single();

    if (taskCreateError) {
      console.error('Error publishing task after payment:', taskCreateError);
      return NextResponse.redirect(`${appUrl}/dashboard?error=Payment+received+but+task+activation+requires+review`);
    }

    // In-app notification to task creator
    await supabase.from('temutask_notifications').insert({
      user_id: order.user_id,
      title: 'Task Successfully Published! 🚀',
      message: `Your task "${payload.title}" is now live in the marketplace. Participants can now complete it.`,
      type: 'task_published',
      link: '/my-tasks',
    });

    // Send confirmation email via Sendbyte
    const userEmail = order.temutask_profiles?.email;
    if (userEmail) {
      const emailHtml = renderEmailTemplate({
        title: 'Task Published Successfully! 🎉',
        contentHtml: `<p>Your payment has been confirmed and your Temu invitation task is now live:</p>
        <p><strong>Task:</strong> ${payload.title}<br>
        <strong>Slots:</strong> ${payload.quantity} participants<br>
        <strong>Type:</strong> ${payload.taskType === 'new_user' ? 'New Temu User' : 'Existing Temu User'}<br>
        <strong>Reference:</strong> ${reference}</p>
        <p>You can track submissions and approve participants from your task dashboard.</p>`,
        ctaText: 'View My Tasks',
        ctaUrl: `${appUrl}/my-tasks`,
      });

      sendEmail({
        to: userEmail,
        subject: `[TemuTasks] Task Published: "${payload.title}"`,
        html: emailHtml,
        eventType: 'task_published',
      }).catch((e) => console.error('Sendbyte email error:', e));
    }

    // Pro Member Task Alert: Send email alert to active opted-in Pro users
    notifyProMembersAboutNewTask(createdTask, appUrl).catch((e) =>
      console.error('Error alerting Pro members:', e)
    );

    return NextResponse.redirect(`${appUrl}/my-tasks?msg=Task+published+successfully`);
  } else if (order.order_type === 'pro_membership') {
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

    return NextResponse.redirect(`${appUrl}/dashboard?msg=Upgraded+to+TemuTasks+Pro`);
  }

  return NextResponse.redirect(`${appUrl}/dashboard`);
}

// Background helper to notify active, opted-in Pro members
async function notifyProMembersAboutNewTask(task: any, appUrl: string) {
  const supabase = createAdminClient();

  // Find active Pro users with task alert notifications enabled
  const { data: proUsers } = await supabase
    .from('temutask_profiles')
    .select('id, email, full_name, pro_expires_at')
    .eq('tier', 'pro')
    .gt('pro_expires_at', new Date().toISOString());

  if (!proUsers || proUsers.length === 0) return;

  for (const user of proUsers) {
    if (user.id === task.user_id) continue; // Don't notify task owner

    const emailHtml = renderEmailTemplate({
      title: 'New Temu Task Available! ⚡',
      contentHtml: `<p>A new task matching your eligibility has just been published on TemuTasks:</p>
      <p><strong>Title:</strong> ${task.title}<br>
      <strong>Reward:</strong> ${task.task_type === 'new_user' ? '₦200.00' : '₦45.00'}<br>
      <strong>Available Slots:</strong> ${task.quantity_requested}</p>
      <p>Hurry and claim your slot before it reaches full capacity!</p>`,
      ctaText: 'Do Task Now',
      ctaUrl: `${appUrl}/tasks`,
    });

    await sendEmail({
      to: user.email,
      subject: `[TemuTasks Pro Alert] New task: "${task.title}"`,
      html: emailHtml,
      eventType: 'pro_task_alert',
    });
  }
}
