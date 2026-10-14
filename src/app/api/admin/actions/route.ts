import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const adminSupabase = createAdminClient();

    // Verify requesting user is admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: adminProfile } = await adminSupabase
      .from('temutask_profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (adminProfile?.role !== 'admin' && adminProfile?.role !== 'moderator') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { action, userId, amountNaira, days, reason } = body;

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Fetch target user profile
    const { data: targetUser, error: targetError } = await adminSupabase
      .from('temutask_profiles')
      .select('id, email, full_name, tier, pro_expires_at')
      .eq('id', userId)
      .single();

    if (targetError || !targetUser) {
      return NextResponse.json({ error: 'Target user not found' }, { status: 404 });
    }

    // 1. ACTION: CREDIT USER WALLET
    if (action === 'credit_wallet') {
      const amt = Number(amountNaira);
      if (!amt || amt <= 0) {
        return NextResponse.json({ error: 'Please enter a valid credit amount in Naira' }, { status: 400 });
      }

      const creditKobo = BigInt(Math.round(amt * 100));
      const ref = `ADM-CRD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

      // Fetch or create wallet
      const { data: wallet } = await adminSupabase
        .from('temutask_wallets')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      const currentBalance = BigInt(wallet?.balance_kobo || 0);
      const currentEarned = BigInt(wallet?.total_earned_kobo || 0);

      const newBalance = currentBalance + creditKobo;
      const newEarned = currentEarned + creditKobo;

      await adminSupabase.from('temutask_wallets').upsert(
        {
          user_id: userId,
          balance_kobo: newBalance.toString(),
          total_earned_kobo: newEarned.toString(),
        },
        { onConflict: 'user_id' }
      );

      // Record in immutable wallet ledger
      await adminSupabase.from('temutask_wallet_ledger').insert({
        user_id: userId,
        transaction_type: 'admin_credit',
        amount_kobo: creditKobo.toString(),
        direction: 'credit',
        status: 'completed',
        reference: ref,
        description: reason?.trim() || `Admin wallet credit by ${user.email}`,
      });

      // Notify user in-app
      await adminSupabase.from('temutask_notifications').insert({
        user_id: userId,
        title: 'Wallet Credited by Admin 💰',
        message: `Your wallet has been credited with ₦${amt.toLocaleString()} (${reason?.trim() || 'Admin adjustment'}). New balance: ₦${(Number(newBalance) / 100).toLocaleString()}.`,
        type: 'wallet_credit',
        link: '/wallet',
      });

      // Audit log
      await adminSupabase.from('temutask_admin_audit_logs').insert({
        admin_id: user.id,
        action: 'credit_user_wallet',
        target_type: 'user',
        target_id: userId,
        details: { amountNaira: amt, reason, reference: ref },
      });

      return NextResponse.json({
        success: true,
        message: `Successfully credited ₦${amt.toLocaleString()} to ${targetUser.email}!`,
        newBalanceKobo: newBalance.toString(),
      });
    }

    // 2. ACTION: UPGRADE / EXTEND USER PRO MEMBERSHIP
    if (action === 'upgrade_pro') {
      const durationDays = Number(days) || 14;
      const now = new Date();
      let expiresAt: Date;

      if (
        targetUser.tier === 'pro' &&
        targetUser.pro_expires_at &&
        new Date(targetUser.pro_expires_at) > now
      ) {
        expiresAt = new Date(new Date(targetUser.pro_expires_at).getTime() + durationDays * 24 * 60 * 60 * 1000);
      } else {
        expiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
      }

      const ref = `ADM-PRO-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

      // Update user profile
      await adminSupabase
        .from('temutask_profiles')
        .update({
          tier: 'pro',
          pro_expires_at: expiresAt.toISOString(),
        })
        .eq('id', userId);

      // Record in pro memberships table
      await adminSupabase.from('temutask_pro_memberships').insert({
        user_id: userId,
        payment_method: 'wallet',
        amount_kobo: 0,
        reference: ref,
        starts_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
        status: 'active',
      });

      // Notify user in-app
      await adminSupabase.from('temutask_notifications').insert({
        user_id: userId,
        title: 'Upgraded to TemuTasks Pro! ⭐',
        message: `An administrator has upgraded your account to Pro for ${durationDays} days (Expires: ${expiresAt.toLocaleDateString()}). You can now batch submit multiple tasks at once and receive instant email alerts!`,
        type: 'pro_upgrade',
        link: '/pro',
      });

      // Audit log
      await adminSupabase.from('temutask_admin_audit_logs').insert({
        admin_id: user.id,
        action: 'upgrade_user_pro',
        target_type: 'user',
        target_id: userId,
        details: { durationDays, expiresAt: expiresAt.toISOString(), reason },
      });

      return NextResponse.json({
        success: true,
        message: `Successfully granted ${durationDays} days of Pro membership to ${targetUser.email}!`,
        expiresAt: expiresAt.toISOString(),
      });
    }

    // 3. ACTION: DOWNGRADE PRO TO BASIC
    if (action === 'downgrade_basic') {
      await adminSupabase
        .from('temutask_profiles')
        .update({
          tier: 'basic',
          pro_expires_at: null,
        })
        .eq('id', userId);

      await adminSupabase.from('temutask_admin_audit_logs').insert({
        admin_id: user.id,
        action: 'downgrade_user_basic',
        target_type: 'user',
        target_id: userId,
        details: { reason },
      });

      return NextResponse.json({
        success: true,
        message: `Changed ${targetUser.email} tier to Basic.`,
      });
    }

    return NextResponse.json({ error: 'Invalid admin action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
