import { createAdminClient } from '@/lib/supabase/server';
import { sendEmail, renderEmailTemplate } from '@/lib/sendbyte';

export type TaskEmailAudience = 'all' | 'pro_only';

/**
 * Returns current audience setting for new task email notifications.
 * Defaults to 'all' (broadcast to all registered users).
 */
export async function getTaskEmailAudience(): Promise<TaskEmailAudience> {
  const supabase = createAdminClient();
  try {
    const { data: latestLog } = await supabase
      .from('temutask_admin_audit_logs')
      .select('details')
      .eq('action', 'set_task_email_audience')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestLog?.details?.audience === 'pro_only') {
      return 'pro_only';
    }
  } catch (err) {
    console.error('Error fetching task email audience setting:', err);
  }
  return 'all';
}

/**
 * Sets the audience for task email notifications.
 */
export async function setTaskEmailAudience(
  audience: TaskEmailAudience,
  adminId?: string
): Promise<void> {
  const supabase = createAdminClient();
  await supabase.from('temutask_admin_audit_logs').insert({
    admin_id: adminId || null,
    action: 'set_task_email_audience',
    target_type: 'platform_settings',
    target_id: 'task_email_audience',
    details: { audience, updated_at: new Date().toISOString() },
  });
}

/**
 * Dispatches email alerts to either All Users or Pro Users based on platform setting.
 */
export async function dispatchNewTaskAlerts(
  task: any,
  appUrl: string,
  forcedAudience?: TaskEmailAudience
): Promise<{ count: number; audience: TaskEmailAudience }> {
  const supabase = createAdminClient();
  const audience = forcedAudience || (await getTaskEmailAudience());

  let targetUsers: any[] = [];

  if (audience === 'pro_only') {
    const { data: proUsers } = await supabase
      .from('temutask_profiles')
      .select('id, email, full_name, pro_expires_at, status')
      .eq('tier', 'pro')
      .neq('status', 'suspended');

    const now = new Date();
    targetUsers = (proUsers || []).filter((u: any) => {
      if (!u.email) return false;
      if (!u.pro_expires_at) return true;
      return new Date(u.pro_expires_at) > now;
    });
  } else {
    // All registered users
    const { data: allUsers } = await supabase
      .from('temutask_profiles')
      .select('id, email, full_name, status')
      .neq('status', 'suspended');

    targetUsers = (allUsers || []).filter((u: any) => Boolean(u.email));
  }

  if (targetUsers.length === 0) {
    return { count: 0, audience };
  }

  // Check notification preferences for explicit opt-outs
  const { data: prefs } = await supabase
    .from('temutask_notification_preferences')
    .select('user_id, email_task_alerts')
    .in('user_id', targetUsers.map((u: any) => u.id));

  const prefMap = new Map((prefs || []).map((p: any) => [p.user_id, p.email_task_alerts]));

  const rewardNaira = (Number(task.reward_per_participant_kobo || 0) / 100).toLocaleString();
  const taskTitle = task.title ? task.title.split('|||')[0].trim() : 'Temu Task';

  const sendPromises = targetUsers.map(async (user: any) => {
    // If explicitly disabled (false), skip
    if (prefMap.get(user.id) === false) return;

    const emailHtml = renderEmailTemplate({
      title: 'New Temu Task Available! ⚡',
      contentHtml: `<p>Hello ${user.full_name || 'TemuTasks Member'},</p>
      <p>A new high-paying task has just been published on TemuTasks:</p>
      <div style="background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 8px; padding: 14px; margin: 16px 0;">
        <p style="margin: 4px 0;"><strong>Task:</strong> ${taskTitle}</p>
        <p style="margin: 4px 0;"><strong>Reward:</strong> ₦${rewardNaira}</p>
        <p style="margin: 4px 0;"><strong>Available Slots:</strong> ${task.quantity_requested}</p>
        <p style="margin: 4px 0;"><strong>Type:</strong> ${task.task_type === 'new_user' ? 'New User Invitation' : 'Existing User Invitation'}</p>
      </div>
      <p>Slots are limited! Open the invite link in your Temu app, complete the step, and submit your proof screenshot to claim your cash reward.</p>`,
      ctaText: 'Do Task Now',
      ctaUrl: `${appUrl}/tasks`,
    });

    try {
      await sendEmail({
        to: user.email,
        subject: `[TemuTasks Alert] ⚡ New Task: "${taskTitle}" (Earn ₦${rewardNaira})`,
        html: emailHtml,
        eventType: 'new_task_alert',
      });
    } catch (e) {
      console.error(`Failed to dispatch task alert to ${user.email}:`, e);
    }
  });

  await Promise.allSettled(sendPromises);
  return { count: targetUsers.length, audience };
}
