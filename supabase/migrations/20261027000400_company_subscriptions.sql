-- Company-level monthly SaaS subscription tracking for TextilePay.
-- Existing tenants receive a 14-day onboarding trial after this migration.

alter table public.companies
  add column subscription_state text not null default 'trial'
    check (subscription_state in ('trial', 'pending', 'active', 'past_due', 'halted', 'cancelled', 'expired')),
  add column trial_ends_at timestamptz not null default (now() + interval '14 days'),
  add column subscription_period_end timestamptz,
  add column subscription_cancel_at_period_end boolean not null default false,
  add column razorpay_subscription_id text unique;

create table public.billing_events (
  event_id text primary key,
  company_id uuid references public.companies(id) on delete set null,
  event_type text not null,
  received_at timestamptz not null default now()
);

alter table public.billing_events enable row level security;
-- Billing events are written only by the Supabase service role from the webhook.
