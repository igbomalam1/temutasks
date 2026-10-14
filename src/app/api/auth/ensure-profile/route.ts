import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const adminSupabase = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const ref = body.ref;

    // 1. Check if profile already exists using admin client (bypasses any RLS edge cases)
    let { data: profile } = await adminSupabase
      .from('temutask_profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile) {
      // Automatic account creation for first-time user
      const baseCode = (
        user.user_metadata?.full_name?.replace(/[^a-zA-Z0-9]/g, '').substring(0, 5) ||
        user.email?.split('@')[0]?.replace(/[^a-zA-Z0-9]/g, '').substring(0, 5) ||
        'TEMU'
      ).toUpperCase();

      const uniqueCode = `${baseCode}${Math.floor(1000 + Math.random() * 9000)}`;

      let referrerId: string | null = null;
      if (ref && typeof ref === 'string') {
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
        'TemuTasks Member';

      const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture || '';

      const { data: createdProfile, error: insertError } = await adminSupabase
        .from('temutask_profiles')
        .insert({
          id: user.id,
          email: user.email!,
          full_name: fullName,
          avatar_url: avatarUrl,
          referral_code: uniqueCode,
          referred_by: referrerId,
          tier: 'basic',
          role: 'user',
          status: 'active',
        })
        .select('*')
        .single();

      if (!insertError && createdProfile) {
        profile = createdProfile;
      }

      // Ensure wallet exists
      await adminSupabase
        .from('temutask_wallets')
        .upsert(
          {
            user_id: user.id,
            balance_kobo: 0,
            pending_kobo: 0,
            reserved_kobo: 0,
          },
          { onConflict: 'user_id' }
        );

      // Ensure notification preferences exist
      await adminSupabase
        .from('temutask_notification_preferences')
        .upsert(
          {
            user_id: user.id,
            email_task_alerts: false,
            email_transactions: true,
            in_app_alerts: true,
          },
          { onConflict: 'user_id' }
        );
    } else if (!profile.referral_code) {
      // Backfill referral_code if missing on an existing profile
      const baseCode = (
        profile.full_name?.replace(/[^a-zA-Z0-9]/g, '').substring(0, 5) || 'TEMU'
      ).toUpperCase();
      const uniqueCode = `${baseCode}${Math.floor(1000 + Math.random() * 9000)}`;

      const { data: updated } = await adminSupabase
        .from('temutask_profiles')
        .update({ referral_code: uniqueCode })
        .eq('id', user.id)
        .select('*')
        .single();

      if (updated) profile = updated;
    }

    // Fetch wallet
    let { data: wallet } = await adminSupabase
      .from('temutask_wallets')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!wallet) {
      const { data: newWallet } = await adminSupabase
        .from('temutask_wallets')
        .insert({
          user_id: user.id,
          balance_kobo: 0,
          pending_kobo: 0,
          reserved_kobo: 0,
        })
        .select('*')
        .single();
      wallet = newWallet;
    }

    return NextResponse.json({ profile, wallet });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
