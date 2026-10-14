import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { sendEmail, renderEmailTemplate } from '@/lib/sendbyte';

export const dynamic = 'force-dynamic';

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
      // SECURITY: Only primary superadmin ibngahd01@gmail.com is authorized to manually credit wallets
      if (user.email?.toLowerCase() !== 'ibngahd01@gmail.com') {
        return NextResponse.json({
          error: 'Security Restriction: Only the primary superadmin (ibngahd01@gmail.com) is authorized to credit user wallets.'
        }, { status: 403 });
      }

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

      // Email the credited user
      if (targetUser.email) {
        const userEmailHtml = renderEmailTemplate({
          title: 'Your Wallet Has Been Credited 💰',
          contentHtml: `<p>Hello ${targetUser.full_name || 'User'},</p>
          <p>Your TemuTasks wallet has been credited:</p>
          <p><strong>Amount Credited:</strong> ₦${amt.toLocaleString()}.00<br>
          <strong>Reason / Note:</strong> ${reason?.trim() || 'Admin adjustment'}<br>
          <strong>Reference:</strong> ${ref}<br>
          <strong>New Available Balance:</strong> ₦${(Number(newBalance) / 100).toLocaleString()}.00</p>
          <p>You can use your balance to buy airtime or request cash out anytime.</p>`,
          ctaText: 'Open Wallet',
          ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://temutasks.top'}/wallet`,
        });

        sendEmail({
          to: targetUser.email,
          subject: `[TemuTasks] Wallet Credited: ₦${amt.toLocaleString()}`,
          html: userEmailHtml,
          eventType: 'admin_credit_recipient',
        }).catch((e) => console.error('Error emailing credited user:', e));
      }

      // Security requirement: Superadmin at ibngahd01@gmail.com is immediately notified whenever any wallet is credited
      const adminAlertHtml = renderEmailTemplate({
        title: '🛡️ Security Alert: User Wallet Credited',
        contentHtml: `<p>A manual wallet credit has just been executed on TemuTasks:</p>
        <p><strong>Recipient Email:</strong> ${targetUser.email}<br>
        <strong>Recipient ID:</strong> ${userId}<br>
        <strong>Amount Credited:</strong> ₦${amt.toLocaleString()}.00<br>
        <strong>New Total Balance:</strong> ₦${(Number(newBalance) / 100).toLocaleString()}.00<br>
        <strong>Reason / Note:</strong> ${reason?.trim() || 'Admin adjustment'}<br>
        <strong>Authorized By:</strong> ${user.email}<br>
        <strong>Audit Reference:</strong> ${ref}<br>
        <strong>Timestamp:</strong> ${new Date().toISOString()}</p>
        <p style="color: #6B7280; font-size: 13px;">This security notification confirms that only authorized admin credits can alter balances outside of task completions and Novac deposits.</p>`,
        ctaText: 'View Admin Panel',
        ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://temutasks.top'}/admin`,
      });

      sendEmail({
        to: 'ibngahd01@gmail.com',
        subject: `[Security Alert] User Wallet Credited: ₦${amt.toLocaleString()} (${targetUser.email})`,
        html: adminAlertHtml,
        eventType: 'superadmin_credit_alert',
      }).catch((e) => console.error('Error notifying superadmin of credit:', e));

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

      // Email the upgraded user
      if (targetUser.email) {
        const proEmailHtml = renderEmailTemplate({
          title: 'Welcome to TemuTasks Pro! ⭐',
          contentHtml: `<p>Hello ${targetUser.full_name || 'User'},</p>
          <p>Great news! Your account has been upgraded to <strong>TemuTasks Pro</strong> for ${durationDays} days.</p>
          <p><strong>Expiry Date:</strong> ${expiresAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}<br>
          <strong>Reference:</strong> ${ref}</p>
          <p><strong>Pro Privileges Unlocked:</strong></p>
          <ul>
            <li><strong>Batch Task Submissions:</strong> Pro users can submit multiple tasks at once and earn for all</li>
            <li><strong>Instant Task Alerts:</strong> Receive real-time email notifications when new tasks are published</li>
            <li><strong>Priority Clearance:</strong> Fastest approval during nightly clearance rounds</li>
            <li><strong>Pro Verified Badge</strong> on your profile and dashboard</li>
          </ul>`,
          ctaText: 'Open Pro Dashboard',
          ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://temutasks.top'}/dashboard`,
        });

        sendEmail({
          to: targetUser.email,
          subject: `[TemuTasks Pro] Your Account Has Been Upgraded! ⭐`,
          html: proEmailHtml,
          eventType: 'pro_upgrade_confirmation',
        }).catch((e) => console.error('Error emailing upgraded pro user:', e));
      }

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

    // 4. ACTION: PAY WITHDRAWAL
    if (action === 'pay_withdrawal') {
      const { withdrawalId } = body;
      if (!withdrawalId) {
        return NextResponse.json({ error: 'Withdrawal ID required' }, { status: 400 });
      }

      const { data: wth } = await adminSupabase
        .from('temutask_withdrawals')
        .select('*, temutask_profiles!user_id(email, full_name)')
        .eq('id', withdrawalId)
        .maybeSingle();

      if (!wth) {
        return NextResponse.json({ error: 'Withdrawal request not found' }, { status: 404 });
      }

      await adminSupabase
        .from('temutask_withdrawals')
        .update({
          status: 'paid',
          processed_by: user.id,
          processed_at: new Date().toISOString(),
        })
        .eq('id', withdrawalId);

      const amtNaira = (Number(wth.amount_kobo) / 100).toLocaleString();

      // In-app notification
      await adminSupabase.from('temutask_notifications').insert({
        user_id: wth.user_id,
        title: 'Cash Out Paid! 💸',
        message: `Your withdrawal of ₦${amtNaira} to ${wth.payment_destination?.toUpperCase()} (${wth.account_number}) has been completed. Ref: ${wth.reference}.`,
        type: 'withdrawal_paid',
        link: '/wallet',
      });

      // Email receipt to user
      const recipientEmail = wth.temutask_profiles?.email;
      if (recipientEmail) {
        const payoutHtml = renderEmailTemplate({
          title: 'Your Cash Out Has Been Paid! 💸',
          contentHtml: `<p>Hello ${wth.temutask_profiles?.full_name || 'User'},</p>
          <p>Your withdrawal request has been successfully processed and disbursed:</p>
          <p><strong>Net Amount Paid:</strong> <span style="font-size: 16px; color: #10B981; font-weight: bold;">₦${amtNaira}.00</span><br>
          <strong>Platform Transfer Fee:</strong> ₦50.00<br>
          <strong>Destination:</strong> ${wth.payment_destination?.toUpperCase()}<br>
          <strong>Account Number:</strong> ${wth.account_number}<br>
          <strong>Account Name:</strong> ${wth.account_name}<br>
          <strong>Reference:</strong> ${wth.reference}</p>
          <p>The funds should reflect in your bank/wallet account shortly.</p>`,
          ctaText: 'View Wallet',
          ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://temutasks.top'}/wallet`,
        });

        sendEmail({
          to: recipientEmail,
          subject: `[TemuTasks] Withdrawal Paid: ₦${amtNaira}`,
          html: payoutHtml,
          eventType: 'withdrawal_completed',
        }).catch((e) => console.error('Error emailing withdrawal payout:', e));
      }

      await adminSupabase.from('temutask_admin_audit_logs').insert({
        admin_id: user.id,
        action: 'pay_withdrawal',
        target_type: 'withdrawal',
        target_id: withdrawalId,
        details: { amount_kobo: wth.amount_kobo, reference: wth.reference },
      });

      return NextResponse.json({ success: true, message: `Withdrawal of ₦${amtNaira} marked as paid!` });
    }

    return NextResponse.json({ error: 'Invalid admin action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
