-- Add company tenancy to TextilePay without rewriting the original migration.

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 160),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  status text not null default 'active'
    check (status in ('trial', 'active', 'suspended', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger companies_set_updated_at before update on public.companies
for each row execute function public.set_updated_at();

alter table public.profiles add column company_id uuid;
alter table public.profile_private add column company_id uuid;
alter table public.orders add column company_id uuid;
alter table public.piece_rates add column company_id uuid;
alter table public.attendance add column company_id uuid;
alter table public.submissions add column company_id uuid;
alter table public.payments add column company_id uuid;
alter table public.app_settings add column company_id uuid;

do $$
declare
  legacy_company_id uuid;
begin
  if exists (select 1 from public.profiles)
    or exists (select 1 from public.orders)
    or exists (select 1 from public.attendance)
    or exists (select 1 from public.submissions)
    or exists (select 1 from public.payments)
  then
    insert into public.companies (name, slug, status)
    values ('Legacy Company', 'legacy-company', 'active')
    returning id into legacy_company_id;

    update public.profiles set company_id = legacy_company_id;
    update public.profile_private p
      set company_id = pr.company_id
      from public.profiles pr
      where p.user_id = pr.id;
    update public.orders set company_id = legacy_company_id;
    update public.piece_rates set company_id = legacy_company_id;
    update public.attendance a
      set company_id = p.company_id
      from public.profiles p
      where a.worker_id = p.id;
    update public.submissions s
      set company_id = p.company_id
      from public.profiles p
      where s.user_id = p.id;
    update public.payments pmt
      set company_id = p.company_id
      from public.profiles p
      where pmt.user_id = p.id;
    update public.app_settings set company_id = legacy_company_id;
  else
    -- Initial migration inserts global defaults. Company provisioning now
    -- creates isolated defaults, so remove unowned rows.
    delete from public.piece_rates;
    delete from public.app_settings;
  end if;
end;
$$;

alter table public.profiles alter column company_id set not null;
alter table public.profile_private alter column company_id set not null;
alter table public.orders alter column company_id set not null;
alter table public.piece_rates alter column company_id set not null;
alter table public.attendance alter column company_id set not null;
alter table public.submissions alter column company_id set not null;
alter table public.payments alter column company_id set not null;
alter table public.app_settings alter column company_id set not null;

alter table public.profiles
  add constraint profiles_company_fk foreign key (company_id) references public.companies(id) on delete cascade;
alter table public.profile_private
  add constraint private_company_fk foreign key (company_id) references public.companies(id) on delete cascade;
alter table public.orders
  add constraint orders_company_fk foreign key (company_id) references public.companies(id) on delete cascade;
alter table public.piece_rates
  add constraint rates_company_fk foreign key (company_id) references public.companies(id) on delete cascade;
alter table public.attendance
  add constraint attendance_company_fk foreign key (company_id) references public.companies(id) on delete cascade;
alter table public.submissions
  add constraint submissions_company_fk foreign key (company_id) references public.companies(id) on delete cascade;
alter table public.payments
  add constraint payments_company_fk foreign key (company_id) references public.companies(id) on delete cascade;
alter table public.app_settings
  add constraint settings_company_fk foreign key (company_id) references public.companies(id) on delete cascade;

alter table public.profiles drop constraint profiles_username_key;
alter table public.profiles add constraint profiles_company_username_key unique (company_id, username);
alter table public.profiles add constraint profiles_company_id_key unique (company_id, id);
alter table public.orders add constraint orders_company_id_key unique (company_id, id);

alter table public.profile_private
  add constraint private_profile_company_fk
  foreign key (company_id, user_id) references public.profiles(company_id, id) on delete cascade;
alter table public.attendance
  add constraint attendance_worker_company_fk
  foreign key (company_id, worker_id) references public.profiles(company_id, id) on delete cascade;
alter table public.submissions
  add constraint submissions_user_company_fk
  foreign key (company_id, user_id) references public.profiles(company_id, id) on delete cascade;
alter table public.submissions
  add constraint submissions_order_company_fk
  foreign key (company_id, order_id) references public.orders(company_id, id) on delete cascade;
alter table public.payments
  add constraint payments_user_company_fk
  foreign key (company_id, user_id) references public.profiles(company_id, id) on delete cascade;

alter table public.piece_rates drop constraint piece_rates_pkey;
alter table public.piece_rates add primary key (company_id, section);

alter table public.app_settings drop constraint app_settings_pkey;
alter table public.app_settings add primary key (company_id);

create index profiles_company_idx on public.profiles(company_id);
create index orders_company_idx on public.orders(company_id);
create index attendance_company_month_idx on public.attendance(company_id, month);
create index submissions_company_idx on public.submissions(company_id);
create index payments_company_month_idx on public.payments(company_id, month);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  requested_role public.app_role;
  requested_company_id uuid;
begin
  requested_company_id := nullif(new.raw_user_meta_data ->> 'company_id', '')::uuid;
  if requested_company_id is null
    or not exists (select 1 from public.companies where id = requested_company_id)
  then
    raise exception 'A valid company is required';
  end if;

  requested_role := case
    when new.raw_user_meta_data ->> 'role' = 'manager' then 'manager'::public.app_role
    else 'worker'::public.app_role
  end;

  insert into public.profiles (
    id, company_id, email, username, name, mobile, role, status, section, pay_type
  )
  values (
    new.id,
    requested_company_id,
    coalesce(new.email, ''),
    lower(coalesce(new.raw_user_meta_data ->> 'username', split_part(coalesce(new.email, ''), '@', 1))),
    coalesce(new.raw_user_meta_data ->> 'name', 'New user'),
    coalesce(new.raw_user_meta_data ->> 'mobile', ''),
    requested_role,
    'pending',
    case when requested_role = 'worker' then coalesce(new.raw_user_meta_data ->> 'section', 'S1')::public.production_section else null end,
    case when requested_role = 'worker' then coalesce(new.raw_user_meta_data ->> 'pay_type', 'piece')::public.pay_type else null end
  );

  insert into public.profile_private (
    user_id, company_id, address, aadhaar, bank_details, upi,
    emergency_contact, dob, join_date
  )
  values (
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
  select company_id from public.profiles where id = auth.uid();
$$;

create or replace function public.validate_submission()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  worker_section public.production_section;
  worker_status public.account_status;
  worker_company_id uuid;
  available integer;
  already_submitted integer;
begin
  select section, status, company_id
  into worker_section, worker_status, worker_company_id
  from public.profiles
  where id = new.user_id and role = 'worker';

  if worker_section is null
    or worker_status <> 'approved'
    or worker_section <> new.section
    or worker_company_id <> new.company_id
  then
    raise exception 'Worker is not approved for this company and production section';
  end if;

  select case new.section
    when 'S1' then s1 when 'S2' then s2 when 'S3' then s3
    when 'S4' then s4 when 'S5' then s5 when 'S6' then s6
  end
  into available
  from public.orders
  where id = new.order_id
    and company_id = new.company_id
    and status = 'active'
  for update;

  if available is null then
    raise exception 'Order is not active for this company';
  end if;

  select coalesce(sum(pieces), 0) into already_submitted
  from public.submissions
  where order_id = new.order_id
    and company_id = new.company_id
    and section = new.section;

  if already_submitted + new.pieces > available then
    raise exception 'Submission exceeds the available approved pieces';
  end if;
  return new;
end;
$$;

alter table public.companies enable row level security;

drop policy if exists profiles_select on public.profiles;
drop policy if exists profiles_owner_update on public.profiles;
drop policy if exists private_select on public.profile_private;
drop policy if exists private_owner_update on public.profile_private;
drop policy if exists orders_select on public.orders;
drop policy if exists orders_owner_insert on public.orders;
drop policy if exists orders_staff_update on public.orders;
drop policy if exists orders_owner_delete on public.orders;
drop policy if exists rates_select on public.piece_rates;
drop policy if exists rates_owner_all on public.piece_rates;
drop policy if exists attendance_select on public.attendance;
drop policy if exists attendance_manager_write on public.attendance;
drop policy if exists submissions_select on public.submissions;
drop policy if exists submissions_worker_insert on public.submissions;
drop policy if exists payments_select on public.payments;
drop policy if exists payments_owner_all on public.payments;
drop policy if exists settings_select on public.app_settings;
drop policy if exists settings_owner_all on public.app_settings;

create policy companies_select on public.companies for select to authenticated
using (id = public.current_company_id());

create policy profiles_select on public.profiles for select to authenticated
using (
  company_id = public.current_company_id()
  and (
    id = auth.uid()
    or public.current_app_role() = 'owner'
    or (public.current_app_role() = 'manager' and role = 'worker')
  )
);
create policy profiles_owner_update on public.profiles for update to authenticated
using (company_id = public.current_company_id() and public.current_app_role() = 'owner')
with check (company_id = public.current_company_id() and public.current_app_role() = 'owner');

create policy private_select on public.profile_private for select to authenticated
using (
  company_id = public.current_company_id()
  and (user_id = auth.uid() or public.current_app_role() = 'owner')
);
create policy private_owner_update on public.profile_private for update to authenticated
using (company_id = public.current_company_id() and public.current_app_role() = 'owner')
with check (company_id = public.current_company_id() and public.current_app_role() = 'owner');

create policy orders_select on public.orders for select to authenticated
using (company_id = public.current_company_id());
create policy orders_owner_insert on public.orders for insert to authenticated
with check (company_id = public.current_company_id() and public.current_app_role() = 'owner');
create policy orders_staff_update on public.orders for update to authenticated
using (company_id = public.current_company_id() and public.current_app_role() in ('owner', 'manager'))
with check (company_id = public.current_company_id() and public.current_app_role() in ('owner', 'manager'));
create policy orders_owner_delete on public.orders for delete to authenticated
using (company_id = public.current_company_id() and public.current_app_role() = 'owner');

create policy rates_select on public.piece_rates for select to authenticated
using (company_id = public.current_company_id());
create policy rates_owner_all on public.piece_rates for all to authenticated
using (company_id = public.current_company_id() and public.current_app_role() = 'owner')
with check (company_id = public.current_company_id() and public.current_app_role() = 'owner');

create policy attendance_select on public.attendance for select to authenticated
using (
  company_id = public.current_company_id()
  and (worker_id = auth.uid() or public.current_app_role() in ('owner', 'manager'))
);
create policy attendance_manager_write on public.attendance for all to authenticated
using (company_id = public.current_company_id() and public.current_app_role() = 'manager')
with check (company_id = public.current_company_id() and public.current_app_role() = 'manager');

create policy submissions_select on public.submissions for select to authenticated
using (
  company_id = public.current_company_id()
  and (user_id = auth.uid() or public.current_app_role() in ('owner', 'manager'))
);
create policy submissions_worker_insert on public.submissions for insert to authenticated
with check (
  company_id = public.current_company_id()
  and user_id = auth.uid()
  and public.current_app_role() = 'worker'
);

create policy payments_select on public.payments for select to authenticated
using (
  company_id = public.current_company_id()
  and (user_id = auth.uid() or public.current_app_role() = 'owner')
);
create policy payments_owner_all on public.payments for all to authenticated
using (company_id = public.current_company_id() and public.current_app_role() = 'owner')
with check (company_id = public.current_company_id() and public.current_app_role() = 'owner');

create policy settings_select on public.app_settings for select to authenticated
using (company_id = public.current_company_id());
create policy settings_owner_all on public.app_settings for all to authenticated
using (company_id = public.current_company_id() and public.current_app_role() = 'owner')
with check (company_id = public.current_company_id() and public.current_app_role() = 'owner');
