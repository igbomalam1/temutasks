export const dynamic = 'force-dynamic';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { executeWalletTransaction } from '@/lib/wallet';
import { initiateNovacPayment } from '@/lib/novac';
import { generateRef } from '@/lib/utils';
import { sendEmail, renderEmailTemplate } from '@/lib/sendbyte';

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const adminSupabase = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { paymentMethod } = await request.json();
    const proCostNaira = 200;
    const proCostKobo = BigInt(20000);
    const durationMs = 14 * 24 * 60 * 60 * 1000; // 14 days

    // Fetch existing profile to handle renewal extension correctly
    const { data: profile } = await adminSupabase
      .from('temutask_profiles')
      .select('tier, pro_expires_at')
      .eq('id', user.id)
      .single();

    let newExpiresAt: Date;
    const now = new Date();

    if (profile?.tier === 'pro' && profile?.pro_expires_at && new Date(profile.pro_expires_at) > now) {
      // Extend existing unexpired time by 14 days
      newExpiresAt = new Date(new Date(profile.pro_expires_at).getTime() + durationMs);
    } else {
      // Start fresh 14 days
      newExpiresAt = new Date(now.getTime() + durationMs);
    }

    // 1. Pay with Wallet
    if (paymentMethod === 'wallet') {
      const reference = generateRef('PRO-WLT');

      const debitResult = await executeWalletTransaction({
        userId: user.id,
        amountKobo: proCostKobo,
        direction: 'debit',
        transactionType: 'pro_subscription_wallet',
        description: 'TemuTasks Pro 14-day membership upgrade',
        relatedId: reference,
        idempotencyKey: `PRO-WLT-${reference}`,
      });

      if (!debitResult.success) {
        return NextResponse.json({ error: debitResult.error || 'Insufficient wallet balance' }, { status: 400 });
      }

      // Update profile to Pro
      await adminSupabase
        .from('temutask_profiles')
        .update({
          tier: 'pro',
          pro_expires_at: newExpiresAt.toISOString(),
        })
        .eq('id', user.id);

      // Enable task alerts preference
      await adminSupabase
        .from('temutask_notification_preferences')
        .upsert({
          user_id: user.id,
          email_task_alerts: true,
        });

      // Record membership history
      await adminSupabase.from('temutask_pro_memberships').insert({
        user_id: user.id,
        payment_method: 'wallet',
        amount_kobo: proCostKobo.toString(),
        reference,
        starts_at: now.toISOString(),
        expires_at: newExpiresAt.toISOString(),
        status: 'active',
      });

      // Send confirmation email
      if (user.email) {
        const proEmailHtml = renderEmailTemplate({
          title: 'Welcome to TemuTasks Pro! ⭐',
          contentHtml: `<p>Congratulations! Your upgrade to <strong>TemuTasks Pro</strong> (14 Days) was successful.</p>
          <p><strong>Expiry Date:</strong> ${newExpiresAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}<br>
          <strong>Cost:</strong> ₦${proCostNaira}.00 (debited from wallet)<br>
          <strong>Reference:</strong> ${reference}</p>
          <p><strong>Pro Privileges Unlocked:</strong></p>
          <ul>
            <li><strong>Batch Submissions:</strong> Pro users can submit multiple tasks at once and earn for all</li>
            <li><strong>Real-Time Task Alerts:</strong> Receive immediate email notifications whenever tasks are posted</li>
            <li><strong>Fast-Track Review:</strong> Priority clearance during nightly reviews</li>
            <li><strong>Pro Verified Badge</strong> on your profile and dashboard</li>
          </ul>`,
          ctaText: 'View Dashboard',
          ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://temutasks.top'}/dashboard`,
        });

        sendEmail({
          to: user.email,
          subject: `[TemuTasks Pro] Welcome to Pro Membership! ⭐`,
          html: proEmailHtml,
          eventType: 'pro_upgrade_wallet',
        }).catch((e) => console.error('Error sending pro confirmation email:', e));
      }

      return NextResponse.json({ success: true, expiresAt: newExpiresAt.toISOString() });
    }

    // 2. Pay with Novac
    if (paymentMethod === 'novac') {
      const reference = generateRef('PRO-NVC');
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://temutasks.top';
      const redirectUrl = `${appUrl}/api/payments/novac/callback?ref=${reference}&type=pro_membership`;

      // Record pending order
      await adminSupabase.from('temutask_payment_orders').insert({
        user_id: user.id,
        order_type: 'pro_membership',
        amount_kobo: proCostKobo.toString(),
        reference,
        provider: 'novac',
        status: 'pending',
      });

      const novacResult = await initiateNovacPayment({
        amount: proCostNaira,
        reference,
        email: user.email!,
        redirectUrl,
        description: 'TemuTasks Pro 14-Day Membership',
      });

      if (!novacResult.success || !novacResult.paymentUrl) {
        return NextResponse.json({ error: novacResult.message || 'Novac payment initiation failed' }, { status: 500 });
      }

      return NextResponse.json({ success: true, paymentUrl: novacResult.paymentUrl });
    }

    return NextResponse.json({ error: 'Invalid payment method' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
