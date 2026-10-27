-- Extend the company trial to 30 days, including tenants that received the
-- earlier 14-day default when the subscription migration was first applied.
alter table public.companies
  alter column trial_ends_at set default (now() + interval '30 days');

update public.companies
set trial_ends_at = now() + interval '30 days'
where subscription_state = 'trial';
