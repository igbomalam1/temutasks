# TemuTasks — Production Web Application Documentation

## 1. Project Overview & Architecture
TemuTasks is a high-performance web platform built with **Next.js 14 (App Router)**, **TypeScript**, **Tailwind CSS** (mirroring the **Fairly-Used design spec: `#F95700` primary orange, `#111827` midnight navy, `#FFFFFF` cards, and `#F7F7F8` background), and **Supabase (PostgreSQL + RLS)**.

### All database tables use the strict `temutask_` prefix:
- `temutask_profiles`
- `temutask_wallets`
- `temutask_wallet_ledger` (immutable append-only financial records)
- `temutask_tasks`
- `temutask_submissions`
- `temutask_payment_orders`
- `temutask_withdrawals`
- `temutask_airtime_purchases`
- `temutask_pro_memberships`
- `temutask_platform_settings`
- `temutask_notifications`
- `temutask_email_logs`
- `temutask_notification_preferences`
- `temutask_admin_audit_logs`

---

## 2. Configured Integrations & Providers

### A. Authentication
- **Google OAuth**: Exclusive login method. Automatic profile creation with permanent referral code, default Basic tier, wallet initialization, and welcome notifications.

### B. Payments (Novac)
- **Endpoint**: `https://api.novacpayment.com/api/v1/initiate`
- **Verification Endpoint**: `https://api.novacpayment.com/api/v1/checkout/{reference}/verify`
- **Keys configured in `.env.local`**:
  - `NOVAC_SECRET_KEY`
  - `NEXT_PUBLIC_NOVAC_PUBLIC_KEY`

### C. Airtime (SmartAPI / Sabuss)
- **Endpoint**: `POST https://sabuss.com/vtu/api/buy/{apiKey}`
- **Form Data**:
  - `pin`: `1983`
  - `plan_id`: `1` (MTN), `2` (Airtel), `3` (Glo), `4` (9mobile)
  - `amount`: Recharge amount in NGN
  - `phone`: Recipient number
  - `reference`: Unique order ID
- **Webhook Endpoint**: `/api/webhooks/smartapi`

### D. Transactional Emails & Pro Alerts (Sendbyte Africa)
- **API Endpoint**: `https://api.sendbyte.africa/v1/emails`
- **Bearer Token**: Configured via `SENDBYTE_API_KEY` in `.env.local`
- **Branded Templates**: Branded HTML layouts for task publication, submission approvals, cash-out receipts, and new-task alerts for opted-in active Pro members.

---

## 3. Financial Invariants & Rules

1. **Task Pricing Formula**:
   - **Existing User Tasks**: `(Qty × ₦55) + ₦200 platform fee + (Optional ₦200 premium fee)`
     - *Participant Reward*: ₦45.00
     - *Referrer Lifetime Commission*: ₦10.00
   - **New User Tasks**: `(Qty × ₦250) + ₦200 platform fee + (Optional ₦200 premium fee)`
     - *Participant Reward*: ₦200.00
     - *Referrer Lifetime Commission*: ₦50.00
2. **Pro Membership**:
   - Cost: ₦200 per 14-day cycle.
   - Renewable via wallet balance or Novac.
   - Recurring renewal adds 14 days to the current unexpired date without penalty.
3. **Withdrawals**:
   - Minimum: ₦1,000.00.
   - Destinations: OPay, PalmPay, Moniepoint.
   - Funds are atomically reserved in `temutask_wallets` and `temutask_wallet_ledger` upon request.
4. **Nightly Automated Admin Review**:
   - Scheduled endpoint: `/api/cron/nightly-review`
   - Policy: Submissions left unreviewed by owners at 11:00 PM (Africa/Lagos) are automatically verified and cleared by the system, crediting participant rewards and referral commissions. Disputed submissions remain in the admin queue.

---

## 4. Local Development & Deployment

To run locally:
```bash
cd Desktop\Projects\temutask
npm run dev
```
Visit `http://localhost:3000`.

To run automated financial and pricing tests:
```bash
npx tsx scripts/test-suite.ts
```
