export const dynamic = 'force-dynamic';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { executeWalletTransaction } from '@/lib/wallet';
import { sendEmail, renderEmailTemplate } from '@/lib/sendbyte';

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const adminSupabase = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { submissionId, action, reason } = await request.json();

    if (!submissionId || !action || !['approve', 'decline'].includes(action)) {
      return NextResponse.json({ error: 'Invalid review payload' }, { status: 400 });
    }

    // Load submission & verify ownership of parent task
    const { data: sub, error: subError } = await adminSupabase
      .from('temutask_submissions')
      .select('*, temutask_tasks!task_id(*), temutask_profiles!participant_id(email, full_name)')
      .eq('id', submissionId)
      .maybeSingle();

    if (subError || !sub) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    const task = sub.temutask_tasks;

    // Check if requester is owner of the task or admin
    const { data: requesterProfile } = await adminSupabase
      .from('temutask_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const isAdmin = requesterProfile?.role === 'admin' || requesterProfile?.role === 'moderator';

    if (task.user_id !== user.id && !isAdmin) {
      return NextResponse.json({ error: 'You are not authorized to review this task submission' }, { status: 403 });
    }

    if (sub.status !== 'pending_review' && sub.status !== 'declined_disputed') {
      return NextResponse.json({ error: `Submission has already been resolved (${sub.status})` }, { status: 400 });
    }

    // DECLINE FLOW
    if (action === 'decline') {
      await adminSupabase
        .from('temutask_submissions')
        .update({
          status: 'declined_disputed',
          decline_reason: reason || 'Task owner declined submission',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', submissionId);

      // Notify participant
      await adminSupabase.from('temutask_notifications').insert({
        user_id: sub.participant_id,
        title: 'Submission Declined — Pending Admin Review',
        message: `Your submission for task "${task.title}" was declined by the owner with reason: "${reason || 'Unspecified'}". Our admin team will verify it during nightly reviews.`,
        type: 'submission_declined',
        link: '/tasks',
      });

      return NextResponse.json({ success: true, status: 'declined_disputed' });
    }

    // APPROVE FLOW
    if (action === 'approve') {
      const rewardKobo = BigInt(sub.reward_kobo);
      const commKobo = BigInt(sub.commission_kobo);
      const participantId = sub.participant_id;
      const referrerId = sub.referrer_id;

      // 1. Credit participant reward atomically to wallet and immutable ledger
      const rewardResult = await executeWalletTransaction({
        userId: participantId,
        amountKobo: rewardKobo,
        direction: 'credit',
        transactionType: 'reward',
        description: `Reward for completing Temu task: ${task.title}`,
        relatedId: sub.id,
        idempotencyKey: `REWARD-${sub.id}`,
      });

      if (!rewardResult.success) {
        return NextResponse.json({ error: `Reward credit failed: ${rewardResult.error}` }, { status: 500 });
      }

      // 2. Lifetime Referral Commission allocation
      if (referrerId && commKobo > BigInt(0)) {
        await executeWalletTransaction({
          userId: referrerId,
          amountKobo: commKobo,
          direction: 'credit',
          transactionType: 'commission',
          description: `Lifetime referral commission from ${sub.temu_username} on task "${task.title}"`,
          relatedId: sub.id,
          idempotencyKey: `COMM-${sub.id}`,
        });

        // Notify referrer
        await adminSupabase.from('temutask_notifications').insert({
          user_id: referrerId,
          title: 'Referral Commission Earned! 💰',
          message: `You just earned referral commission from a task completed by your referred friend.`,
          type: 'referral_commission',
          link: '/referrals',
        });
      } else if (commKobo > BigInt(0)) {
        // Record explicit unallocated platform commission
        await adminSupabase.from('temutask_wallet_ledger').insert({
          user_id: null,
          transaction_type: 'platform_commission',
          amount_kobo: commKobo.toString(),
          direction: 'credit',
          balance_before_kobo: '0',
          balance_after_kobo: '0',
          reference: `PLATCOMM-${sub.id}`,
          related_id: sub.id,
          description: `Unallocated referral commission captured as platform earnings for task "${task.title}"`,
        });
      }

      // 3. Mark submission approved
      await adminSupabase
        .from('temutask_submissions')
        .update({
          status: 'approved',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', submissionId);

      // 4. Increment task approved count
      const updatedApproved = (task.quantity_approved || 0) + 1;
      const isCompleted = updatedApproved >= task.quantity_requested;

      await adminSupabase
        .from('temutask_tasks')
        .update({
          quantity_approved: updatedApproved,
          status: isCompleted ? 'completed' : 'active',
        })
        .eq('id', task.id);

      // 5. Notify participant via In-App Notification and Email
      await adminSupabase.from('temutask_notifications').insert({
        user_id: participantId,
        title: 'Task Approved! Reward Credited 🎉',
        message: `Your submission for task "${task.title}" was approved. Your wallet has been credited with ${rewardResult.reference}.`,
        type: 'submission_approved',
        link: '/wallet',
      });

      const participantEmail = sub.temutask_profiles?.email;
      if (participantEmail) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://temutasks.top';
        const emailHtml = renderEmailTemplate({
          title: 'Task Approved & Reward Credited! 💵',
          contentHtml: `<p>Congratulations! Your Temu task submission has been approved:</p>
          <p><strong>Task:</strong> ${task.title}<br>
          <strong>Reward Credited:</strong> ₦${(Number(rewardKobo) / 100).toFixed(2)}<br>
          <strong>Transaction Ref:</strong> ${rewardResult.reference}</p>
          <p>Your wallet balance has been updated immediately and is available for airtime top-up or withdrawal.</p>`,
          ctaText: 'Open Wallet',
          ctaUrl: `${appUrl}/wallet`,
        });

        sendEmail({
          to: participantEmail,
          subject: `[TemuTasks] Reward Credited for "${task.title}"`,
          html: emailHtml,
          eventType: 'submission_approved',
        }).catch((e) => console.error('Sendbyte error notifying participant:', e));
      }

      return NextResponse.json({ success: true, status: 'approved' });
    }

    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
