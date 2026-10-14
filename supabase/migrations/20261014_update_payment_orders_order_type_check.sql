-- Migration: Update temutask_payment_orders order_type check constraint
-- Run this in the Supabase SQL Editor if needed to update the constraint at the database level

ALTER TABLE public.temutask_payment_orders 
  DROP CONSTRAINT IF EXISTS temutask_payment_orders_order_type_check;

ALTER TABLE public.temutask_payment_orders 
  ADD CONSTRAINT temutask_payment_orders_order_type_check 
  CHECK (order_type IN ('task_creation', 'pro_membership', 'wallet_deposit', 'task_reward_topup'));
