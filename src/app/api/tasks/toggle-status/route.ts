import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
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

    const { taskId, action } = await request.json();
    if (!taskId) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 });
    }

    const { data: task, error: fetchErr } = await adminSupabase
      .from('temutask_tasks')
      .select('*')
      .eq('id', taskId)
      .maybeSingle();

    if (fetchErr || !task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    if (task.user_id !== user.id) {
      return NextResponse.json(
        { error: 'You are not authorized to modify this task' },
        { status: 403 }
      );
    }

    // Action 1: STOP / END TASK
    if (action === 'stop') {
      if (task.status === 'cancelled') {
        return NextResponse.json(
          { error: 'This task has already been ended.' },
          { status: 400 }
        );
      }

      // Count pending submissions awaiting review for this task
      const { count: pendingCount } = await adminSupabase
        .from('temutask_submissions')
        .select('*', { count: 'exact', head: true })
        .eq('task_id', taskId)
        .eq('status', 'pending_review');

      const approved = Number(task.quantity_approved || 0);
      const pending = Number(pendingCount || 0);
      const unallocatedSlots = Math.max(0, Number(task.quantity_requested) - approved - pending);

      let refundMessage = '';
      if (unallocatedSlots > 0) {
        const slotRewardKobo = BigInt(task.reward_per_participant_kobo || 0);
        const slotCommKobo = BigInt(task.commission_per_referrer_kobo || 0);
        const unitSlotCostKobo = slotRewardKobo + slotCommKobo;
        const totalRefundKobo = BigInt(unallocatedSlots) * unitSlotCostKobo;

        if (totalRefundKobo > BigInt(0)) {
          const refundResult = await executeWalletTransaction({
            userId: user.id,
            amountKobo: totalRefundKobo,
            direction: 'credit',
            transactionType: 'admin_adjustment',
            description: `Refund for ${unallocatedSlots} unallocated slot(s) after stopping task "${task.title}"`,
            metadata: {
              taskId: task.id,
              taskTitle: task.title,
              unallocatedSlots,
              action: 'task_stopped',
            },
          });

          if (refundResult.success) {
            refundMessage = ` ₦${(Number(totalRefundKobo) / 100).toLocaleString()} for ${unallocatedSlots} uncompleted slot(s) has been refunded to your wallet.`;
          }
        }
      }

      // Mark task as cancelled/ended
      const { error: updateErr } = await adminSupabase
        .from('temutask_tasks')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString(),
        })
        .eq('id', taskId);

      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        newStatus: 'cancelled',
        message: `Task has been stopped and marked as ended.${refundMessage}`,
      });
    }

    // Action 2: PAUSE / RESUME TOGGLE
    let nextStatus: 'active' | 'paused';
    if (task.status === 'active') {
      nextStatus = 'paused';
    } else if (task.status === 'paused') {
      if (task.quantity_approved >= task.quantity_requested) {
        return NextResponse.json(
          { error: 'Cannot activate task: all requested participant slots have already been completed.' },
          { status: 400 }
        );
      }
      nextStatus = 'active';
    } else {
      return NextResponse.json(
        { error: `Tasks with status '${task.status}' cannot be toggled.` },
        { status: 400 }
      );
    }

    const { error: updateErr } = await adminSupabase
      .from('temutask_tasks')
      .update({
        status: nextStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      newStatus: nextStatus,
      message:
        nextStatus === 'paused'
          ? 'Task paused successfully. It will not be shown to participants until resumed.'
          : 'Task resumed successfully and is now active for participants.',
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
