export const dynamic = 'force-dynamic';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { sendEmail, renderEmailTemplate } from '@/lib/sendbyte';

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const adminSupabase = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { taskId, taskIds, temuUsername, temuEmail, proofUrl } = body;

    if (!temuUsername?.trim() || !temuEmail?.trim()) {
      return NextResponse.json(
        { error: 'Please provide both your Temu username and Temu email.' },
        { status: 400 }
      );
    }

    if (!proofUrl?.trim() || typeof proofUrl !== 'string') {
      return NextResponse.json(
        { error: 'Please upload a screenshot from your Temu app proving task completion.' },
        { status: 400 }
      );
    }

    // Fetch participant profile to verify Pro status (for multi-task submission) and referrer
    const { data: participantProfile } = await adminSupabase
      .from('temutask_profiles')
      .select('tier, pro_expires_at, referred_by, status')
      .eq('id', user.id)
      .single();

    if (participantProfile?.status === 'suspended') {
      return NextResponse.json(
        { error: 'Your account is restricted from submitting tasks.' },
        { status: 403 }
      );
    }

    const isProActive =
      participantProfile?.tier === 'pro' &&
      (!participantProfile?.pro_expires_at ||
        new Date(participantProfile.pro_expires_at) > new Date());

    // Normalize into an array of task IDs
    const requestedTaskIds: string[] = Array.isArray(taskIds)
      ? Array.from(new Set(taskIds.filter(Boolean)))
      : taskId
      ? [taskId]
      : [];

    if (requestedTaskIds.length === 0) {
      return NextResponse.json({ error: 'Please select at least one task.' }, { status: 400 });
    }

    // Enforce Pro-only multi-task batch submission benefit
    if (requestedTaskIds.length > 1 && !isProActive) {
      return NextResponse.json(
        {
          error:
            'Only Pro members can submit multiple tasks at once and earn for all! Please upgrade to Pro (₦200 / 14 days) or submit tasks one at a time.',
        },
        { status: 403 }
      );
    }

    // Fetch all requested tasks
    const { data: tasks, error: taskError } = await adminSupabase
      .from('temutask_tasks')
      .select('*, temutask_profiles!user_id(email, tier)')
      .in('id', requestedTaskIds);

    if (taskError || !tasks || tasks.length === 0) {
      return NextResponse.json({ error: 'Selected task(s) not found' }, { status: 404 });
    }

    // Check which tasks this participant has already submitted
    const { data: existingSubs } = await adminSupabase
      .from('temutask_submissions')
      .select('task_id')
      .in('task_id', requestedTaskIds)
      .eq('participant_id', user.id);

    const alreadySubmittedSet = new Set((existingSubs || []).map((s) => s.task_id));

    const referrerId = participantProfile?.referred_by || null;
    const createdSubmissions: any[] = [];
    const invitationLinks: { taskId: string; title: string; link: string; rewardKobo: string }[] = [];
    const skippedReasons: string[] = [];
    let totalPotentialRewardKobo = BigInt(0);

    for (const task of tasks) {
      if (task.status !== 'active') {
        skippedReasons.push(`"${task.title}" is no longer active.`);
        continue;
      }

      if (task.user_id === user.id) {
        skippedReasons.push(`"${task.title}" is your own task.`);
        continue;
      }

      if (task.quantity_approved >= task.quantity_requested) {
        skippedReasons.push(`"${task.title}" has reached its maximum participant capacity.`);
        continue;
      }

      if (alreadySubmittedSet.has(task.id)) {
        skippedReasons.push(`You already submitted for "${task.title}".`);
        continue;
      }

      const rewardKobo = BigInt(task.reward_per_participant_kobo);
      const commissionKobo = BigInt(task.commission_per_referrer_kobo);

      const insertPayload: any = {
        task_id: task.id,
        participant_id: user.id,
        temu_username: temuUsername.trim(),
        temu_email: temuEmail.trim(),
        status: 'pending_review',
        reward_kobo: rewardKobo.toString(),
        commission_kobo: commissionKobo.toString(),
        referrer_id: referrerId,
        proof_url: proofUrl.trim(),
      };

      let { data: newSub, error: subError } = await adminSupabase
        .from('temutask_submissions')
        .insert(insertPayload)
        .select()
        .single();

      // Defensive fallback if proof_url column is not yet migrated in database
      if (subError && (subError.code === '42703' || subError.message?.includes('proof_url'))) {
        delete insertPayload.proof_url;
        insertPayload.decline_reason = `[Proof Screenshot]: ${proofUrl.trim()}`;
        const retry = await adminSupabase
          .from('temutask_submissions')
          .insert(insertPayload)
          .select()
          .single();
        newSub = retry.data;
        subError = retry.error;
      }

      if (subError || !newSub) {
        skippedReasons.push(`Could not submit "${task.title}": ${subError?.message || 'Error'}`);
        continue;
      }

      createdSubmissions.push(newSub);
      totalPotentialRewardKobo += rewardKobo;
      invitationLinks.push({
        taskId: task.id,
        title: task.title,
        link: task.invitation_link,
        rewardKobo: rewardKobo.toString(),
      });

      // In-app notification to task owner
      await adminSupabase.from('temutask_notifications').insert({
        user_id: task.user_id,
        title: 'New Task Submission for Review',
        message: `Participant "${temuUsername.trim()}" submitted for your task "${task.title}" with proof screenshot. Please verify on Temu and approve or decline.`,
        type: 'task_submission',
        link: '/my-tasks',
      });

      // Send email alert to Pro owner if applicable
      const owner = task.temutask_profiles;
      if (owner && owner.tier === 'pro' && owner.email) {
        const emailHtml = renderEmailTemplate({
          title: 'New Participant Submission 📋',
          contentHtml: `<p>A participant has completed and submitted your Temu task:</p>
          <p><strong>Task:</strong> ${task.title}<br>
          <strong>Temu Username:</strong> ${temuUsername.trim()}<br>
          <strong>Temu Email:</strong> ${temuEmail.trim()}<br>
          <strong>Proof of Completion:</strong> <a href="${proofUrl.trim()}" target="_blank" rel="noopener noreferrer">View Screenshot</a></p>
          <p>Please log in to your TemuTasks dashboard to review and approve the submission.</p>`,
          ctaText: 'Review Submission',
          ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://temutasks.top'}/my-tasks`,
        });

        sendEmail({
          to: owner.email,
          subject: `[TemuTasks] New submission for "${task.title}"`,
          html: emailHtml,
          eventType: 'owner_submission_alert',
        }).catch((e) => console.error('Sendbyte error notifying owner:', e));
      }
    }

    if (createdSubmissions.length === 0) {
      return NextResponse.json(
        {
          error:
            skippedReasons.length > 0
              ? skippedReasons.join(' ')
              : 'No eligible tasks could be submitted.',
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      count: createdSubmissions.length,
      totalPotentialRewardKobo: totalPotentialRewardKobo.toString(),
      submissions: createdSubmissions,
      invitationLinks,
      skippedReasons,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
