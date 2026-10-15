export const dynamic = 'force-dynamic';

import { Metadata } from 'next';
import { createAdminClient } from '@/lib/supabase/server';
import { formatNaira, parseTaskTitleAndInstructions } from '@/lib/utils';
import TasksClient from './TasksClient';

interface Props {
  searchParams: { taskId?: string; ref?: string };
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://temutasks.top';
  const taskId = searchParams?.taskId;

  if (taskId) {
    try {
      const adminSupabase = createAdminClient();
      const { data: task } = await adminSupabase
        .from('temutask_tasks')
        .select('*')
        .eq('id', taskId)
        .maybeSingle();

      if (task) {
        const reward = formatNaira(BigInt(task.reward_per_participant_kobo || 0));
        const ogTitle = `🔥 New task available now for ${reward} | TemuTasks`;
        const ogDesc = `Complete now and claim your reward as airtime or cash withdrawal, task ends soon. Complete task here: ${appUrl}/tasks?taskId=${task.id}`;

        return {
          title: ogTitle,
          description: ogDesc,
          openGraph: {
            title: ogTitle,
            description: ogDesc,
            url: `${appUrl}/tasks?taskId=${task.id}`,
            siteName: 'TemuTasks',
            locale: 'en_NG',
            type: 'website',
            images: [
              {
                url: `${appUrl}/og-image.jpg`,
                secureUrl: `${appUrl}/og-image.jpg`,
                width: 1200,
                height: 630,
                type: 'image/jpeg',
                alt: `New Task Available for ${reward}`,
              },
            ],
          },
          twitter: {
            card: 'summary_large_image',
            title: ogTitle,
            description: ogDesc,
            images: [`${appUrl}/og-image.jpg`],
          },
        };
      }
    } catch (e) {
      console.error('Error generating metadata for task:', e);
    }
  }

  const defaultTitle = 'Available Temu Tasks — Complete & Earn Rewards | TemuTasks';
  const defaultDesc =
    'Browse active Temu tasks, accept invite links, and claim your rewards as instant airtime or wallet cash withdrawals.';

  return {
    title: defaultTitle,
    description: defaultDesc,
    openGraph: {
      title: defaultTitle,
      description: defaultDesc,
      url: `${appUrl}/tasks`,
      siteName: 'TemuTasks',
      locale: 'en_NG',
      type: 'website',
      images: [
        {
          url: `${appUrl}/og-image.jpg`,
          secureUrl: `${appUrl}/og-image.jpg`,
          width: 1200,
          height: 630,
          type: 'image/jpeg',
          alt: 'TemuTasks — Available Balance ₦10,000.00 | Complete Tasks & Earn Daily',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: defaultTitle,
      description: defaultDesc,
      images: [`${appUrl}/og-image.jpg`],
    },
  };
}

export default function TasksPage() {
  return <TasksClient />;
}
