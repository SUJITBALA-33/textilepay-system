-- TextilePay production schema.
-- Apply with `supabase db push` or paste into the Supabase SQL editor.

create extension if not exists pgcrypto;

-- The previous prototype stored the entire app in this generated KV table.
-- It contained development-only data and is no longer used.
drop table if exists public.kv_store_32660b5b;

create type public.app_role as enum ('owner', 'manager', 'worker');
create type public.account_status as enum ('pending', 'approved', 'rejected', 'deactivated');
create type public.pay_type as enum ('piece', 'daily');
create type public.production_section as enum ('S1', 'S2', 'S3', 'S4', 'S5', 'S6');
create type public.order_status as enum ('active', 'completed');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  username text not null unique check (char_length(username) between 3 and 40),
  name text not null check (char_length(name) between 1 and 120),
  mobile text not null default '',
  role public.app_role not null default 'worker',
  status public.account_status not null default 'pending',
  section public.production_section,
  pay_type public.pay_type,
  daily_rate numeric(12,2) not null default 0 check (daily_rate >= 0),
  hourly_ot numeric(12,2) not null default 0 check (hourly_ot >= 0),
  work_days integer not null default 26 check (work_days between 1 and 31),
  monthly_salary numeric(12,2) not null default 0 check (monthly_salary >= 0),
  pf_enabled boolean not null default true,
  esi_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profile_private (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  address text not null default '',
  aadhaar text not null default '',
  bank_details text not null default '',
  upi text not null default '',
  emergency_contact text not null default '',
  dob date,
  join_date date
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 160),
  target integer not null check (target >= 0),
  revenue numeric(14,2) not null default 0 check (revenue >= 0),
  costs numeric(14,2) not null default 0 check (costs >= 0),
  s1 integer not null default 0 check (s1 >= 0),
  s2 integer not null default 0 check (s2 >= 0),
  s3 integer not null default 0 check (s3 >= 0),
  s4 integer not null default 0 check (s4 >= 0),
  s5 integer not null default 0 check (s5 >= 0),
  s6 integer not null default 0 check (s6 >= 0),
  status public.order_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (s1 <= target),
  check (s2 <= s1),
  check (s3 <= s2),
  check (s4 <= s3),
  check (s5 <= s4),
  check (s6 <= s5)
);

create table public.piece_rates (
  section public.production_section primary key,
  rate numeric(12,2) not null default 0 check (rate >= 0)
);

