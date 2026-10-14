export const dynamic = 'force-dynamic';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { sendEmail, renderEmailTemplate } from '@/lib/sendbyte';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const ref = requestUrl.searchParams.get('ref');
  const origin = requestUrl.origin;

  if (code) {
    const supabase = createClient();
    const adminSupabase = createAdminClient();
    const { data: authData, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('OAuth exchange error:', error);
      return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
    }

    const user = authData.user;
    if (user) {
      // Check if profile already exists using admin client
      const { data: profile } = await adminSupabase
        .from('temutask_profiles')
        .select('id, referral_code')
        .eq('id', user.id)
        .maybeSingle();

      if (!profile) {
        // Automatic account creation for first-time Google sign-in
        const uniqueCode = (
          (user.user_metadata?.full_name?.replace(/[^a-zA-Z0-9]/g, '').substring(0, 5) || 'USER') +
          Math.floor(1000 + Math.random() * 9000)
        ).toUpperCase();

        let referrerId: string | null = null;

        // Attribute referral if valid ref passed in query or cookie
        if (ref) {
          const { data: refProfile } = await adminSupabase
            .from('temutask_profiles')
            .select('id')
            .eq('referral_code', ref.toUpperCase().trim())
            .maybeSingle();

          if (refProfile && refProfile.id !== user.id) {
            referrerId = refProfile.id;
          }
        }

        const fullName =
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.email?.split('@')[0] ||
          'TemuTasks User';

        const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture || '';

        const isAdminEmail = user.email?.toLowerCase() === 'ibngahd01@gmail.com';

        // Insert new profile via admin client
        const { error: profileError } = await adminSupabase.from('temutask_profiles').insert({
          id: user.id,
          email: user.email!,
          full_name: fullName,
          avatar_url: avatarUrl,
          referral_code: uniqueCode,
          referred_by: referrerId,
          tier: isAdminEmail ? 'pro' : 'basic',
          role: isAdminEmail ? 'admin' : 'user',
          status: 'active',
        });

        if (profileError) {
          console.error('Error creating profile:', profileError);
        }

        // Initialize wallet via admin client
        await adminSupabase.from('temutask_wallets').upsert(
          {
            user_id: user.id,
            balance_kobo: 0,
            pending_kobo: 0,
            reserved_kobo: 0,
          },
          { onConflict: 'user_id' }
        );

        // Initialize notification preferences
        await adminSupabase.from('temutask_notification_preferences').upsert(
          {
            user_id: user.id,
            email_task_alerts: false, // Basic users do NOT get recurring task alerts
            email_transactions: true,
            in_app_alerts: true,
          },
          { onConflict: 'user_id' }
        );

        // Create welcome in-app notification
        await adminSupabase.from('temutask_notifications').insert({
          user_id: user.id,
          title: 'Welcome to TemuTasks! 🚀',
          message:
            'Start completing tasks to earn rewards, share your referral link to earn lifetime commissions, or fund a task to boost your Temu invitations.',
          type: 'welcome',
          link: '/dashboard',
        });

        // Send welcome email
        if (user.email) {
          const welcomeHtml = renderEmailTemplate({
            title: 'Welcome to TemuTasks! 🚀',
            contentHtml: `<p>Hello ${fullName},</p>
            <p>Welcome to <strong>TemuTasks</strong> — Nigeria's premier Temu participant rewards and task fulfillment platform.</p>
            <p><strong>Your Account Details:</strong></p>
            <ul>
              <li><strong>Email:</strong> ${user.email}</li>
              <li><strong>Referral Code:</strong> <strong style="color: #F95700;">${uniqueCode}</strong></li>
              <li><strong>Referral Link:</strong> ${origin}/login?ref=${uniqueCode}</li>
            </ul>
            <p><strong>How to Get Started:</strong></p>
            <ol>
              <li><strong>Browse Available Tasks:</strong> Complete simple Temu invitation clicks and earn cash rewards directly to your wallet.</li>
              <li><strong>Invite Friends:</strong> Earn ₦10 or ₦50 lifetime commission every time your friends complete tasks.</li>
              <li><strong>Create Tasks:</strong> Need Temu clicks or new users for your own games? Launch a funded task in seconds!</li>
            </ol>`,
            ctaText: 'Go to Dashboard',
            ctaUrl: `${origin}/dashboard`,
          });

          sendEmail({
            to: user.email,
            subject: 'Welcome to TemuTasks! 🚀 Get Started & Earn Rewards',
            html: welcomeHtml,
            eventType: 'user_welcome',
          }).catch((e) => console.error('Error sending welcome email:', e));
        }
      }
    }
  }

  // URL to redirect to after sign in process completes
  const next = requestUrl.searchParams.get('next');
  const destination = next && next.startsWith('/') ? next : '/dashboard';
  return NextResponse.redirect(`${origin}${destination}`);
}
