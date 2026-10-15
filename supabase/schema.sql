-- =========================================================================
-- TEMUTASKS COMPLETE DATABASE SCHEMA
-- Strict prefix: temutask_
-- Designed to co-exist with other projects on Supabase
-- =========================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Profiles / Users
CREATE TABLE IF NOT EXISTS public.temutask_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT DEFAULT '',
    avatar_url TEXT DEFAULT '',
    referral_code TEXT NOT NULL UNIQUE,
    referred_by UUID REFERENCES public.temutask_profiles(id) ON DELETE SET NULL,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin', 'moderator')),
    tier TEXT NOT NULL DEFAULT 'basic' CHECK (tier IN ('basic', 'pro')),
    pro_expires_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'restricted')),
    phone TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Wallets (Financial balance projection synced strictly with immutable ledger)
CREATE TABLE IF NOT EXISTS public.temutask_wallets (
    user_id UUID PRIMARY KEY REFERENCES public.temutask_profiles(id) ON DELETE CASCADE,
    balance_kobo BIGINT NOT NULL DEFAULT 0 CHECK (balance_kobo >= 0),
    pending_kobo BIGINT NOT NULL DEFAULT 0 CHECK (pending_kobo >= 0),
    reserved_kobo BIGINT NOT NULL DEFAULT 0 CHECK (reserved_kobo >= 0),
    total_earned_kobo BIGINT NOT NULL DEFAULT 0 CHECK (total_earned_kobo >= 0),
    total_withdrawn_kobo BIGINT NOT NULL DEFAULT 0 CHECK (total_withdrawn_kobo >= 0),
    total_airtime_kobo BIGINT NOT NULL DEFAULT 0 CHECK (total_airtime_kobo >= 0),
    total_referral_earned_kobo BIGINT NOT NULL DEFAULT 0 CHECK (total_referral_earned_kobo >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. Wallet Ledger (Immutable Append-Only Audit Trail)
CREATE TABLE IF NOT EXISTS public.temutask_wallet_ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.temutask_profiles(id) ON DELETE SET NULL,
    transaction_type TEXT NOT NULL, 
    -- 'reward', 'commission', 'platform_commission', 'task_funding', 'task_fee', 'premium_fee', 
    -- 'airtime_debit', 'airtime_refund', 'withdrawal_reserve', 'withdrawal_payout', 'withdrawal_release', 
    -- 'pro_subscription_wallet', 'admin_adjustment'
    amount_kobo BIGINT NOT NULL,
    direction TEXT NOT NULL CHECK (direction IN ('credit', 'debit')),
    balance_before_kobo BIGINT NOT NULL,
    balance_after_kobo BIGINT NOT NULL,
    reference TEXT NOT NULL UNIQUE,
    idempotency_key TEXT UNIQUE,
    related_id TEXT, -- task_id, submission_id, withdrawal_id, payment_ref, etc.
    description TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. Tasks Table
CREATE TABLE IF NOT EXISTS public.temutask_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.temutask_profiles(id) ON DELETE CASCADE,
    task_type TEXT NOT NULL CHECK (task_type IN ('existing_user', 'new_user')),
    title TEXT NOT NULL,
    invitation_link TEXT NOT NULL,
    quantity_requested INT NOT NULL CHECK (quantity_requested > 0 AND quantity_requested <= 1000),
    quantity_approved INT NOT NULL DEFAULT 0 CHECK (quantity_approved >= 0),
    quantity_reserved INT NOT NULL DEFAULT 0 CHECK (quantity_reserved >= 0),
    reward_per_participant_kobo BIGINT NOT NULL,
    commission_per_referrer_kobo BIGINT NOT NULL,
    base_cost_kobo BIGINT NOT NULL,
    platform_fee_kobo BIGINT NOT NULL DEFAULT 20000, -- ₦200 in kobo
    premium_fee_kobo BIGINT NOT NULL DEFAULT 0,
    is_premium BOOLEAN NOT NULL DEFAULT false,
    duration_hours INT NOT NULL DEFAULT 24,
    expires_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'pending_payment' CHECK (status IN ('pending_payment', 'active', 'completed', 'paused', 'suspended', 'cancelled')),
    payment_reference TEXT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. Task Submissions
CREATE TABLE IF NOT EXISTS public.temutask_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES public.temutask_tasks(id) ON DELETE CASCADE,
    participant_id UUID NOT NULL REFERENCES public.temutask_profiles(id) ON DELETE CASCADE,
    temu_username TEXT NOT NULL,
    temu_email TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'approved', 'declined_disputed', 'rejected', 'auto_approved')),
    decline_reason TEXT,
    rejection_proof_url TEXT,
    proof_url TEXT, -- Public URL of participant task completion screenshot
    reviewed_by UUID REFERENCES public.temutask_profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    reward_kobo BIGINT NOT NULL,
    commission_kobo BIGINT NOT NULL,
    referrer_id UUID REFERENCES public.temutask_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT temutask_unique_participant_task UNIQUE (task_id, participant_id)
);

