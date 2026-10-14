export const dynamic = 'force-dynamic';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

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

    const { taskId } = await request.json();
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
