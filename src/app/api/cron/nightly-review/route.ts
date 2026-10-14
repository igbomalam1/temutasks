import { createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { executeWalletTransaction } from '@/lib/wallet';
import { sendEmail, renderEmailTemplate } from '@/lib/sendbyte';

/**
 * Scheduled Nightly Admin Review Route
 * Default: Africa/Lagos 11:00 PM cutoff
 * Auto-approves unreviewed submissions that satisfy platform eligibility rules
 */
export async function POST(request: Request) {
  try {
    const adminSupabase = createAdminClient();

    // Check optional bearer token authorization for cron
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || 'temutask_nightly_cron_key';
    if (authHeader && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized cron runner' }, { status: 401 });
    }

    // Fetch platform review settings
    const { data: settings } = await adminSupabase
      .from('temutask_platform_settings')
      .select('*')
      .eq('id', 'default')
      .single();

    if (settings?.maintenance_mode) {
      return NextResponse.json({ message: 'System in maintenance mode. Skipping auto review.' });
    }

    // Find all pending submissions that are NOT under dispute or decline
    // and belong to active tasks
    const { data: pendingSubs, error: subsError } = await adminSupabase
      .from('temutask_submissions')
      .select('*, temutask_tasks!task_id(*), temutask_profiles!participant_id(email, full_name)')
      .eq('status', 'pending_review');

    if (subsError) {
      return NextResponse.json({ error: subsError.message }, { status: 500 });
    }

    let approvedCount = 0;
    const errors: any[] = [];

    for (const sub of pendingSubs || []) {
      const task = sub.temutask_tasks;

      // Skip if task is not active or capacity already reached
      if (!task || task.status !== 'active' || task.quantity_approved >= task.quantity_requested) {
        continue;
      }

      const rewardKobo = BigInt(sub.reward_kobo);
      const commKobo = BigInt(sub.commission_kobo);
      const participantId = sub.participant_id;
      const referrerId = sub.referrer_id;

      try {
        // 1. Credit participant reward atomically
        const rewardResult = await executeWalletTransaction({
          userId: participantId,
          amountKobo: rewardKobo,
          direction: 'credit',
          transactionType: 'reward',
          description: `Nightly Auto-Approval Reward: ${task.title}`,
          relatedId: sub.id,
          idempotencyKey: `AUTO-REWARD-${sub.id}`,
        });

        if (!rewardResult.success) {
          errors.push({ subId: sub.id, error: rewardResult.error });
          continue;
        }

        // 2. Commission allocation
        if (referrerId && commKobo > BigInt(0)) {
          await executeWalletTransaction({
            userId: referrerId,
            amountKobo: commKobo,
            direction: 'credit',
            transactionType: 'commission',
            description: `Lifetime referral commission (Nightly Review) for task "${task.title}"`,
            relatedId: sub.id,
            idempotencyKey: `AUTO-COMM-${sub.id}`,
          });
        } else if (commKobo > BigInt(0)) {
          // Record unallocated platform commission
          await adminSupabase.from('temutask_wallet_ledger').insert({
            user_id: null,
            transaction_type: 'platform_commission',
            amount_kobo: commKobo.toString(),
            direction: 'credit',
            balance_before_kobo: '0',
            balance_after_kobo: '0',
            reference: `AUTO-PLATCOMM-${sub.id}`,
            related_id: sub.id,
            description: `Nightly auto-clear unallocated referral commission for task "${task.title}"`,
          });
        }

        // 3. Mark as auto-approved
        await adminSupabase
          .from('temutask_submissions')
          .update({
            status: 'auto_approved',
            reviewed_at: new Date().toISOString(),
          })
          .eq('id', sub.id);

        // 4. Update task capacity
        const newApproved = (task.quantity_approved || 0) + 1;
        await adminSupabase
          .from('temutask_tasks')
          .update({
            quantity_approved: newApproved,
            status: newApproved >= task.quantity_requested ? 'completed' : 'active',
          })
          .eq('id', task.id);

        // 5. In-app notification
        await adminSupabase.from('temutask_notifications').insert({
          user_id: participantId,
          title: 'Nightly Review Approval! 🎉',
          message: `Your submission for task "${task.title}" was cleared and credited by nightly admin review.`,
          type: 'submission_approved',
          link: '/wallet',
        });

        // 6. Send approval email to participant
        const participantEmail = sub.temutask_profiles?.email;
        if (participantEmail) {
          const emailHtml = renderEmailTemplate({
            title: 'Task Approved! (Nightly Review Clearance) 🎉',
            contentHtml: `<p>Good news! Your submission for <strong>${task.title}</strong> was automatically cleared by nightly admin review.</p>
            <p><strong>Reward Credited:</strong> ₦${(Number(rewardKobo) / 100).toFixed(2)}<br>
            <strong>Reference:</strong> ${rewardResult.reference}</p>
            <p>Your wallet has been credited and is available for instant airtime or withdrawal.</p>`,
            ctaText: 'View Wallet Balance',
            ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://temutasks.top'}/wallet`,
          });

          sendEmail({
            to: participantEmail,
            subject: `[TemuTasks] Task Approved! ₦${(Number(rewardKobo) / 100).toFixed(2)} Credited`,
            html: emailHtml,
            eventType: 'nightly_auto_approval',
          }).catch((e) => console.error('Nightly review email error:', e));
        }

        approvedCount++;
      } catch (err: any) {
        errors.push({ subId: sub.id, error: err.message });
      }
    }

    return NextResponse.json({
      success: true,
      processed: pendingSubs?.length || 0,
      autoApproved: approvedCount,
      errors,
      executedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return POST(request);
}