-- 6. Payment Orders (Novac checkout tracking)
CREATE TABLE IF NOT EXISTS public.temutask_payment_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.temutask_profiles(id) ON DELETE CASCADE,
    order_type TEXT NOT NULL CHECK (order_type IN ('task_creation', 'pro_membership', 'wallet_deposit', 'task_reward_topup')),
    amount_kobo BIGINT NOT NULL,
    reference TEXT NOT NULL UNIQUE,
    provider TEXT NOT NULL DEFAULT 'novac',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'successful', 'failed', 'cancelled')),
    related_payload JSONB DEFAULT '{}'::jsonb,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 7. Withdrawals (Cash out requests)
CREATE TABLE IF NOT EXISTS public.temutask_withdrawals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.temutask_profiles(id) ON DELETE CASCADE,
    amount_kobo BIGINT NOT NULL CHECK (amount_kobo >= 50000), -- Minimum ₦500
    fee_kobo BIGINT NOT NULL DEFAULT 0,
    total_debit_kobo BIGINT NOT NULL,
    payment_destination TEXT NOT NULL CHECK (payment_destination IN ('opay', 'palmpay', 'moniepoint')),
    account_number TEXT NOT NULL,
    account_name TEXT NOT NULL,
    reference TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'paid', 'rejected')),
    rejection_reason TEXT,
    processed_by UUID REFERENCES public.temutask_profiles(id) ON DELETE SET NULL,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 8. Airtime Purchases (SmartAPI / Sabuss)
CREATE TABLE IF NOT EXISTS public.temutask_airtime_purchases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.temutask_profiles(id) ON DELETE CASCADE,
    network TEXT NOT NULL CHECK (network IN ('MTN', 'AIRTEL', 'GLO', '9MOBILE')),
    phone TEXT NOT NULL,
    amount_naira INT NOT NULL CHECK (amount_naira >= 50 AND amount_naira <= 50000),
    amount_kobo BIGINT NOT NULL,
    reference TEXT NOT NULL UNIQUE,
    provider_plan_id TEXT NOT NULL,
    provider_code INT,
    provider_message TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'successful', 'failed', 'reversed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 9. Pro Memberships History
CREATE TABLE IF NOT EXISTS public.temutask_pro_memberships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.temutask_profiles(id) ON DELETE CASCADE,
    payment_method TEXT NOT NULL CHECK (payment_method IN ('wallet', 'novac')),
    amount_kobo BIGINT NOT NULL DEFAULT 20000, -- ₦200
    reference TEXT NOT NULL UNIQUE,
    starts_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 10. Platform Settings
CREATE TABLE IF NOT EXISTS public.temutask_platform_settings (
    id TEXT PRIMARY KEY DEFAULT 'default',
    platform_task_fee_kobo BIGINT NOT NULL DEFAULT 20000, -- ₦200
    premium_task_fee_kobo BIGINT NOT NULL DEFAULT 20000,  -- ₦200
    existing_user_price_kobo BIGINT NOT NULL DEFAULT 5500, -- ₦55
    existing_user_reward_kobo BIGINT NOT NULL DEFAULT 4500, -- ₦45
    existing_user_comm_kobo BIGINT NOT NULL DEFAULT 1000,  -- ₦10
    new_user_price_kobo BIGINT NOT NULL DEFAULT 25000,     -- ₦250
    new_user_reward_kobo BIGINT NOT NULL DEFAULT 20000,     -- ₦200
    new_user_comm_kobo BIGINT NOT NULL DEFAULT 5000,       -- ₦50
    pro_membership_kobo BIGINT NOT NULL DEFAULT 20000,     -- ₦200
    pro_duration_days INT NOT NULL DEFAULT 14,
    min_withdrawal_kobo BIGINT NOT NULL DEFAULT 50000,     -- ₦500
    max_withdrawal_kobo BIGINT NOT NULL DEFAULT 10000000,  -- ₦100,000
    nightly_review_hour INT NOT NULL DEFAULT 23,           -- 11 PM
    nightly_review_timezone TEXT NOT NULL DEFAULT 'Africa/Lagos',
    maintenance_mode BOOLEAN NOT NULL DEFAULT false,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

INSERT INTO public.temutask_platform_settings (id) 
VALUES ('default') 
ON CONFLICT (id) DO NOTHING;

-- 11. Notifications and Email Logs (Sendbyte audit)
CREATE TABLE IF NOT EXISTS public.temutask_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.temutask_profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT false,
    link TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.temutask_email_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipient_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    event_type TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('queued', 'sent', 'failed')),
    provider_id TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 12. Notification Preferences
