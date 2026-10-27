begin;
select plan(20);

-- Isolated fixtures are rolled back at the end of this test.
insert into public.companies (id, name, status) values
  ('10000000-0000-4000-8000-000000000001', 'AJS Textile Factory', 'active'),
  ('20000000-0000-4000-8000-000000000001', 'Royal Garments', 'active');
insert into public.company_sections (company_id, code, name, position)
select company_id, code, name, position
from (values
  ('10000000-0000-4000-8000-000000000001'::uuid),
  ('20000000-0000-4000-8000-000000000001'::uuid)
) companies(company_id)
cross join (values
  ('S1', 'Cutting', 1), ('S2', 'Stitching', 2), ('S3', 'Embroidery', 3),
  ('S4', 'Checking', 4), ('S5', 'Finishing', 5), ('S6', 'Packing', 6)
) sections(code, name, position);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('10000000-0000-4000-8000-000000000010', 'authenticated', 'authenticated', 'owner-a@test.invalid', 'test', now(), '{}', '{"company_id":"10000000-0000-4000-8000-000000000001","role":"owner","name":"Owner A","username":"owner-a"}', now(), now()),
  ('10000000-0000-4000-8000-000000000011', 'authenticated', 'authenticated', 'worker-a@test.invalid', 'test', now(), '{}', '{"company_id":"10000000-0000-4000-8000-000000000001","role":"worker","name":"Worker A","username":"worker-a"}', now(), now()),
  ('10000000-0000-4000-8000-000000000012', 'authenticated', 'authenticated', 'manager-claim@test.invalid', 'test', now(), '{}', '{"company_id":"10000000-0000-4000-8000-000000000001","role":"manager","name":"Untrusted Manager Claim","username":"manager-claim"}', now(), now()),
  ('20000000-0000-4000-8000-000000000010', 'authenticated', 'authenticated', 'owner-b@test.invalid', 'test', now(), '{}', '{"company_id":"20000000-0000-4000-8000-000000000001","role":"owner","name":"Owner B","username":"owner-b"}', now(), now()),
  ('20000000-0000-4000-8000-000000000011', 'authenticated', 'authenticated', 'worker-b@test.invalid', 'test', now(), '{}', '{"company_id":"20000000-0000-4000-8000-000000000001","role":"worker","name":"Worker B","username":"worker-b"}', now(), now());

update public.profiles set role = 'owner', status = 'approved'
where id in ('10000000-0000-4000-8000-000000000010', '20000000-0000-4000-8000-000000000010');
update public.profiles set status = 'approved'
where id in ('10000000-0000-4000-8000-000000000011', '20000000-0000-4000-8000-000000000011');
select is((select role::text from public.profiles where id = '10000000-0000-4000-8000-000000000012'), 'worker', 'signup metadata cannot create a manager role');
select is((select status::text from public.profiles where id = '10000000-0000-4000-8000-000000000012'), 'pending', 'untrusted signup is pending approval');

insert into public.orders (id, company_id, name, target) values
  ('10000000-0000-4000-8000-000000000020', '10000000-0000-4000-8000-000000000001', 'AJS order', 100),
  ('20000000-0000-4000-8000-000000000020', '20000000-0000-4000-8000-000000000001', 'Royal order', 100);
insert into public.piece_rates (company_id, section, rate) values
  ('10000000-0000-4000-8000-000000000001', 'S1', 10),
  ('20000000-0000-4000-8000-000000000001', 'S1', 20);
insert into public.app_settings (company_id, singleton) values
  ('10000000-0000-4000-8000-000000000001', true),
  ('20000000-0000-4000-8000-000000000001', true);
insert into public.payments (company_id, user_id, month, gross, net) values
  ('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000011', '2026-10', 100, 100),
  ('20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000011', '2026-10', 200, 200);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000010', true);
select is((select count(*)::int from public.profiles), 3, 'AJS owner sees only own company profiles');
select is((select count(*)::int from public.profiles where id = '20000000-0000-4000-8000-000000000011'), 0, 'AJS owner cannot read Royal worker');
select is((select count(*)::int from public.orders), 1, 'AJS owner sees only own orders');
select is((select count(*)::int from public.orders where id = '20000000-0000-4000-8000-000000000020'), 0, 'AJS owner cannot read Royal order');
select is((select count(*)::int from public.piece_rates where company_id = '20000000-0000-4000-8000-000000000001'), 0, 'AJS owner cannot read Royal rates');
select is((select count(*)::int from public.payments where company_id = '20000000-0000-4000-8000-000000000001'), 0, 'AJS owner cannot read Royal payroll');
select is((select count(*)::int from public.company_sections), 6, 'AJS owner sees only own company sections');
select is((select count(*)::int from public.company_sections where company_id = '20000000-0000-4000-8000-000000000001' and code = 'S1'), 0, 'AJS owner cannot read Royal section setup');
insert into public.company_sections (company_id, code, name, position) values ('10000000-0000-4000-8000-000000000001', 'S7', 'Quality Control', 7);
select is((select count(*)::int from public.company_sections where code = 'S7'), 1, 'owner can add a company-specific section');
update public.piece_rates set rate = 1 where company_id = '20000000-0000-4000-8000-000000000001';
select is((select rate from public.piece_rates where company_id = '20000000-0000-4000-8000-000000000001'), 20::numeric, 'AJS owner cannot change Royal rates');
select throws_ok($$insert into public.companies (name) values ('Unauthorized')$$, '42501', 'ordinary tenant cannot create platform companies');

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000012', true);
select is(public.current_company_id(), null::uuid, 'pending user receives no active tenant membership');
select is(public.current_app_role(), null::public.app_role, 'pending user receives no privileged role');
select is((select count(*)::int from public.profiles), 0, 'pending signup cannot read tenant profiles');

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000011', true);
update public.profiles set role = 'owner' where id = '10000000-0000-4000-8000-000000000011';
select is((select role::text from public.profiles where id = '10000000-0000-4000-8000-000000000011'), 'worker', 'worker cannot promote their own role');
update public.profiles set company_id = '20000000-0000-4000-8000-000000000001' where id = '10000000-0000-4000-8000-000000000011';
select is((select company_id::text from public.profiles where id = '10000000-0000-4000-8000-000000000011'), '10000000-0000-4000-8000-000000000001', 'worker cannot move their membership to another company');
select throws_ok($$insert into public.attendance (company_id, worker_id, month, present) values ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000011', '2026-10', 1)$$, '42501', 'tenant cannot create attendance referencing another company worker');
select is((select count(*)::int from public.profile_private where user_id = '20000000-0000-4000-8000-000000000011'), 0, 'worker cannot read another company private profile');

reset role;
select * from finish();
rollback;
