'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { formatNaira } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  PlusCircle,
  Share2,
} from 'lucide-react';
import { ShareTaskModal } from '@/components/tasks/ShareTaskModal';

export default function MyTasksPage() {
  const { user, profile } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<Record<string, any[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [shareTask, setShareTask] = useState<any | null>(null);

  // Decline dialog state
  const [declineSubId, setDeclineSubId] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionMsg, setActionMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(
    null
  );

  const supabase = createClient();

  const loadMyTasks = async () => {
    if (!user) return;
    setIsLoading(true);

    try {
      const { data: myTasks } = await supabase
        .from('temutask_tasks')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (myTasks) {
        setTasks(myTasks);

        // Fetch submissions for all these tasks
        const taskIds = myTasks.map((t) => t.id);
        if (taskIds.length > 0) {
          const { data: subs } = await supabase
            .from('temutask_submissions')
            .select('*')
            .in('task_id', taskIds)
            .order('created_at', { ascending: false });

          if (subs) {
            const grouped: Record<string, any[]> = {};
            subs.forEach((s) => {
              if (!grouped[s.task_id]) grouped[s.task_id] = [];
              grouped[s.task_id].push(s);
            });
            setSubmissions(grouped);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching my tasks:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMyTasks();
  }, [user]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const msg = params.get('msg');
      const err = params.get('error');
      if (msg) {
        setActionMsg({ text: msg, type: 'success' });
      } else if (err) {
        setActionMsg({ text: err, type: 'error' });
      }
    }
  }, []);

  const handleApprove = async (submissionId: string) => {
    setIsProcessing(true);
    setActionMsg(null);

    try {
      const res = await fetch('/api/tasks/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionId,
          action: 'approve',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setActionMsg({ text: data.error || 'Failed to approve submission', type: 'error' });
      } else {
        setActionMsg({ text: 'Submission approved and reward credited!', type: 'success' });
        await loadMyTasks();
      }
    } catch (err: any) {
      setActionMsg({ text: err.message || 'Error approving submission', type: 'error' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDecline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!declineSubId) return;

    setIsProcessing(true);
    setActionMsg(null);

    try {
      const res = await fetch('/api/tasks/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionId: declineSubId,
          action: 'decline',
          reason: declineReason.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setActionMsg({ text: data.error || 'Failed to decline submission', type: 'error' });
      } else {
        setActionMsg({
          text: 'Submission declined and placed into nightly admin dispute queue.',
          type: 'success',
        });
        setDeclineSubId(null);
        setDeclineReason('');
        await loadMyTasks();
      }
    } catch (err: any) {
      setActionMsg({ text: err.message || 'Error declining submission', type: 'error' });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-[#E5E7EB]">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#111827]">My Created Tasks</h1>
            <p className="text-xs sm:text-sm text-[#6B7280] mt-1">
              Review participant submissions, approve rewards, or decline disputed entries.
            </p>
          </div>

          <Link href="/tasks/create">
            <Button size="sm" variant="primary" leftIcon={<PlusCircle className="w-4 h-4" />}>
              Create New Task
            </Button>
          </Link>
        </div>

        {/* Nightly Review Notice */}
        <div className="p-4 bg-[#FFF5F0] border border-[#F95700]/20 rounded-xl text-xs text-[#111827] flex items-start gap-3">
          <Clock className="w-4 h-4 text-[#F95700] shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong>Nightly Admin Review Notice:</strong> Pending submissions are reviewed by you.
            Our admin team reviews unresolved submissions at night (11:00 PM Africa/Lagos). If a
            submission remains unreviewed and qualifies under the platform's review policy, its
            participant reward will be released automatically.
          </p>
        </div>

        {actionMsg && (
          <div
            className={`p-4 rounded-xl text-xs font-semibold ${
              actionMsg.type === 'success'
                ? 'bg-[#ECFDF5] border border-[#A7F3D0] text-[#059669]'
                : 'bg-[#FEF2F2] border border-[#FECACA] text-[#DC2626]'
            }`}
          >
            {actionMsg.text}
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-16 text-[#9CA3AF] text-sm">Loading your tasks...</div>
        ) : tasks.length === 0 ? (
          <Card className="text-center py-16 space-y-4">
            <h3 className="text-base font-bold text-[#111827]">No Tasks Created Yet</h3>
            <p className="text-xs text-[#6B7280] max-w-sm mx-auto">
              Get real users to accept your Temu invitations and win your games quickly.
            </p>
            <Link href="/tasks/create">
              <Button size="md" variant="primary">
                Create Your First Task
              </Button>
            </Link>
          </Card>
        ) : (
          <div className="space-y-4">
            {tasks.map((task) => {
              const taskSubs = submissions[task.id] || [];
              const pendingCount = taskSubs.filter((s) => s.status === 'pending_review').length;
              const isExpanded = expandedTask === task.id;

              return (
                <Card key={task.id} className="p-5 sm:p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-[#111827]">{task.title}</h3>
                        <Badge variant={task.status === 'active' ? 'success' : 'secondary'}>
                          {task.status.toUpperCase()}
                        </Badge>
                        {task.is_premium && <Badge variant="premium">PREMIUM</Badge>}
                      </div>
                      <div className="text-xs text-[#6B7280] flex items-center gap-2">
                        <span>Slots: {task.quantity_approved} / {task.quantity_requested} approved</span>
                        <span>•</span>
                        <a
                          href={task.invitation_link}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#F95700] hover:underline flex items-center gap-1"
                        >
                          Temu Link <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                      {pendingCount > 0 && (
                        <span className="text-xs font-bold text-[#F95700] bg-[#FFF5F0] px-2.5 py-1 rounded-full border border-[#F95700]/20">
                          {pendingCount} Pending Review
                        </span>
                      )}

                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => setShareTask(task)}
                        leftIcon={<Share2 className="w-3.5 h-3.5" />}
                      >
                        Share Task
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setExpandedTask(isExpanded ? null : task.id)}
                        rightIcon={
                          isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                        }
                      >
                        {isExpanded ? 'Hide' : `Submissions (${taskSubs.length})`}
                      </Button>
                    </div>
                  </div>

                  {/* Expanded Submissions Table */}
                  {isExpanded && (
                    <div className="pt-4 border-t border-[#E5E7EB] space-y-3">
                      <h4 className="text-xs font-bold text-[#111827] uppercase tracking-wider">
                        Participant Submissions ({taskSubs.length})
                      </h4>

                      {taskSubs.length === 0 ? (
                        <p className="text-xs text-[#9CA3AF] py-3">
                          No submissions received for this task yet.
                        </p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-[#F7F7F8] text-[#6B7280]">
                              <tr>
                                <th className="p-2.5 rounded-l-md">Temu Username</th>
                                <th className="p-2.5">Temu Email</th>
                                <th className="p-2.5">Status</th>
                                <th className="p-2.5">Submitted</th>
                                <th className="p-2.5 text-right rounded-r-md">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#E5E7EB]">
                              {taskSubs.map((sub) => (
                                <tr key={sub.id} className="hover:bg-[#F9FAFB]">
                                  <td className="p-2.5 font-bold text-[#111827]">
                                    {sub.temu_username}
                                  </td>
                                  <td className="p-2.5 text-[#4B5563] font-mono">
                                    {sub.temu_email}
                                  </td>
                                  <td className="p-2.5">
                                    <Badge
                                      variant={
                                        sub.status === 'approved' || sub.status === 'auto_approved'
                                          ? 'success'
                                          : sub.status === 'pending_review'
                                          ? 'warning'
                                          : 'danger'
                                      }
                                    >
                                      {sub.status.replace('_', ' ')}
                                    </Badge>
                                  </td>
                                  <td className="p-2.5 text-[#9CA3AF]">
                                    {new Date(sub.created_at).toLocaleString('en-NG', {
                                      day: 'numeric',
                                      month: 'short',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </td>
                                  <td className="p-2.5 text-right">
                                    {sub.status === 'pending_review' ? (
                                      <div className="flex items-center justify-end gap-2">
                                        <Button
                                          size="sm"
                                          variant="primary"
                                          className="h-7 text-[11px] px-2.5"
                                          onClick={() => handleApprove(sub.id)}
                                          disabled={isProcessing}
                                        >
                                          Approve
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="danger"
                                          className="h-7 text-[11px] px-2.5"
                                          onClick={() => {
                                            setDeclineSubId(sub.id);
                                            setDeclineReason('');
                                          }}
                                          disabled={isProcessing}
                                        >
                                          Decline
                                        </Button>
                                      </div>
                                    ) : (
                                      <span className="text-[#9CA3AF] text-[11px]">Completed</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        {/* Decline Reason Modal */}
        {declineSubId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in">
            <Card className="max-w-md w-full p-6 space-y-4 shadow-xl">
              <h3 className="text-base font-bold text-[#111827]">Decline Submission</h3>
              <p className="text-xs text-[#6B7280]">
                Declining will send this submission into the nightly administrator dispute review.
                Please state the reason (e.g. invite not showing in Temu records):
              </p>

              <form onSubmit={handleDecline} className="space-y-4">
                <Input
                  label="Decline Reason"
                  placeholder="e.g. Invitation did not register on my Temu game"
                  value={declineReason}
                  onChange={(e) => setDeclineReason(e.target.value)}
                  required
                />

                <div className="flex justify-end gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setDeclineSubId(null)}
                    disabled={isProcessing}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="danger"
                    size="sm"
                    isLoading={isProcessing}
                  >
                    Confirm Decline
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        )}

        {/* Share Task Modal */}
        <ShareTaskModal
          isOpen={!!shareTask}
          onClose={() => setShareTask(null)}
          task={shareTask}
          referralCode={profile?.referral_code}
        />
      </div>
    </AppShell>
  );
}