CREATE TABLE IF NOT EXISTS public.temutask_notification_preferences (
    user_id UUID PRIMARY KEY REFERENCES public.temutask_profiles(id) ON DELETE CASCADE,
    email_task_alerts BOOLEAN NOT NULL DEFAULT true,
    email_transactions BOOLEAN NOT NULL DEFAULT true,
    in_app_alerts BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 13. Admin Audit Logs
CREATE TABLE IF NOT EXISTS public.temutask_admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID NOT NULL REFERENCES public.temutask_profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- =========================================================================
-- INDEXES FOR MAXIMUM QUERY PERFORMANCE
-- =========================================================================
CREATE INDEX IF NOT EXISTS idx_temutask_tasks_status ON public.temutask_tasks(status, is_premium DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_temutask_tasks_user ON public.temutask_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_temutask_submissions_task ON public.temutask_submissions(task_id, status);
CREATE INDEX IF NOT EXISTS idx_temutask_submissions_part ON public.temutask_submissions(participant_id);
CREATE INDEX IF NOT EXISTS idx_temutask_ledger_user ON public.temutask_wallet_ledger(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_temutask_profiles_ref ON public.temutask_profiles(referral_code);
CREATE INDEX IF NOT EXISTS idx_temutask_profiles_by ON public.temutask_profiles(referred_by);

-- =========================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =========================================================================

ALTER TABLE public.temutask_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.temutask_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.temutask_wallet_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.temutask_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.temutask_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.temutask_payment_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.temutask_withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.temutask_airtime_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.temutask_pro_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.temutask_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.temutask_notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.temutask_platform_settings ENABLE ROW LEVEL SECURITY;

-- Helper function to check if requesting user is admin
CREATE OR REPLACE FUNCTION public.temutask_is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.temutask_profiles
    WHERE id = auth.uid() AND role IN ('admin', 'moderator')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Profiles: users read their own and public info; admins read all
DROP POLICY IF EXISTS "temutask_profile_select" ON public.temutask_profiles;
CREATE POLICY "temutask_profile_select" ON public.temutask_profiles
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "temutask_profile_update" ON public.temutask_profiles;
CREATE POLICY "temutask_profile_update" ON public.temutask_profiles
    FOR UPDATE USING (auth.uid() = id OR public.temutask_is_admin());

-- Wallets: user read own, admin read all
DROP POLICY IF EXISTS "temutask_wallet_select" ON public.temutask_wallets;
CREATE POLICY "temutask_wallet_select" ON public.temutask_wallets
    FOR SELECT USING (auth.uid() = user_id OR public.temutask_is_admin());

-- Ledger: user read own, admin read all (NO client inserts/updates)
DROP POLICY IF EXISTS "temutask_ledger_select" ON public.temutask_wallet_ledger;
CREATE POLICY "temutask_ledger_select" ON public.temutask_wallet_ledger
    FOR SELECT USING (auth.uid() = user_id OR public.temutask_is_admin());

-- Tasks: anyone authenticated can read active tasks; owners read their own; admin read all
DROP POLICY IF EXISTS "temutask_tasks_select" ON public.temutask_tasks;
CREATE POLICY "temutask_tasks_select" ON public.temutask_tasks
    FOR SELECT USING (status = 'active' OR auth.uid() = user_id OR public.temutask_is_admin());

-- Submissions: owner of task or participant can read; admin read all
DROP POLICY IF EXISTS "temutask_submissions_select" ON public.temutask_submissions;
CREATE POLICY "temutask_submissions_select" ON public.temutask_submissions
    FOR SELECT USING (
        auth.uid() = participant_id 
        OR auth.uid() IN (SELECT user_id FROM public.temutask_tasks WHERE id = task_id)
        OR public.temutask_is_admin()
    );

-- Withdrawals: user read own, admin read all
DROP POLICY IF EXISTS "temutask_withdrawals_select" ON public.temutask_withdrawals;
CREATE POLICY "temutask_withdrawals_select" ON public.temutask_withdrawals
    FOR SELECT USING (auth.uid() = user_id OR public.temutask_is_admin());

-- Airtime: user read own, admin read all
DROP POLICY IF EXISTS "temutask_airtime_select" ON public.temutask_airtime_purchases;
CREATE POLICY "temutask_airtime_select" ON public.temutask_airtime_purchases
    FOR SELECT USING (auth.uid() = user_id OR public.temutask_is_admin());

-- Notifications: user read own
DROP POLICY IF EXISTS "temutask_notifications_select" ON public.temutask_notifications;
CREATE POLICY "temutask_notifications_select" ON public.temutask_notifications
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "temutask_notifications_update" ON public.temutask_notifications;
CREATE POLICY "temutask_notifications_update" ON public.temutask_notifications
    FOR UPDATE USING (auth.uid() = user_id);

-- Settings: everyone can read
DROP POLICY IF EXISTS "temutask_settings_select" ON public.temutask_platform_settings;
CREATE POLICY "temutask_settings_select" ON public.temutask_platform_settings
    FOR SELECT USING (true);