create table public.attendance (
  worker_id uuid not null references public.profiles(id) on delete cascade,
  month text not null check (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  present integer not null default 0 check (present between 0 and 31),
  ot_hours numeric(8,2) not null default 0 check (ot_hours >= 0),
  updated_at timestamptz not null default now(),
  primary key (worker_id, month)
);

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  section public.production_section not null,
  pieces integer not null check (pieces > 0),
  note text not null default '',
  month text not null check (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  created_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  month text not null check (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  base numeric(14,2) not null default 0,
  ot numeric(14,2) not null default 0,
  gross numeric(14,2) not null default 0,
  pool_share numeric(14,2) not null default 0,
  final_pay numeric(14,2) not null default 0,
  pf numeric(14,2) not null default 0,
  esi_employee numeric(14,2) not null default 0,
  esi_employer numeric(14,2) not null default 0,
  net numeric(14,2) not null default 0,
  paid boolean not null default false,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, month)
);

create table public.app_settings (
  singleton boolean primary key default true check (singleton),
  owner_reserve_percent numeric(5,2) not null default 20 check (owner_reserve_percent between 0 and 100),
  ot_multiplier numeric(5,2) not null default 1.5 check (ot_multiplier >= 0),
  max_hours numeric(5,2) not null default 8 check (max_hours > 0),
  updated_at timestamptz not null default now()
);

insert into public.piece_rates (section, rate)
values ('S1', 0), ('S2', 0), ('S3', 0), ('S4', 0), ('S5', 0), ('S6', 0)
on conflict do nothing;

insert into public.app_settings (singleton) values (true) on conflict do nothing;

create index attendance_month_idx on public.attendance(month);
create index submissions_user_month_idx on public.submissions(user_id, month);
create index submissions_order_section_idx on public.submissions(order_id, section);
create index payments_month_idx on public.payments(month);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger orders_set_updated_at before update on public.orders
for each row execute function public.set_updated_at();
create trigger attendance_set_updated_at before update on public.attendance
for each row execute function public.set_updated_at();
create trigger settings_set_updated_at before update on public.app_settings
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  requested_role public.app_role;
begin
  requested_role := case
    when new.raw_user_meta_data ->> 'role' = 'manager' then 'manager'::public.app_role
    else 'worker'::public.app_role
  end;

  insert into public.profiles (id, email, username, name, mobile, role, status, section, pay_type)
  values (
    new.id,
    coalesce(new.email, ''),
    lower(coalesce(new.raw_user_meta_data ->> 'username', split_part(coalesce(new.email, ''), '@', 1))),
    coalesce(new.raw_user_meta_data ->> 'name', 'New user'),
    coalesce(new.raw_user_meta_data ->> 'mobile', ''),
    requested_role,
    'pending',
    case when requested_role = 'worker' then coalesce(new.raw_user_meta_data ->> 'section', 'S1')::public.production_section else null end,
    case when requested_role = 'worker' then coalesce(new.raw_user_meta_data ->> 'pay_type', 'piece')::public.pay_type else null end
  );

  insert into public.profile_private (user_id, address, aadhaar, bank_details, upi, emergency_contact, dob, join_date)
  values (
    new.id,
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

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.validate_submission()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  worker_section public.production_section;
  worker_status public.account_status;
  available integer;
  already_submitted integer;
begin
  select section, status into worker_section, worker_status
  from public.profiles
  where id = new.user_id and role = 'worker';

  if worker_section is null or worker_status <> 'approved' or worker_section <> new.section then
    raise exception 'Worker is not approved for this production section';
  end if;

  select case new.section
    when 'S1' then s1 when 'S2' then s2 when 'S3' then s3
    when 'S4' then s4 when 'S5' then s5 when 'S6' then s6
  end
  into available
  from public.orders
  where id = new.order_id and status = 'active'
  for update;

  if available is null then
    raise exception 'Order is not active';
  end if;

  select coalesce(sum(pieces), 0) into already_submitted
  from public.submissions
  where order_id = new.order_id and section = new.section;

  if already_submitted + new.pieces > available then
    raise exception 'Submission exceeds the available approved pieces';
  end if;
  return new;
end;
$$;

create trigger submissions_validate
before insert on public.submissions
for each row execute function public.validate_submission();

create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = auth.uid();
$$;

alter table public.profiles enable row level security;
alter table public.profile_private enable row level security;
alter table public.orders enable row level security;
alter table public.piece_rates enable row level security;
alter table public.attendance enable row level security;
alter table public.submissions enable row level security;
alter table public.payments enable row level security;
alter table public.app_settings enable row level security;

create policy profiles_select on public.profiles for select to authenticated
using (
  id = auth.uid()
  or public.current_app_role() = 'owner'
  or (public.current_app_role() = 'manager' and role = 'worker')
);
create policy profiles_owner_update on public.profiles for update to authenticated
using (public.current_app_role() = 'owner') with check (public.current_app_role() = 'owner');

create policy private_select on public.profile_private for select to authenticated
using (user_id = auth.uid() or public.current_app_role() = 'owner');
create policy private_owner_update on public.profile_private for update to authenticated
using (public.current_app_role() = 'owner') with check (public.current_app_role() = 'owner');

create policy orders_select on public.orders for select to authenticated using (true);
create policy orders_owner_insert on public.orders for insert to authenticated
with check (public.current_app_role() = 'owner');
create policy orders_staff_update on public.orders for update to authenticated
using (public.current_app_role() in ('owner', 'manager'))
with check (public.current_app_role() in ('owner', 'manager'));
create policy orders_owner_delete on public.orders for delete to authenticated
using (public.current_app_role() = 'owner');

-- Direct REST clients may only change operational order fields. The Edge
-- Function performs the richer owner-only writes with its server credential.
revoke update on public.orders from authenticated;
grant update (s1, s2, s3, s4, s5, s6, status) on public.orders to authenticated;

create policy rates_select on public.piece_rates for select to authenticated using (true);
create policy rates_owner_all on public.piece_rates for all to authenticated
using (public.current_app_role() = 'owner') with check (public.current_app_role() = 'owner');

create policy attendance_select on public.attendance for select to authenticated
using (worker_id = auth.uid() or public.current_app_role() in ('owner', 'manager'));
create policy attendance_manager_write on public.attendance for all to authenticated
using (public.current_app_role() = 'manager') with check (public.current_app_role() = 'manager');

create policy submissions_select on public.submissions for select to authenticated
using (user_id = auth.uid() or public.current_app_role() in ('owner', 'manager'));
create policy submissions_worker_insert on public.submissions for insert to authenticated
with check (user_id = auth.uid() and public.current_app_role() = 'worker');

create policy payments_select on public.payments for select to authenticated
using (user_id = auth.uid() or public.current_app_role() = 'owner');
create policy payments_owner_all on public.payments for all to authenticated
using (public.current_app_role() = 'owner') with check (public.current_app_role() = 'owner');

create policy settings_select on public.app_settings for select to authenticated using (true);
create policy settings_owner_all on public.app_settings for all to authenticated
using (public.current_app_role() = 'owner') with check (public.current_app_role() = 'owner');

-- The public app has no signup route. Use `pnpm owner:create` to create the
-- first owner, or promote an existing Auth user once with:
-- update public.profiles
-- set role = 'owner', status = 'approved'
-- where email = 'owner@example.com';
