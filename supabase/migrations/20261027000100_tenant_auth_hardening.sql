-- Harden tenant signup and authenticated membership after multi-company rollout.
-- Existing company data and tenant constraints are retained.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  requested_company_id uuid;
begin
  requested_company_id := nullif(new.raw_user_meta_data ->> 'company_id', '')::uuid;
  if requested_company_id is null or not exists (
    select 1 from public.companies
    where id = requested_company_id and status in ('trial', 'active')
  ) then
    raise exception 'A valid active company is required';
  end if;

  -- Signup metadata is user controlled. New Auth users are always pending
  -- workers; trusted owner onboarding promotes an account server-side.
  insert into public.profiles (
    id, company_id, email, username, name, mobile, role, status, section, pay_type
  ) values (
    new.id,
    requested_company_id,
    coalesce(new.email, ''),
    lower(coalesce(new.raw_user_meta_data ->> 'username', split_part(coalesce(new.email, ''), '@', 1))),
    coalesce(new.raw_user_meta_data ->> 'name', 'New user'),
    coalesce(new.raw_user_meta_data ->> 'mobile', ''),
    'worker',
    'pending',
    coalesce(new.raw_user_meta_data ->> 'section', 'S1')::public.production_section,
    coalesce(new.raw_user_meta_data ->> 'pay_type', 'piece')::public.pay_type
  );

  insert into public.profile_private (
    user_id, company_id, address, aadhaar, bank_details, upi,
    emergency_contact, dob, join_date
  ) values (
    new.id,
    requested_company_id,
    coalesce(new.raw_user_meta_data ->> 'address', ''),
    coalesce(new.raw_user_meta_data ->> 'aadhaar', ''),
    coalesce(new.raw_user_meta_data ->> 'bank_details', ''),
    coalesce(new.raw_user_meta_data ->> 'upi', ''),
    coalesce(new.raw_user_meta_data ->> 'emergency_contact', ''),
    nullif(new.raw_user_meta_data ->> 'dob', '')::date,
    nullif(new.raw_user_meta_data ->> 'join_date', '')::date
  );
  return new;
end;
$$;

create or replace function public.current_company_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.company_id from public.profiles p
  join public.companies c on c.id = p.company_id
  where p.id = auth.uid()
    and p.status = 'approved'
    and c.status in ('trial', 'active');
$$;

create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role from public.profiles p
  join public.companies c on c.id = p.company_id
  where p.id = auth.uid()
    and p.status = 'approved'
    and c.status in ('trial', 'active');
$$;

revoke all on function public.current_company_id() from public;
revoke all on function public.current_app_role() from public;
grant execute on function public.current_company_id() to authenticated;
grant execute on function public.current_app_role() to authenticated;

-- Existing RLS policies already scope records by current_company_id(). Recreate
-- company visibility explicitly so unapproved accounts cannot enumerate tenants.
drop policy if exists companies_select on public.companies;
create policy companies_select on public.companies for select to authenticated
using (id = public.current_company_id());

-- Block unapproved profiles at the service-role API boundary as well as RLS.
comment on function public.handle_new_user() is
  'Creates a pending worker only. Owner promotion is restricted to trusted onboarding.';
