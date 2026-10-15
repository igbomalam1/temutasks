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
  ExternalLink,
  Sparkles,
  AlertCircle,
  Layers,
  CheckSquare,
  Square,
  Share2,
  Eye,
  X,
  Clock,
  Upload,
  Trash2,
  Image as ImageIcon,
} from 'lucide-react';
import { ShareTaskModal } from '@/components/tasks/ShareTaskModal';
import { TaskCountdownTimer } from '@/components/tasks/TaskCountdownTimer';

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
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [isUploadingProof, setIsUploadingProof] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [submittedLinks, setSubmittedLinks] = useState<
    { taskId: string; title: string; link: string; rewardKobo: string }[]
  >([]);

  const supabase = createClient();
  const isPro = profile?.tier === 'pro';

  const handleProofFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setErrorMsg('Please select an image screenshot (PNG, JPG, WEBP).');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setErrorMsg('Image size must be under 5MB.');
        return;
      }
      setErrorMsg('');
      setProofFile(file);
      setProofPreview(URL.createObjectURL(file));
    }
  };

  const handleRemoveProofFile = () => {
    setProofFile(null);
    setProofPreview(null);
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
    setProofFile(null);
    setProofPreview(null);
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
    setProofFile(null);
    setProofPreview(null);
  };

  const handleCloseModal = () => {
    setSelectedTask(null);
    setIsBatchModalOpen(false);
    setSubmittedLinks([]);
    setProofFile(null);
    setProofPreview(null);
  };

  const handleSubmitTask = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!temuUsername.trim() || !temuEmail.trim()) {
      setErrorMsg('Please enter both your Temu username and email.');
      return;
    }

    if (!proofFile) {
      setErrorMsg('Please attach a screenshot from your Temu app proving task completion.');
      return;
    }

    setIsSubmitting(true);
    setIsUploadingProof(true);
    setErrorMsg('');

    try {
      // 1. Upload screenshot via server endpoint to bypass client-side storage RLS
      const uploadFormData = new FormData();
      uploadFormData.append('file', proofFile);
      uploadFormData.append('folder', 'submissions');

      const uploadRes = await fetch('/api/tasks/upload-proof', {
        method: 'POST',
        body: uploadFormData,
      });

      const uploadData = await uploadRes.json();
      if (!uploadRes.ok || !uploadData.proofUrl) {
        throw new Error(uploadData.error || 'Failed to upload proof screenshot.');
      }

      const proofUrl = uploadData.proofUrl;
      setIsUploadingProof(false);

      const payload = isBatchModalOpen
        ? {
            taskIds: batchTaskIds,
            temuUsername: temuUsername.trim(),
            temuEmail: temuEmail.trim(),
            proofUrl,
          }
        : {
            taskId: selectedTask?.id,
            temuUsername: temuUsername.trim(),
            temuEmail: temuEmail.trim(),
            proofUrl,
          };

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

      setProofFile(null);
      setProofPreview(null);
      setBatchTaskIds([]);
      await loadTasks();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error submitting task');
    } finally {
      setIsSubmitting(false);
      setIsUploadingProof(false);
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

        {/* How It Works for Participants Banner */}
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 sm:p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#FFF5F0] text-[#F95700] flex items-center justify-center font-bold text-xs">
              💡
            </div>
            <h2 className="text-sm font-bold text-[#111827]">
              How to Complete Tasks &amp; Earn Rewards
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 bg-[#F9FAFB] rounded-xl border border-[#E5E7EB] space-y-1">
              <span className="w-5 h-5 rounded-full bg-[#111827] text-white flex items-center justify-center text-[10px] font-bold">1</span>
              <p className="font-semibold text-[#111827]">Select a Task</p>
              <p className="text-[11px] text-[#6B7280]">Pick an existing or new user task with remaining slots.</p>
            </div>
            <div className="p-3 bg-[#F9FAFB] rounded-xl border border-[#E5E7EB] space-y-1">
              <span className="w-5 h-5 rounded-full bg-[#111827] text-white flex items-center justify-center text-[10px] font-bold">2</span>
              <p className="font-semibold text-[#111827]">Accept Invite on Temu</p>
              <p className="text-[11px] text-[#6B7280]">Open the link in your Temu app &amp; accept the invite.</p>
            </div>
            <div className="p-3 bg-[#F9FAFB] rounded-xl border border-[#E5E7EB] space-y-1">
              <span className="w-5 h-5 rounded-full bg-[#111827] text-white flex items-center justify-center text-[10px] font-bold">3</span>
              <p className="font-semibold text-[#111827]">Submit Temu Details</p>
              <p className="text-[11px] text-[#6B7280]">Enter your Temu username &amp; email for verification.</p>
            </div>
            <div className="p-3 bg-[#ECFDF5] rounded-xl border border-[#A7F3D0] space-y-1">
              <span className="w-5 h-5 rounded-full bg-[#10B981] text-white flex items-center justify-center text-[10px] font-bold">4</span>
              <p className="font-semibold text-[#065F46]">Get Paid Instantly</p>
              <p className="text-[11px] text-[#047857]">Earnings credited directly to your wallet on approval.</p>
            </div>
          </div>
        </div>

        {/* Featured Shared Task Banner when accessed via shared link */}
        {featuredSharedTask && (
          <div className="bg-gradient-to-r from-[#FFF5F0] via-white to-[#FFF5F0] border-2 border-[#F95700] rounded-2xl p-5 sm:p-6 shadow-md space-y-4 animate-in fade-in">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="space-y-1.5 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="primary" className="bg-[#F95700] text-white">
                    ⭐ Shared Task
                  </Badge>
                  <Badge variant={featuredSharedTask.task_type === 'new_user' ? 'primary' : 'secondary'}>
                    {featuredSharedTask.task_type === 'new_user' ? 'New Temu User' : 'Existing Temu User'}
                  </Badge>
                  {featuredSharedTask.is_premium && (
                    <Badge variant="premium">URGENT</Badge>
                  )}
                  <TaskCountdownTimer
                    createdAt={featuredSharedTask.created_at}
                    expiresAt={featuredSharedTask.expires_at}
                    durationHours={featuredSharedTask.duration_hours}
                    status={featuredSharedTask.status}
                  />
                </div>
                <h2 className="text-xl font-extrabold text-[#111827]">
                  {parseTaskTitleAndInstructions(featuredSharedTask.title).title}
                </h2>
                <p className="text-xs text-[#6B7280]">
                  {parseTaskTitleAndInstructions(featuredSharedTask.title).instructions}
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
              ) : featuredSharedTask.status === 'cancelled' ? (
                <span className="text-xs font-bold text-[#6B7280] bg-[#F3F4F6] px-3 py-1.5 rounded-lg border border-[#E5E7EB]">
                  This task was ended by its creator and is no longer accepting submissions.
                </span>
              ) : featuredSharedTask.status === 'paused' ? (
                <span className="text-xs font-bold text-[#F59E0B] bg-[#FFFBEB] px-3 py-1.5 rounded-lg border border-[#FDE68A]">
                  This task is currently paused by its creator.
                </span>
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
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
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
                      <TaskCountdownTimer
                        createdAt={task.created_at}
                        expiresAt={task.expires_at}
                        durationHours={task.duration_hours}
                        status={task.status}
                      />
                    </div>

                    <h3 className="text-base font-bold text-[#111827] line-clamp-1">
                      {parseTaskTitleAndInstructions(task.title).title}
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

                    <div className="bg-[#F9FAFB] rounded-lg p-2.5 border border-[#E5E7EB] text-xs space-y-1">
                      <div className="text-[11px] font-bold text-[#374151] flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 text-[#F95700]" />
                        <span>Task Instructions:</span>
                      </div>
                      <p className="text-xs text-[#4B5563] line-clamp-2 leading-relaxed">
                        {parseTaskTitleAndInstructions(task.title).instructions}
                      </p>
                    </div>
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto animate-in fade-in">
            <div className="bg-white rounded-2xl max-w-md w-full max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2.5rem)] flex flex-col shadow-2xl relative border border-[#E5E7EB] overflow-hidden my-auto animate-in zoom-in-95 duration-200">
              {/* Sticky Header */}
              <div className="p-3.5 sm:p-4 border-b border-[#E5E7EB] flex items-center justify-between shrink-0 bg-white">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm sm:text-base font-bold text-[#111827]">
                    {isBatchModalOpen
                      ? `Batch Submit (${batchTaskIds.length} Tasks)`
                      : 'Complete Temu Task'}
                  </h3>
                  {selectedTask && (
                    <TaskCountdownTimer
                      createdAt={selectedTask.created_at}
                      expiresAt={selectedTask.expires_at}
                      durationHours={selectedTask.duration_hours}
                      status={selectedTask.status}
                      variant="compact"
                    />
                  )}
                </div>
                <button
                  onClick={handleCloseModal}
                  className="p-1 rounded-full text-[#9CA3AF] hover:text-[#111827] hover:bg-[#F3F4F6] transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable Body */}
              <div className="overflow-y-auto p-4 sm:p-5 space-y-3.5 flex-1">
                <div className="bg-[#FFF5F0] p-3 sm:p-3.5 rounded-xl border border-[#F95700]/25 text-xs text-[#111827] space-y-2">
                  <div className="font-bold flex items-center gap-1.5 text-[#F95700]">
                    <AlertCircle className="w-4 h-4" /> Task Instructions:
                  </div>
                  {isBatchModalOpen ? (
                    <div className="space-y-1.5 text-xs text-[#374151]">
                      <div className="flex items-start gap-2">
                        <span className="w-4 h-4 rounded-full bg-[#F95700] text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">1</span>
                        <span>Enter your Temu account username &amp; email below to submit for all <strong>{batchTaskIds.length} tasks</strong> at once.</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="w-4 h-4 rounded-full bg-[#F95700] text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">2</span>
                        <span>After submitting, click each task&apos;s Temu invitation link to accept the invites in your Temu app.</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="w-4 h-4 rounded-full bg-[#10B981] text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">3</span>
                        <span>Earn a combined <strong className="text-[#10B981]">{formatNaira(totalBatchRewardKobo)}</strong> once verified!</span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <p className="leading-relaxed bg-white/80 p-2 sm:p-2.5 rounded-lg border border-[#F95700]/15 text-[#374151] text-xs">
                        {parseTaskTitleAndInstructions(selectedTask?.title).instructions}
                      </p>
                      <div className="grid grid-cols-1 gap-1 text-[11px] text-[#4B5563]">
                        <div className="flex items-center gap-1.5">
                          <span className="w-3.5 h-3.5 rounded-full bg-[#F95700] text-white flex items-center justify-center text-[9px] font-bold shrink-0">1</span>
                          <span>Click the link &amp; open in Temu app. Make sure to accept the invite.</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-3.5 h-3.5 rounded-full bg-[#F95700] text-white flex items-center justify-center text-[9px] font-bold shrink-0">2</span>
                          <span>Submit your Temu name &amp; email below for verification.</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-3.5 h-3.5 rounded-full bg-[#10B981] text-white flex items-center justify-center text-[9px] font-bold shrink-0">3</span>
                          <span>Earn <strong className="text-[#10B981]">{selectedTask && formatNaira(BigInt(selectedTask.reward_per_participant_kobo))}</strong> upon verification!</span>
                        </div>
                      </div>
                    </div>
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

                {submittedLinks.length === 0 && (
                  !user ? (
                    <div className="p-4 bg-[#F7F7F8] rounded-xl text-center space-y-3">
                      <p className="text-xs text-[#6B7280]">
                        Sign in to submit your Temu account info and receive your payout directly into your wallet!
                      </p>
                      <Button
                        size="md"
                        variant="primary"
                        className="w-full text-xs font-bold"
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
                    <form id="task-submit-form" onSubmit={handleSubmitTask} className="space-y-3.5">
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

                      {/* Proof of Task Completion Screenshot */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-[#111827]">
                          Proof of Task Completion Screenshot <span className="text-[#EF4444]">*</span>
                        </label>
                        <p className="text-[11px] text-[#6B7280]">
                          Upload a screenshot from your Temu app showing your invite acceptance or activity screen so the creator can verify your submission.
                        </p>

                        {proofPreview ? (
                          <div className="relative rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-2.5 flex flex-col items-center">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={proofPreview}
                              alt="Proof Preview"
                              className="max-h-48 rounded-lg object-contain"
                            />
                            <div className="mt-2 flex items-center justify-between w-full px-1">
                              <span className="text-xs text-[#4B5563] truncate max-w-[200px] font-mono">
                                {proofFile?.name}
                              </span>
                              <button
                                type="button"
                                onClick={handleRemoveProofFile}
                                className="inline-flex items-center gap-1 text-xs font-bold text-[#EF4444] hover:underline"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> Remove
                              </button>
                            </div>
                          </div>
                        ) : (
                          <label className="border-2 border-dashed border-[#D1D5DB] hover:border-[#F95700] rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer bg-[#F7F7F8] hover:bg-orange-50/20 transition-colors">
                            <Upload className="w-6 h-6 text-[#9CA3AF] mb-1.5" />
                            <span className="text-xs font-bold text-[#111827]">
                              Click to upload Temu screenshot
                            </span>
                            <span className="text-[10px] text-[#6B7280] mt-0.5">
                              PNG, JPG, or WEBP up to 5MB
                            </span>
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/webp,image/jpg"
                              className="hidden"
                              onChange={handleProofFileSelect}
                            />
                          </label>
                        )}
                      </div>
                    </form>
                  )
                )}
              </div>

              {/* Sticky Footer */}
              <div className="p-3 sm:p-3.5 border-t border-[#E5E7EB] bg-[#F7F7F8] flex items-center justify-end gap-2.5 shrink-0">
                {submittedLinks.length === 0 ? (
                  user && (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleCloseModal}
                        disabled={isSubmitting || isUploadingProof}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        form="task-submit-form"
                        variant="primary"
                        size="sm"
                        isLoading={isSubmitting || isUploadingProof}
                        rightIcon={<ExternalLink className="w-4 h-4" />}
                      >
                        {isUploadingProof
                          ? 'Uploading Proof...'
                          : isSubmitting
                          ? 'Submitting...'
                          : isBatchModalOpen
                          ? `Submit All ${batchTaskIds.length} Tasks (${formatNaira(
                              totalBatchRewardKobo
                            )})`
                          : 'Submit & Open Temu'}
                      </Button>
                    </>
                  )
                ) : (
                  <Button size="sm" variant="primary" onClick={handleCloseModal}>
                    Done
                  </Button>
                )}
              </div>
            </div>
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto animate-in fade-in">
            <div className="bg-white rounded-2xl max-w-lg w-full max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2.5rem)] flex flex-col shadow-2xl relative border border-[#E5E7EB] overflow-hidden my-auto animate-in zoom-in-95 duration-200">
              <div className="p-3.5 sm:p-4 border-b border-[#E5E7EB] flex items-center justify-between shrink-0 bg-white">
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-[#111827]">Submission Rejected</h3>
                  {viewProofModal.taskTitle && (
                    <p className="text-xs text-[#6B7280]">
                      Task: <strong>{viewProofModal.taskTitle}</strong>
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setViewProofModal({ isOpen: false, reason: '' })}
                  className="p-1 rounded-full text-[#9CA3AF] hover:text-[#111827] hover:bg-[#F3F4F6] transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="overflow-y-auto p-4 sm:p-5 space-y-3.5 flex-1">
                <div className="p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-xl text-xs text-[#991B1B] space-y-1">
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
                        className="w-full max-h-[45vh] sm:max-h-[350px] object-contain rounded-lg mx-auto"
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
                  <strong>Daily Admin Dispute Notice:</strong> All rejected submissions are automatically queued for morning administrator review (10:00 AM Lagos). If the task owner improperly rejected a valid submission, our system will reverse the decline and credit your reward.
                </div>
              </div>

              <div className="p-3 sm:p-4 border-t border-[#E5E7EB] bg-[#F9FAFB] flex justify-end shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setViewProofModal({ isOpen: false, reason: '' })}
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
