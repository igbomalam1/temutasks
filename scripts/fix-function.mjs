const projectRef = process.env.SUPABASE_PROJECT_REF || 'cxbevwccenradkjxoooh';
const token = process.env.SUPABASE_ACCESS_TOKEN || '';

const fixSql = `
CREATE OR REPLACE FUNCTION public.temutask_is_admin()
RETURNS BOOLEAN AS $admin_chk$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.temutask_profiles
    WHERE id = auth.uid() AND role IN ('admin', 'moderator')
  );
END;
$admin_chk$ LANGUAGE plpgsql SECURITY DEFINER;

DROP POLICY IF EXISTS "temutask_profile_update" ON public.temutask_profiles;
CREATE POLICY "temutask_profile_update" ON public.temutask_profiles
    FOR UPDATE USING (auth.uid() = id OR public.temutask_is_admin());

DROP POLICY IF EXISTS "temutask_wallet_select" ON public.temutask_wallets;
CREATE POLICY "temutask_wallet_select" ON public.temutask_wallets
    FOR SELECT USING (auth.uid() = user_id OR public.temutask_is_admin());

DROP POLICY IF EXISTS "temutask_ledger_select" ON public.temutask_wallet_ledger;
CREATE POLICY "temutask_ledger_select" ON public.temutask_wallet_ledger
    FOR SELECT USING (auth.uid() = user_id OR public.temutask_is_admin());

DROP POLICY IF EXISTS "temutask_tasks_select" ON public.temutask_tasks;
CREATE POLICY "temutask_tasks_select" ON public.temutask_tasks
    FOR SELECT USING (status = 'active' OR auth.uid() = user_id OR public.temutask_is_admin());

DROP POLICY IF EXISTS "temutask_submissions_select" ON public.temutask_submissions;
CREATE POLICY "temutask_submissions_select" ON public.temutask_submissions
    FOR SELECT USING (
        auth.uid() = participant_id 
        OR auth.uid() IN (SELECT user_id FROM public.temutask_tasks WHERE id = task_id)
        OR public.temutask_is_admin()
    );

DROP POLICY IF EXISTS "temutask_withdrawals_select" ON public.temutask_withdrawals;
CREATE POLICY "temutask_withdrawals_select" ON public.temutask_withdrawals
    FOR SELECT USING (auth.uid() = user_id OR public.temutask_is_admin());

DROP POLICY IF EXISTS "temutask_airtime_select" ON public.temutask_airtime_purchases;
CREATE POLICY "temutask_airtime_select" ON public.temutask_airtime_purchases
    FOR SELECT USING (auth.uid() = user_id OR public.temutask_is_admin());
`;

async function main() {
  const resp = await fetch('https://api.supabase.com/v1/projects/' + projectRef + '/database/query', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: fixSql })
  });

  if (!resp.ok) {
    const txt = await resp.text();
    console.error('Error applying fix:', txt);
  } else {
    console.log('Admin function & remaining RLS policies successfully applied!');
  }
}

main();
