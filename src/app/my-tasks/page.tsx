'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { formatNaira, parseTaskTitleAndInstructions } from '@/lib/utils';
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
  Eye,
  UploadCloud,
  X,
  Image as ImageIcon,
  TrendingUp,
  Pause,
  Play,
  Lock,
  Wallet,
  CreditCard,
  ArrowRight,
} from 'lucide-react';
import { ShareTaskModal } from '@/components/tasks/ShareTaskModal';

export default function MyTasksPage() {
  const { user, profile, wallet, refreshProfile } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<Record<string, any[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [shareTask, setShareTask] = useState<any | null>(null);

  // Increase reward modal state
  const [increaseRewardTask, setIncreaseRewardTask] = useState<any | null>(null);
  const [newRewardPrice, setNewRewardPrice] = useState<number | ''>('');
  const [rewardPaymentMethod, setRewardPaymentMethod] = useState<'wallet' | 'novac'>('wallet');
  const [isSubmittingIncrease, setIsSubmittingIncrease] = useState(false);
  const [increaseError, setIncreaseError] = useState('');

  // Toggle status state
  const [isTogglingStatus, setIsTogglingStatus] = useState<string | null>(null);

  // Decline dialog & rejection proof state
  const [declineSubId, setDeclineSubId] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState('');
  const [declineFile, setDeclineFile] = useState<File | null>(null);
  const [declineFilePreview, setDeclineFilePreview] = useState<string | null>(null);
  const [viewProofModal, setViewProofModal] = useState<{
    isOpen: boolean;
    reason: string;
    proofUrl?: string;
    username?: string;
  }>({ isOpen: false, reason: '' });

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

  const handleToggleStatus = async (task: any) => {
    setIsTogglingStatus(task.id);
    setActionMsg(null);
    try {
      const res = await fetch('/api/tasks/toggle-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: task.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionMsg({ text: data.error || 'Failed to update task status', type: 'error' });
      } else {
        setActionMsg({ text: data.message, type: 'success' });
        await loadMyTasks();
      }
    } catch (err: any) {
      setActionMsg({ text: err.message || 'Error updating status', type: 'error' });
    } finally {
      setIsTogglingStatus(null);
    }
  };

  const handleIncreaseReward = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!increaseRewardTask || !newRewardPrice) return;

    const currentPrice = Math.round(
      Number(increaseRewardTask.base_cost_kobo) /
        (Number(increaseRewardTask.quantity_requested) * 100)
    );
    const priceNum = Number(newRewardPrice);

    if (isNaN(priceNum) || priceNum <= currentPrice) {
      setIncreaseError(`New price must be higher than current price of ₦${currentPrice}`);
      return;
    }

    setIsSubmittingIncrease(true);
    setIncreaseError('');

    try {
      const res = await fetch('/api/tasks/increase-reward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: increaseRewardTask.id,
          newPrice: priceNum,
          paymentMethod: rewardPaymentMethod,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setIncreaseError(data.error || 'Failed to increase task reward');
        setIsSubmittingIncrease(false);
        return;
      }

      if (data.method === 'novac' && data.paymentUrl) {
        window.location.href = data.paymentUrl;
        return;
      }

      // Direct wallet success
      await refreshProfile();
      setActionMsg({
        text: `Task reward successfully increased to ₦${data.newRewardNaira} for the remaining ${data.remainingSlots} slots!`,
        type: 'success',
      });
      setIncreaseRewardTask(null);
      await loadMyTasks();
    } catch (err: any) {
      setIncreaseError(err.message || 'Error increasing task reward');
    } finally {
      setIsSubmittingIncrease(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setActionMsg({ text: 'Please select an image file (PNG, JPG, WEBP).', type: 'error' });
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setActionMsg({ text: 'Image file size must be under 5MB.', type: 'error' });
        return;
      }
      setDeclineFile(file);
      setDeclineFilePreview(URL.createObjectURL(file));
    }
  };

  const parseDeclineReason = (raw: string | null | undefined): { reason: string; proofUrl?: string } => {
    if (!raw) return { reason: 'No explanation provided' };
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null) {
        return {
          reason: parsed.reason || 'No explanation provided',
          proofUrl: parsed.proofUrl || parsed.proof_url || undefined,
        };
      }
    } catch {
      if (raw.includes('| Proof: ')) {
        const [r, p] = raw.split('| Proof: ');
        return { reason: r.trim(), proofUrl: p.trim() };
      }
    }
    return { reason: raw, proofUrl: undefined };
  };

  const handleDecline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!declineSubId) return;

    if (!declineFile) {
      setActionMsg({
        text: 'Please upload an image screenshot proving why this submission is being rejected.',
        type: 'error',
      });
      return;
    }

    setIsProcessing(true);
    setActionMsg(null);

    try {
      // 1. Upload proof screenshot to Supabase Storage bucket
      const ext = declineFile.name.split('.').pop()?.toLowerCase() || 'jpg';
      const cleanSubId = declineSubId.replace(/[^a-zA-Z0-9]/g, '');
      const filePath = `rejections/${cleanSubId}-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('temutask-proofs')
        .upload(filePath, declineFile, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) {
        throw new Error(`Failed to upload proof image: ${uploadError.message}`);
      }

      const { data: urlData } = supabase.storage
        .from('temutask-proofs')
        .getPublicUrl(filePath);
      const proofUrl = urlData?.publicUrl || '';

      // 2. Call review API with structured reason and proofUrl
      const res = await fetch('/api/tasks/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionId: declineSubId,
          action: 'decline',
          reason: declineReason.trim(),
          proofUrl,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setActionMsg({ text: data.error || 'Failed to decline submission', type: 'error' });
      } else {
        setActionMsg({
          text: 'Submission rejected with proof image attached and queued for nightly admin dispute review.',
          type: 'success',
        });
        setDeclineSubId(null);
        setDeclineReason('');
        setDeclineFile(null);
        setDeclineFilePreview(null);
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
              const currentPrice = Math.round(
                Number(task.base_cost_kobo) / (Number(task.quantity_requested) * 100)
              );
              const currentReward = Math.round(Number(task.reward_per_participant_kobo) / 100);
              const remainingSlots = Math.max(0, task.quantity_requested - task.quantity_approved);
              const walletBalanceKobo = wallet?.balance_kobo ? BigInt(wallet.balance_kobo) : BigInt(0);
              const walletBalanceNaira = Number(walletBalanceKobo) / 100;

              return (
                <Card key={task.id} className="p-5 sm:p-6 space-y-4">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-bold text-[#111827]">
                          {parseTaskTitleAndInstructions(task.title).title}
                        </h3>
                        <Badge
                          variant={
                            task.status === 'active'
                              ? 'success'
                              : task.status === 'paused'
                              ? 'warning'
                              : 'secondary'
                          }
                        >
                          {task.status.toUpperCase()}
                        </Badge>
                        {task.is_premium && <Badge variant="premium">PREMIUM</Badge>}
                        <span className="text-xs font-bold text-[#10B981] bg-[#ECFDF5] px-2.5 py-0.5 rounded-full border border-[#A7F3D0]">
                          Reward: ₦{currentReward} / slot
                        </span>
                      </div>
                      <div className="text-xs text-[#6B7280] flex flex-wrap items-center gap-2">
                        <span>
                          Slots: <strong>{task.quantity_approved}</strong> / {task.quantity_requested} approved ({remainingSlots} remaining)
                        </span>
                        <span>•</span>
                        <span>Price: <strong>₦{currentPrice}</strong> / slot</span>
                        <span>•</span>
                        <a
                          href={task.invitation_link}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#F95700] hover:underline flex items-center gap-1 font-medium"
                        >
                          Temu Link <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {pendingCount > 0 && (
                        <span className="text-xs font-bold text-[#F95700] bg-[#FFF5F0] px-2.5 py-1 rounded-full border border-[#F95700]/20">
                          {pendingCount} Pending Review
                        </span>
                      )}

                      {/* Increase reward to reach more people button */}
                      {remainingSlots > 0 && task.status !== 'completed' && (
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => {
                            setIncreaseRewardTask(task);
                            const suggested = currentPrice + 20;
                            setNewRewardPrice(suggested);
                            const topupNeeded = 20 * remainingSlots;
                            setRewardPaymentMethod(
                              walletBalanceNaira >= topupNeeded ? 'wallet' : 'novac'
                            );
                            setIncreaseError('');
                          }}
                          leftIcon={<TrendingUp className="w-3.5 h-3.5" />}
                          className="text-xs font-bold shadow-sm"
                        >
                          Increase tasks reward to reach more people
                        </Button>
                      )}

                      {/* Pause / Resume Button */}
                      {remainingSlots > 0 && task.status !== 'completed' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleToggleStatus(task)}
                          disabled={isTogglingStatus === task.id}
                          leftIcon={
                            task.status === 'active' ? (
                              <Pause className="w-3.5 h-3.5 text-[#F59E0B]" />
                            ) : (
                              <Play className="w-3.5 h-3.5 text-[#10B981]" />
                            )
                          }
                          className="text-xs font-medium"
                        >
                          {isTogglingStatus === task.id
                            ? 'Updating...'
                            : task.status === 'active'
                            ? 'Pause Task'
                            : 'Resume Task'}
                        </Button>
                      )}

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShareTask(task)}
                        leftIcon={<Share2 className="w-3.5 h-3.5" />}
                        className="text-xs"
                      >
                        Share
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setExpandedTask(isExpanded ? null : task.id)}
                        rightIcon={
                          isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )
                        }
                        className="text-xs"
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
                                    {sub.status === 'declined_disputed' ? (
                                      <div className="space-y-1">
                                        <Badge variant="danger">Declined</Badge>
                                        {(() => {
                                          const { reason, proofUrl } = parseDeclineReason(sub.decline_reason);
                                          return (
                                            <button
                                              type="button"
                                              onClick={() =>
                                                setViewProofModal({
                                                  isOpen: true,
                                                  reason,
                                                  proofUrl,
                                                  username: sub.temu_username,
                                                })
                                              }
                                              className="text-[11px] font-bold text-[#F95700] hover:underline flex items-center gap-1"
                                            >
                                              <Eye className="w-3 h-3" /> Proof Image
                                            </button>
                                          );
                                        })()}
                                      </div>
                                    ) : (
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
                                    )}
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
                                            setDeclineFile(null);
                                            setDeclineFilePreview(null);
                                          }}
                                          disabled={isProcessing}
                                        >
                                          Reject
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

        {/* Decline / Reject Reason & Proof Modal */}
        {declineSubId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in">
            <Card className="max-w-md w-full p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-[#111827]">Reject Submission &amp; Upload Proof</h3>
                <button
                  type="button"
                  onClick={() => {
                    setDeclineSubId(null);
                    setDeclineFile(null);
                    setDeclineFilePreview(null);
                  }}
                  className="text-[#9CA3AF] hover:text-[#111827]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-xs text-[#6B7280]">
                To maintain fairness, you must state why you are rejecting this submission and upload a screenshot from your Temu app proving the user didn&apos;t qualify.
              </p>

              <form onSubmit={handleDecline} className="space-y-4">
                <Input
                  label="Rejection Reason"
                  placeholder="e.g. Invitation limit reached / User did not register"
                  value={declineReason}
                  onChange={(e) => setDeclineReason(e.target.value)}
                  required
                />

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-[#111827]">
                    Proof Screenshot (Temu Record) <span className="text-[#EF4444]">*</span>
                  </label>

                  {declineFilePreview ? (
                    <div className="relative rounded-xl border border-[#E5E7EB] overflow-hidden bg-[#F9FAFB] p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={declineFilePreview}
                        alt="Rejection Proof Preview"
                        className="w-full max-h-48 object-contain rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setDeclineFile(null);
                          setDeclineFilePreview(null);
                        }}
                        className="absolute top-3 right-3 bg-red-600 text-white rounded-full p-1 shadow-md hover:bg-red-700"
                        title="Remove image"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center border-2 border-dashed border-[#D1D5DB] hover:border-[#F95700] rounded-xl p-4 cursor-pointer bg-[#F9FAFB] hover:bg-[#FFF5F0]/30 transition-all text-center">
                      <UploadCloud className="w-8 h-8 text-[#9CA3AF] mb-1.5" />
                      <span className="text-xs font-semibold text-[#111827]">
                        Upload Proof Screenshot
                      </span>
                      <span className="text-[11px] text-[#6B7280] mt-0.5">
                        PNG, JPG or WEBP (Max 5MB)
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileSelect}
                        className="hidden"
                        required
                      />
                    </label>
                  )}
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setDeclineSubId(null);
                      setDeclineFile(null);
                      setDeclineFilePreview(null);
                    }}
                    disabled={isProcessing}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="danger"
                    size="sm"
                    isLoading={isProcessing}
                    disabled={!declineFile || !declineReason.trim()}
                  >
                    Confirm Reject
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        )}

        {/* View Proof Lightbox Modal */}
        {viewProofModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 animate-in fade-in">
            <Card className="max-w-lg w-full p-6 space-y-4 shadow-2xl bg-white max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3">
                <div>
                  <h3 className="text-base font-bold text-[#111827]">Rejection Proof Screenshot</h3>
                  {viewProofModal.username && (
                    <p className="text-xs text-[#6B7280]">
                      User: <strong>{viewProofModal.username}</strong>
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setViewProofModal({ isOpen: false, reason: '' })}
                  className="text-[#9CA3AF] hover:text-[#111827] p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-xl text-xs text-[#991B1B]">
                  <span className="font-bold block mb-0.5">Stated Rejection Reason:</span>
                  <p>{viewProofModal.reason}</p>
                </div>

                {viewProofModal.proofUrl ? (
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-[#111827] block">Proof Image:</span>
                    <div className="rounded-xl border border-[#E5E7EB] overflow-hidden bg-[#F9FAFB] p-1 text-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={viewProofModal.proofUrl}
                        alt="Rejection Proof"
                        className="w-full max-h-[400px] object-contain rounded-lg mx-auto"
                      />
                    </div>
                    <div className="text-right">
                      <a
                        href={viewProofModal.proofUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-semibold text-[#F95700] hover:underline inline-flex items-center gap-1"
                      >
                        Open Full Image in New Tab <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-[#9CA3AF] italic">No proof screenshot was attached.</p>
                )}
              </div>

              <div className="flex justify-end pt-2 border-t border-[#E5E7EB]">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setViewProofModal({ isOpen: false, reason: '' })}
                >
                  Close
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* Increase Task Reward Modal */}
        {increaseRewardTask && (() => {
          const currentPrice = Math.round(
            Number(increaseRewardTask.base_cost_kobo) /
              (Number(increaseRewardTask.quantity_requested) * 100)
          );
          const currentReward = Math.round(
            Number(increaseRewardTask.reward_per_participant_kobo) / 100
          );
          const remainingSlots = Math.max(
            0,
            increaseRewardTask.quantity_requested - increaseRewardTask.quantity_approved
          );
          const priceNum = Number(newRewardPrice) || 0;
          const priceDiff = Math.max(0, priceNum - currentPrice);
          const topupCost = priceDiff * remainingSlots;
          const isNewUser = increaseRewardTask.task_type === 'new_user';
          const newParticipantReward = Math.round(
            isNewUser ? (priceNum * 400) / 500 : (priceNum * 80) / 100
          );
          const walletBalanceKobo = wallet?.balance_kobo ? BigInt(wallet.balance_kobo) : BigInt(0);
          const walletBalanceNaira = Number(walletBalanceKobo) / 100;
          const hasSufficientWallet = walletBalanceNaira >= topupCost;

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in">
              <Card className="max-w-lg w-full p-6 space-y-4 shadow-2xl bg-white max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-[#FFF5F0] text-[#F95700] flex items-center justify-center">
                      <TrendingUp className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-[#111827]">
                        Increase Task Reward
                      </h3>
                      <p className="text-xs text-[#6B7280]">
                        Boost payouts to attract more users to complete your task faster
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIncreaseRewardTask(null);
                      setIncreaseError('');
                    }}
                    className="text-[#9CA3AF] hover:text-[#111827] p-1"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Locked Link Notice */}
                <div className="p-3 bg-[#F9FAFB] rounded-xl border border-[#E5E7EB] text-xs space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-[#111827]">
                    <Lock className="w-3.5 h-3.5 text-[#6B7280]" />
                    <span>Invitation Link (Locked)</span>
                  </div>
                  <p className="font-mono text-[#4B5563] truncate text-[11px] bg-white p-1.5 rounded border border-[#E5E7EB]">
                    {increaseRewardTask.invitation_link}
                  </p>
                  <p className="text-[11px] text-[#6B7280]">
                    Task link cannot be edited to maintain invite verification integrity.
                  </p>
                </div>

                {/* Current Stats */}
                <div className="grid grid-cols-3 gap-2.5 text-center text-xs">
                  <div className="p-2.5 bg-[#F7F7F8] rounded-xl border border-[#E5E7EB]">
                    <span className="text-[11px] text-[#6B7280] block">Current Slot Cost</span>
                    <strong className="text-sm text-[#111827]">₦{currentPrice}</strong>
                  </div>
                  <div className="p-2.5 bg-[#F7F7F8] rounded-xl border border-[#E5E7EB]">
                    <span className="text-[11px] text-[#6B7280] block">Current Reward</span>
                    <strong className="text-sm text-[#10B981]">₦{currentReward}</strong>
                  </div>
                  <div className="p-2.5 bg-[#F7F7F8] rounded-xl border border-[#E5E7EB]">
                    <span className="text-[11px] text-[#6B7280] block">Remaining Slots</span>
                    <strong className="text-sm text-[#F95700]">{remainingSlots}</strong>
                  </div>
                </div>

                <form onSubmit={handleIncreaseReward} className="space-y-4">
                  {/* New Price Input */}
                  <div>
                    <label className="block text-xs font-bold text-[#111827] mb-1">
                      New Total Price per Participant (₦)
                    </label>
                    <Input
                      type="number"
                      min={currentPrice + 5}
                      step={5}
                      value={newRewardPrice}
                      onChange={(e) =>
                        setNewRewardPrice(e.target.value === '' ? '' : Number(e.target.value))
                      }
                      placeholder={`e.g. ${currentPrice + 20}`}
                      required
                      className="font-bold text-base"
                    />
                    <span className="text-[11px] text-[#6B7280] mt-1 block">
                      Must be higher than current price (₦{currentPrice}). Higher rewards appear top in task listings.
                    </span>
                  </div>

                  {/* Live Top-up Calculation Box */}
                  {priceNum > currentPrice && (
                    <div className="p-3.5 bg-[#FFF5F0] border border-[#F95700]/30 rounded-xl space-y-2 text-xs">
                      <div className="flex justify-between items-center text-[#4B5563]">
                        <span>Price Increase per Slot:</span>
                        <span className="font-bold text-[#F95700]">+₦{priceDiff}</span>
                      </div>
                      <div className="flex justify-between items-center text-[#4B5563]">
                        <span>Remaining Slots to Top-up:</span>
                        <span className="font-bold text-[#111827]">{remainingSlots} slots</span>
                      </div>
                      <div className="flex justify-between items-center text-[#4B5563]">
                        <span>New Participant Reward:</span>
                        <span className="font-bold text-[#10B981]">₦{newParticipantReward} / slot</span>
                      </div>
                      <div className="pt-2 border-t border-[#F95700]/20 flex justify-between items-center text-sm font-black text-[#111827]">
                        <span>Total Top-up Payment:</span>
                        <span className="text-[#F95700] text-base">₦{topupCost.toLocaleString()}</span>
                      </div>
                    </div>
                  )}

                  {/* Payment Method Selector */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-[#111827]">
                      Select Payment Method for Top-up:
                    </label>
                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setRewardPaymentMethod('wallet')}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          rewardPaymentMethod === 'wallet'
                            ? 'border-[#F95700] bg-[#FFF5F0] ring-2 ring-[#F95700]/20'
                            : 'border-[#E5E7EB] bg-white hover:border-[#D1D5DB]'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Wallet
                            className={`w-4 h-4 ${
                              rewardPaymentMethod === 'wallet' ? 'text-[#F95700]' : 'text-[#6B7280]'
                            }`}
                          />
                          <span className="text-xs font-bold text-[#111827]">Wallet Balance</span>
                        </div>
                        <span className="text-[11px] block text-[#6B7280]">
                          Available: <strong>₦{walletBalanceNaira.toLocaleString()}</strong>
                        </span>
                        {!hasSufficientWallet && priceNum > currentPrice && (
                          <span className="text-[10px] text-[#EF4444] font-semibold mt-0.5 block">
                            Insufficient balance
                          </span>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => setRewardPaymentMethod('novac')}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          rewardPaymentMethod === 'novac'
                            ? 'border-[#F95700] bg-[#FFF5F0] ring-2 ring-[#F95700]/20'
                            : 'border-[#E5E7EB] bg-white hover:border-[#D1D5DB]'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <CreditCard
                            className={`w-4 h-4 ${
                              rewardPaymentMethod === 'novac' ? 'text-[#F95700]' : 'text-[#6B7280]'
                            }`}
                          />
                          <span className="text-xs font-bold text-[#111827]">Novac Gateway</span>
                        </div>
                        <span className="text-[11px] block text-[#6B7280]">
                          OPay, Cards &amp; Transfer
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Fair Reward Rule Callout */}
                  <div className="p-3 bg-[#F0FDF4] border border-[#BBF7D0] rounded-xl text-[11px] text-[#166534] leading-relaxed">
                    💡 <strong>Fair Payout Policy:</strong> Only participants completing the task after this increase will receive the higher reward of <strong>₦{newParticipantReward}</strong>. Previous submissions retain their locked original amount.
                  </div>

                  {increaseError && (
                    <div className="p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-xl text-xs text-[#DC2626]">
                      {increaseError}
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E5E7EB]">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setIncreaseRewardTask(null);
                        setIncreaseError('');
                      }}
                      disabled={isSubmittingIncrease}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      size="sm"
                      isLoading={isSubmittingIncrease}
                      disabled={
                        !newRewardPrice ||
                        priceNum <= currentPrice ||
                        (rewardPaymentMethod === 'wallet' && !hasSufficientWallet)
                      }
                      rightIcon={<ArrowRight className="w-4 h-4" />}
                    >
                      Pay ₦{topupCost.toLocaleString()} &amp; Increase Reward
                    </Button>
                  </div>
                </form>
              </Card>
            </div>
          );
        })()}

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
