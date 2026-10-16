import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { parseTaskTitleAndInstructions } from '@/lib/utils';

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

    const { taskId, extendHours, newDurationHours, customExpiresAt } = await request.json();

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
        { error: 'You are not authorized to edit this task timer' },
        { status: 403 }
      );
    }

    if (task.status === 'cancelled') {
      return NextResponse.json(
        { error: 'Cannot edit timer for an ended task.' },
        { status: 400 }
      );
    }

    let calculatedExpiresAt: string;
    let durationHours: number = task.duration_hours || 24;

    if (customExpiresAt) {
      const parsedDate = new Date(customExpiresAt);
      if (isNaN(parsedDate.getTime()) || parsedDate.getTime() <= Date.now()) {
        return NextResponse.json(
          { error: 'Expiration date must be in the future.' },
          { status: 400 }
        );
      }
      calculatedExpiresAt = parsedDate.toISOString();
      const diffMs = parsedDate.getTime() - new Date(task.created_at).getTime();
      durationHours = Math.max(1, Math.round(diffMs / (1000 * 60 * 60)));
    } else if (extendHours && typeof extendHours === 'number' && extendHours > 0) {
      // Extend current remaining time or from now if expired
      const currentExpiry = task.expires_at ? new Date(task.expires_at).getTime() : new Date(task.created_at).getTime() + 24 * 60 * 60 * 1000;
      const baseTime = Math.max(Date.now(), currentExpiry);
      const newExpiryTime = baseTime + extendHours * 60 * 60 * 1000;
      calculatedExpiresAt = new Date(newExpiryTime).toISOString();
      const totalDiffMs = newExpiryTime - new Date(task.created_at).getTime();
      durationHours = Math.max(1, Math.round(totalDiffMs / (1000 * 60 * 60)));
    } else if (newDurationHours && typeof newDurationHours === 'number' && newDurationHours > 0) {
      // Reset timer starting from now for newDurationHours
      durationHours = newDurationHours;
      calculatedExpiresAt = new Date(Date.now() + newDurationHours * 60 * 60 * 1000).toISOString();
    } else {
      return NextResponse.json(
        { error: 'Please specify extendHours, newDurationHours, or customExpiresAt' },
        { status: 400 }
      );
    }

    // Also encode in title for reliable persistence regardless of database column availability
    const { title: rawTitle, instructions: inst } = parseTaskTitleAndInstructions(task.title);
    const updatedTitle = `${rawTitle}|||${inst}|||${durationHours}|||${calculatedExpiresAt}`;

    let { error: updateErr } = await adminSupabase
      .from('temutask_tasks')
      .update({
        title: updatedTitle,
        duration_hours: durationHours,
        expires_at: calculatedExpiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId);

    if (updateErr && (updateErr.message?.includes('duration_hours') || updateErr.code === 'PGRST204')) {
      console.warn('duration_hours column not in schema cache; saving timer in title');
      const retry = await adminSupabase
        .from('temutask_tasks')
        .update({
          title: updatedTitle,
          updated_at: new Date().toISOString(),
        })
        .eq('id', taskId);
      updateErr = retry.error;
    }

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Task timer updated successfully!',
      durationHours,
      expiresAt: calculatedExpiresAt,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
