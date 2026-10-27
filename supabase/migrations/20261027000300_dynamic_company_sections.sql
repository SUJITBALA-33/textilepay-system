-- Make production sections company-configurable while retaining existing
-- employees, piece rates, submissions, and order progress.

create table public.company_sections (
  company_id uuid not null references public.companies(id) on delete cascade,
  code text not null check (code ~ '^S[0-9]+$'),
  name text not null check (char_length(name) between 1 and 80),
  position integer not null check (position > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (company_id, code)
);

create trigger company_sections_set_updated_at before update on public.company_sections
for each row execute function public.set_updated_at();

insert into public.company_sections (company_id, code, name, position)
select company_id, section::text,
  case section::text
    when 'S1' then 'Cutting' when 'S2' then 'Stitching'
    when 'S3' then 'Embroidery' when 'S4' then 'Checking'
    when 'S5' then 'Finishing' when 'S6' then 'Packing'
  end,
  substring(section::text from 2)::integer
from public.piece_rates
on conflict (company_id, code) do nothing;

insert into public.company_sections (company_id, code, name, position)
select c.id, defaults.code, defaults.name, defaults.position
from public.companies c
cross join (values
  ('S1', 'Cutting', 1), ('S2', 'Stitching', 2), ('S3', 'Embroidery', 3),
  ('S4', 'Checking', 4), ('S5', 'Finishing', 5), ('S6', 'Packing', 6)
) as defaults(code, name, position)
where not exists (select 1 from public.company_sections existing where existing.company_id = c.id)
on conflict (company_id, code) do nothing;

alter table public.profiles alter column section type text using section::text;
alter table public.piece_rates alter column section type text using section::text;
alter table public.submissions alter column section type text using section::text;

insert into public.piece_rates (company_id, section, rate)
select sections.company_id, sections.code, 0
from public.company_sections sections
left join public.piece_rates rates
  on rates.company_id = sections.company_id and rates.section = sections.code
where rates.company_id is null;

alter table public.profiles add constraint profiles_company_section_fk
  foreign key (company_id, section) references public.company_sections(company_id, code);
alter table public.piece_rates add constraint piece_rates_company_section_fk
  foreign key (company_id, section) references public.company_sections(company_id, code);
alter table public.submissions add constraint submissions_company_section_fk
  foreign key (company_id, section) references public.company_sections(company_id, code);

alter table public.orders add column stage_values jsonb not null default '{}'::jsonb;
update public.orders set stage_values = jsonb_build_object(
  'S1', s1, 'S2', s2, 'S3', s3, 'S4', s4, 'S5', s5, 'S6', s6
);

alter table public.company_sections enable row level security;
create policy company_sections_select on public.company_sections for select to authenticated
using (company_id = public.current_company_id());
create policy company_sections_owner_all on public.company_sections for all to authenticated
using (company_id = public.current_company_id() and public.current_app_role() = 'owner')
with check (company_id = public.current_company_id() and public.current_app_role() = 'owner');

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  requested_company_id uuid;
  requested_section text;
begin
  requested_company_id := nullif(new.raw_user_meta_data ->> 'company_id', '')::uuid;
  if requested_company_id is null or not exists (
    select 1 from public.companies
    where id = requested_company_id and status in ('trial', 'active')
  ) then
    raise exception 'A valid active company is required';
  end if;

  requested_section := nullif(new.raw_user_meta_data ->> 'section', '');
  if requested_section is null then
    select code into requested_section from public.company_sections
    where company_id = requested_company_id and active
    order by position limit 1;
  end if;
  if requested_section is null or not exists (
    select 1 from public.company_sections
    where company_id = requested_company_id and code = requested_section and active
  ) then
    raise exception 'A valid active company section is required';
  end if;

  insert into public.profiles (
    id, company_id, email, username, name, mobile, role, status, section, pay_type
  ) values (
    new.id, requested_company_id, coalesce(new.email, ''),
    lower(coalesce(new.raw_user_meta_data ->> 'username', split_part(coalesce(new.email, ''), '@', 1))),
    coalesce(new.raw_user_meta_data ->> 'name', 'New user'),
    coalesce(new.raw_user_meta_data ->> 'mobile', ''), 'worker', 'pending',
    requested_section, coalesce(new.raw_user_meta_data ->> 'pay_type', 'piece')
  );

  insert into public.profile_private (
    user_id, company_id, address, aadhaar, bank_details, upi,
    emergency_contact, dob, join_date
  ) values (
    new.id, requested_company_id,
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

create or replace function public.validate_submission()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  worker_section text;
  worker_status public.account_status;
  worker_company_id uuid;
  available integer;
  already_submitted integer;
begin
  select section, status, company_id
  into worker_section, worker_status, worker_company_id
  from public.profiles where id = new.user_id and role = 'worker';

  if worker_section is null or worker_status <> 'approved'
    or worker_section <> new.section or worker_company_id <> new.company_id
    or not exists (
      select 1 from public.company_sections
      where company_id = new.company_id and code = new.section and active
    ) then
    raise exception 'Worker is not approved for this company production section';
  end if;

  select nullif(stage_values ->> new.section, '')::integer into available
  from public.orders
  where id = new.order_id and company_id = new.company_id and status = 'active'
  for update;
  if available is null then
    raise exception 'Order is not active for this company section';
  end if;

  select coalesce(sum(pieces), 0) into already_submitted
  from public.submissions
  where order_id = new.order_id and company_id = new.company_id and section = new.section;
  if already_submitted + new.pieces > available then
    raise exception 'Submission exceeds the available approved pieces';
  end if;
  return new;
end;
$$;
