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
  ExternalLink,
  Sparkles,
  AlertCircle,
  Layers,
  CheckSquare,
  Square,
  Share2,
  Eye,
  X,
} from 'lucide-react';
import { ShareTaskModal } from '@/components/tasks/ShareTaskModal';

export default function AvailableTasksPage() {
  const { user, profile, signInWithGoogle } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [userSubmissions, setUserSubmissions] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [filterType, setFilterType] = useState<'all' | 'existing_user' | 'new_user'>('all');

  // Single or Batch Selection
  const [selectedTask, setSelectedTask] = useState<any | null>(null);
  const [batchTaskIds, setBatchTaskIds] = useState<string[]>([]);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);

  // Share Task & Shared Link state
  const [shareTask, setShareTask] = useState<any | null>(null);
  const [featuredSharedTask, setFeaturedSharedTask] = useState<any | null>(null);
  const [sharedTaskId, setSharedTaskId] = useState<string | null>(null);

  // View rejection proof modal
  const [viewProofModal, setViewProofModal] = useState<{
    isOpen: boolean;
    taskTitle?: string;
    reason: string;
    proofUrl?: string;
  }>({ isOpen: false, reason: '' });

  // Modal submission state
  const [temuUsername, setTemuUsername] = useState('');
  const [temuEmail, setTemuEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [submittedLinks, setSubmittedLinks] = useState<
    { taskId: string; title: string; link: string; rewardKobo: string }[]
  >([]);

  const supabase = createClient();
  const isPro = profile?.tier === 'pro';

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

  const loadTasks = async () => {
    setIsLoading(true);
    try {
      const { data: taskData } = await supabase
        .from('temutask_tasks')
        .select('*')
        .eq('status', 'active')
        .order('is_premium', { ascending: false })
        .order('created_at', { ascending: false });

      if (taskData) {
        const openTasks = taskData.filter((t) => t.quantity_approved < t.quantity_requested);
        setTasks(openTasks);
      }

      if (user) {
        const { data: subs } = await supabase
          .from('temutask_submissions')
          .select('task_id, status, decline_reason')
          .eq('participant_id', user.id);

        if (subs) {
          const map: Record<string, any> = {};
          subs.forEach((s) => {
            map[s.task_id] = s;
          });
          setUserSubmissions(map);
        }
      }
    } catch (err) {
      console.error('Error fetching tasks:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, [user]);

  // Read shared task ID and referral code from URL query parameters
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tId = params.get('taskId') || params.get('id');
      const ref = params.get('ref');

      if (ref) {
        localStorage.setItem('temutask_ref', ref.trim().toUpperCase());
      }

      if (tId) {
        setSharedTaskId(tId);
      }
    }
  }, []);

  // Fetch the shared task if present in the URL
  useEffect(() => {
    if (!sharedTaskId) return;

    const fetchSharedTask = async () => {
      try {
        const { data: specificTask, error } = await supabase
          .from('temutask_tasks')
          .select('*')
          .eq('id', sharedTaskId)
          .maybeSingle();

        if (specificTask && !error) {
          setFeaturedSharedTask(specificTask);
        }
      } catch (err) {
        console.error('Error fetching shared task:', err);
      }
    };

    fetchSharedTask();
  }, [sharedTaskId]);

  const filteredTasks = tasks.filter((t) => {
    if (filterType === 'all') return true;
    return t.task_type === filterType;
  });

  // Eligible tasks that user hasn't submitted yet and doesn't own
  const eligibleTasks = filteredTasks.filter(
    (t) => !userSubmissions[t.id] && t.user_id !== user?.id
  );

  const toggleBatchSelect = (taskId: string) => {
    if (!isPro) return;
    setBatchTaskIds((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    );
  };

  const handleSelectAllEligible = () => {
    if (!isPro) return;
    if (batchTaskIds.length === eligibleTasks.length) {
      setBatchTaskIds([]);
    } else {
      setBatchTaskIds(eligibleTasks.map((t) => t.id));
    }
  };

  const totalBatchRewardKobo = batchTaskIds.reduce((sum, id) => {
    const t = tasks.find((item) => item.id === id);
    return t ? sum + BigInt(t.reward_per_participant_kobo) : sum;
  }, BigInt(0));

  const handleOpenSingleModal = (task: any) => {
    setSelectedTask(task);
    setIsBatchModalOpen(false);
    setErrorMsg('');
    setSuccessMsg('');
    setSubmittedLinks([]);
    setTemuUsername('');
    setTemuEmail('');
  };

  const handleOpenBatchModal = () => {
    if (batchTaskIds.length === 0) return;
    setSelectedTask(null);
    setIsBatchModalOpen(true);
    setErrorMsg('');
    setSuccessMsg('');
    setSubmittedLinks([]);
    setTemuUsername('');
    setTemuEmail('');
  };

  const handleCloseModal = () => {
    setSelectedTask(null);
    setIsBatchModalOpen(false);
    setSubmittedLinks([]);
  };

  const handleSubmitTask = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!temuUsername.trim() || !temuEmail.trim()) {
      setErrorMsg('Please enter both your Temu username and email.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    const payload = isBatchModalOpen
      ? {
          taskIds: batchTaskIds,
          temuUsername: temuUsername.trim(),
          temuEmail: temuEmail.trim(),
        }
      : {
          taskId: selectedTask?.id,
          temuUsername: temuUsername.trim(),
          temuEmail: temuEmail.trim(),
        };

    try {
      const res = await fetch('/api/tasks/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to submit task(s)');
        setIsSubmitting(false);
        return;
      }

      const links = data.invitationLinks || [];
      setSubmittedLinks(links);

      if (links.length === 1) {
        setSuccessMsg('Task submitted for review! Opening Temu invitation link now...');
        window.open(links[0].link, '_blank');
      } else {
        setSuccessMsg(
          `🎉 Successfully submitted ${data.count} tasks at once! You will earn ${formatNaira(
            BigInt(data.totalPotentialRewardKobo || 0)
          )} across all approved tasks. Click each Temu invite link below to complete them.`
        );
      }

      setBatchTaskIds([]);
      await loadTasks();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error submitting task');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-[#E5E7EB]">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#111827]">Available Tasks</h1>
            <p className="text-xs sm:text-sm text-[#6B7280] mt-1">
              Accept Temu invites, submit your details, and receive verified rewards.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                filterType === 'all'
                  ? 'bg-[#F95700] text-white'
                  : 'bg-[#F3F4F6] text-[#4B5563] hover:bg-[#E5E7EB]'
              }`}
            >
              All Tasks
            </button>
            <button
              onClick={() => setFilterType('existing_user')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                filterType === 'existing_user'
                  ? 'bg-[#F95700] text-white'
                  : 'bg-[#F3F4F6] text-[#4B5563] hover:bg-[#E5E7EB]'
              }`}
            >
              Existing Users (₦45)
            </button>
            <button
              onClick={() => setFilterType('new_user')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                filterType === 'new_user'
                  ? 'bg-[#F95700] text-white'
                  : 'bg-[#F3F4F6] text-[#4B5563] hover:bg-[#E5E7EB]'
              }`}
            >
              New Users (₦200)
            </button>
          </div>
        </div>

        {/* Featured Shared Task Banner when accessed via shared link */}
        {featuredSharedTask && (
          <div className="bg-gradient-to-r from-[#FFF5F0] via-white to-[#FFF5F0] border-2 border-[#F95700] rounded-2xl p-5 sm:p-6 shadow-md space-y-4 animate-in fade-in">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2">
                  <Badge variant="primary" className="bg-[#F95700] text-white">
                    ⭐ Shared Task
                  </Badge>
                  <Badge variant={featuredSharedTask.task_type === 'new_user' ? 'primary' : 'secondary'}>
                    {featuredSharedTask.task_type === 'new_user' ? 'New Temu User' : 'Existing Temu User'}
                  </Badge>
                  {featuredSharedTask.is_premium && (
                    <Badge variant="premium">URGENT</Badge>
                  )}
                </div>
                <h2 className="text-xl font-extrabold text-[#111827]">
                  {featuredSharedTask.title}
                </h2>
                <p className="text-xs text-[#6B7280]">
                  You were invited to complete this task. Enter your Temu account info and accept the invitation to earn cash rewards directly to your wallet!
                </p>
              </div>

              <div className="sm:text-right shrink-0 bg-white sm:bg-transparent p-3 sm:p-0 rounded-xl border sm:border-0 border-[#E5E7EB]">
                <span className="text-[11px] text-[#6B7280] block font-medium">Participant Reward</span>
                <span className="text-2xl font-black text-[#10B981]">
                  {formatNaira(BigInt(featuredSharedTask.reward_per_participant_kobo || 0))}
                </span>
                <span className="text-xs text-[#6B7280] block mt-0.5">
                  {Math.max(0, featuredSharedTask.quantity_requested - featuredSharedTask.quantity_approved)} slots remaining
                </span>
              </div>
            </div>

            {/* Action Area */}
            <div className="pt-3 border-t border-[#F95700]/20 flex flex-wrap items-center justify-between gap-3">
              {!user ? (
                <Button
                  size="md"
                  variant="primary"
                  className="w-full sm:w-auto"
                  onClick={() => signInWithGoogle(`/tasks?taskId=${featuredSharedTask.id}`)}
                >
                  Sign In with Google to Complete &amp; Earn {formatNaira(BigInt(featuredSharedTask.reward_per_participant_kobo || 0))}
                </Button>
              ) : user.id === featuredSharedTask.user_id ? (
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <span className="text-xs font-semibold text-[#6B7280]">You created this task.</span>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => setShareTask(featuredSharedTask)}
                    leftIcon={<Share2 className="w-3.5 h-3.5" />}
                  >
                    Share Task Again
                  </Button>
                </div>
              ) : userSubmissions[featuredSharedTask.id] ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#10B981] bg-[#ECFDF5] px-3 py-1.5 rounded-lg border border-[#A7F3D0]">
                    ✓ Already Submitted ({userSubmissions[featuredSharedTask.id].status.replace('_', ' ')})
                  </span>
                </div>
              ) : featuredSharedTask.quantity_approved >= featuredSharedTask.quantity_requested ? (
                <span className="text-xs font-bold text-[#EF4444] bg-[#FEF2F2] px-3 py-1.5 rounded-lg border border-[#FECACA]">
                  This task has reached maximum slots capacity!
                </span>
              ) : (
                <Button
                  size="md"
                  variant="primary"
                  className="w-full sm:w-auto"
                  onClick={() => handleOpenSingleModal(featuredSharedTask)}
                >
                  Accept &amp; Complete Task ({formatNaira(BigInt(featuredSharedTask.reward_per_participant_kobo || 0))})
                </Button>
              )}

              <Button
                size="sm"
                variant="outline"
                onClick={() => setShareTask(featuredSharedTask)}
                leftIcon={<Share2 className="w-3.5 h-3.5" />}
              >
                Share Task
              </Button>
            </div>
          </div>
        )}

        {/* Pro Multi-Task Batch Submission Banner */}
        <div className="bg-[#FFF5F0] border border-[#F95700]/30 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#F95700] text-white flex items-center justify-center shrink-0 mt-0.5">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-[#111827]">
                  Pro Multi-Task Batch Submission
                </h3>
                <Badge variant="premium" className="text-[10px]">
                  PRO BENEFIT
                </Badge>
              </div>
              <p className="text-xs text-[#4B5563] mt-0.5">
                Pro users can select &amp; submit <strong>multiple tasks at once</strong> with one
                click and earn full rewards for every completed task!
              </p>
            </div>
          </div>

          {isPro ? (
            <div className="flex items-center gap-2 shrink-0">
              {eligibleTasks.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSelectAllEligible}
                  leftIcon={
                    batchTaskIds.length === eligibleTasks.length ? (
                      <CheckSquare className="w-4 h-4 text-[#F95700]" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )
                  }
                >
                  {batchTaskIds.length === eligibleTasks.length
                    ? 'Deselect All'
                    : `Select All (${eligibleTasks.length})`}
                </Button>
              )}

              {batchTaskIds.length > 0 && (
                <Button size="sm" variant="primary" onClick={handleOpenBatchModal}>
                  Submit {batchTaskIds.length} Selected ({formatNaira(totalBatchRewardKobo)})
                </Button>
              )}
            </div>
          ) : (
            <Link href="/pro" className="shrink-0">
              <Button size="sm" variant="primary" leftIcon={<Sparkles className="w-4 h-4" />}>
                Unlock Multi-Task Submit (₦200)
              </Button>
            </Link>
          )}
        </div>

        {/* Task Cards Grid */}
        {isLoading ? (
          <div className="text-center py-16 text-[#9CA3AF] text-sm">
            Loading available marketplace tasks...
          </div>
        ) : filteredTasks.length === 0 ? (
          <Card className="text-center py-16 space-y-3">
            <div className="w-12 h-12 bg-[#F3F4F6] text-[#9CA3AF] rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-[#111827]">No Tasks Available Right Now</h3>
            <p className="text-xs text-[#6B7280] max-w-sm mx-auto">
              All active tasks have reached capacity or you have already completed them. Check back
              shortly as new tasks are published regularly.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredTasks.map((task) => {
              const alreadySubmitted = !!userSubmissions[task.id];
              const isOwner = user?.id === task.user_id;
              const isEligible = !alreadySubmitted && !isOwner;
              const isSelected = batchTaskIds.includes(task.id);
              const remaining = task.quantity_requested - task.quantity_approved;
              const reward = BigInt(task.reward_per_participant_kobo);

              return (
                <Card
                  key={task.id}
                  className={`flex flex-col justify-between transition-all ${
                    isSelected
                      ? 'border-2 border-[#F95700] bg-[#FFF5F0]/30 shadow-sm'
                      : task.is_premium
                      ? 'border-[#F59E0B] shadow-sm bg-gradient-to-b from-[#FFFBEB]/30 to-white'
                      : 'hover:border-[#F95700]/40'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        {isPro && isEligible && (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleBatchSelect(task.id)}
                            className="w-4 h-4 accent-[#F95700] rounded cursor-pointer mr-1"
                            title="Select for batch submission"
                          />
                        )}
                        <Badge variant={task.task_type === 'new_user' ? 'primary' : 'secondary'}>
                          {task.task_type === 'new_user' ? 'New Temu User' : 'Existing Temu User'}
                        </Badge>
                        {task.is_premium && (
                          <Badge variant="premium" className="gap-1">
                            <Sparkles className="w-3 h-3" />
                            URGENT
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-[#9CA3AF]">
                        {new Date(task.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-[#111827] line-clamp-1">
                      {task.title}
                    </h3>

                    <div className="bg-[#F7F7F8] p-3 rounded-lg flex items-center justify-between">
                      <div>
                        <span className="text-[11px] text-[#6B7280] block">Participant Reward</span>
                        <span className="text-lg font-extrabold text-[#10B981]">
                          {formatNaira(reward)}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[11px] text-[#6B7280] block">Remaining Slots</span>
                        <span className="text-sm font-bold text-[#111827]">
                          {remaining} / {task.quantity_requested}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-[#6B7280] line-clamp-2">
                      Click Do Task (or select multiple if Pro), enter your Temu name/email, and
                      accept the invite through the official Temu link.
                    </p>
                  </div>

                  <div className="pt-4 mt-2 border-t border-[#E5E7EB] flex items-center gap-2">
                    {isOwner ? (
                      <div className="flex items-center gap-2 w-full">
                        <Button size="sm" variant="outline" className="flex-1" disabled>
                          Your Task
                        </Button>
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => setShareTask(task)}
                          leftIcon={<Share2 className="w-3.5 h-3.5" />}
                        >
                          Share Task
                        </Button>
                      </div>
                    ) : alreadySubmitted ? (
                      <div className="flex items-center gap-2 w-full">
                        {userSubmissions[task.id]?.status === 'declined_disputed' ? (
                          <Button
                            size="sm"
                            variant="danger"
                            className="flex-1 text-xs"
                            onClick={() => {
                              const { reason, proofUrl } = parseDeclineReason(
                                userSubmissions[task.id].decline_reason
                              );
                              setViewProofModal({
                                isOpen: true,
                                taskTitle: task.title,
                                reason,
                                proofUrl,
                              });
                            }}
                          >
                            Declined (View Proof)
                          </Button>
                        ) : (
                          <Button size="sm" variant="secondary" className="flex-1" disabled>
                            Submitted ({userSubmissions[task.id].status.replace('_', ' ')})
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setShareTask(task)}
                          className="px-2.5 text-[#6B7280] hover:text-[#F95700]"
                          title="Share task"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        {isPro && (
                          <Button
                            size="sm"
                            variant={isSelected ? 'primary' : 'outline'}
                            onClick={() => toggleBatchSelect(task.id)}
                            className="px-3"
                          >
                            {isSelected ? 'Selected ✓' : '+ Select'}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="primary"
                          className="flex-1"
                          onClick={() => handleOpenSingleModal(task)}
                        >
                          Do Task ({formatNaira(reward)})
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setShareTask(task)}
                          className="px-2.5 text-[#6B7280] hover:text-[#F95700]"
                          title="Share task with friends"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* Sticky Floating Batch Action Bar when Pro user has selected multiple tasks */}
        {isPro && batchTaskIds.length > 0 && (
          <div className="fixed bottom-16 lg:bottom-6 left-1/2 -translate-x-1/2 z-40 bg-[#111827] text-white px-5 py-3.5 rounded-2xl shadow-xl border border-white/15 flex items-center gap-4 max-w-xl w-[92%] justify-between">
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-[#F95700]" />
                <span>{batchTaskIds.length} Tasks Selected for Batch Submission</span>
              </div>
              <div className="text-[11px] text-[#9CA3AF]">
                Combined Potential Earnings:{' '}
                <strong className="text-[#10B981]">{formatNaira(totalBatchRewardKobo)}</strong>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="text-xs py-1.5 px-2.5 bg-transparent text-white border-white/20 hover:bg-white/10"
                onClick={() => setBatchTaskIds([])}
              >
                Clear
              </Button>
              <Button size="sm" variant="primary" onClick={handleOpenBatchModal}>
                Submit All ({batchTaskIds.length})
              </Button>
            </div>
          </div>
        )}

        {/* Single or Multi-Task Submission Modal */}
        {(selectedTask || isBatchModalOpen) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in">
            <Card className="max-w-md w-full p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3">
                <h3 className="text-lg font-bold text-[#111827]">
                  {isBatchModalOpen
                    ? `Batch Submit ${batchTaskIds.length} Tasks at Once`
                    : 'Complete Temu Task'}
                </h3>
                <button
                  onClick={handleCloseModal}
                  className="text-[#9CA3AF] hover:text-[#111827] text-lg font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="bg-[#FFF5F0] p-3 rounded-lg border border-[#F95700]/20 text-xs text-[#111827] space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-[#F95700]">
                  <AlertCircle className="w-4 h-4" /> Instructions
                </div>
                {isBatchModalOpen ? (
                  <p>
                    1. Enter your Temu name &amp; email once below to submit for all{' '}
                    <strong>{batchTaskIds.length} selected tasks</strong> simultaneously.
                    <br />
                    2. Total combined reward:{' '}
                    <strong className="text-[#10B981]">
                      {formatNaira(totalBatchRewardKobo)}
                    </strong>{' '}
                    upon approval!
                    <br />
                    3. After submitting, open each task&apos;s Temu invitation link to accept the
                    invites.
                  </p>
                ) : (
                  <p>
                    1. Enter your Temu name &amp; email below for owner review.
                    <br />
                    2. Clicking Submit will record your submission and open the owner&apos;s Temu
                    invite link.
                    <br />
                    3. You will earn{' '}
                    <strong>
                      {selectedTask &&
                        formatNaira(BigInt(selectedTask.reward_per_participant_kobo))}
                    </strong>{' '}
                    once approved.
                  </p>
                )}
              </div>

              {errorMsg && (
                <div className="p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-lg text-xs text-[#DC2626]">
                  {errorMsg}
                </div>
              )}

              {successMsg && (
                <div className="p-3 bg-[#ECFDF5] border border-[#A7F3D0] rounded-lg text-xs text-[#059669] space-y-2">
                  <p className="font-semibold">{successMsg}</p>
                  {submittedLinks.length > 0 && (
                    <div className="space-y-1.5 pt-2 border-t border-[#A7F3D0]">
                      <span className="block text-[11px] font-bold text-[#047857]">
                        Click each link below to accept the Temu invitation:
                      </span>
                      {submittedLinks.map((item, idx) => (
                        <a
                          key={item.taskId}
                          href={item.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between p-2 rounded bg-white border border-[#A7F3D0] text-[#111827] hover:border-[#F95700] text-xs font-semibold"
                        >
                          <span className="truncate">
                            {idx + 1}. {item.title} ({formatNaira(BigInt(item.rewardKobo))})
                          </span>
                          <ExternalLink className="w-3.5 h-3.5 text-[#F95700] shrink-0 ml-2" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {submittedLinks.length === 0 ? (
                !user ? (
                  <div className="p-4 bg-[#F7F7F8] rounded-xl text-center space-y-3">
                    <p className="text-xs text-[#6B7280]">
                      Sign in to submit your Temu account info and receive your payout directly into your wallet!
                    </p>
                    <Button
                      size="md"
                      variant="primary"
                      className="w-full"
                      onClick={() =>
                        signInWithGoogle(
                          selectedTask ? `/tasks?taskId=${selectedTask.id}` : '/tasks'
                        )
                      }
                    >
                      Sign In with Google to Complete Task
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmitTask} className="space-y-4">
                    <Input
                      label="Your Temu Profile Name"
                      placeholder="e.g. JohnD or TemuUser_82"
                      value={temuUsername}
                      onChange={(e) => setTemuUsername(e.target.value)}
                      required
                    />

                    <Input
                      label="Your Temu Account Email"
                      type="email"
                      placeholder="e.g. john@example.com"
                      value={temuEmail}
                      onChange={(e) => setTemuEmail(e.target.value)}
                      required
                    />

                    <div className="flex items-center justify-end gap-3 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleCloseModal}
                        disabled={isSubmitting}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        variant="primary"
                        size="sm"
                        isLoading={isSubmitting}
                        rightIcon={<ExternalLink className="w-4 h-4" />}
                      >
                        {isBatchModalOpen
                          ? `Submit All ${batchTaskIds.length} Tasks (${formatNaira(
                              totalBatchRewardKobo
                            )})`
                          : 'Submit & Open Temu'}
                      </Button>
                    </div>
                  </form>
                )
              ) : (
                <div className="flex justify-end pt-2">
                  <Button size="sm" variant="primary" onClick={handleCloseModal}>
                    Done
                  </Button>
                </div>
              )}
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

        {/* Rejection Reason & Proof Modal */}
        {viewProofModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 animate-in fade-in">
            <Card className="max-w-lg w-full p-6 space-y-4 shadow-2xl bg-white max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3">
                <div>
                  <h3 className="text-base font-bold text-[#111827]">Submission Rejected</h3>
                  {viewProofModal.taskTitle && (
                    <p className="text-xs text-[#6B7280]">
                      Task: <strong>{viewProofModal.taskTitle}</strong>
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
                <div className="p-3.5 bg-[#FEF2F2] border border-[#FECACA] rounded-xl text-xs text-[#991B1B] space-y-1">
                  <span className="font-bold block">Owner&apos;s Stated Reason:</span>
                  <p className="leading-relaxed">{viewProofModal.reason}</p>
                </div>

                {viewProofModal.proofUrl ? (
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-[#111827] block">Proof Screenshot from Task Creator:</span>
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
                        Open Full Screenshot <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-[#9CA3AF] italic">No proof screenshot was attached.</p>
                )}

                <div className="p-3 bg-[#FFFBEB] border border-[#FDE68A] rounded-xl text-[11px] text-[#92400E]">
                  <strong>Nightly Admin Dispute Notice:</strong> All rejected submissions are automatically queued for nightly administrator review (11:00 PM Lagos). If the task owner improperly rejected a valid submission, our system will reverse the decline and credit your reward.
                </div>
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
      </div>
    </AppShell>
  );
}
