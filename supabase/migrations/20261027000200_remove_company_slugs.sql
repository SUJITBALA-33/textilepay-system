-- Company identity comes from the immutable UUID and authenticated membership.
-- Remove the unused human-readable portal slug without deleting company data.
alter table public.companies drop constraint if exists companies_slug_key;
alter table public.companies drop column if exists slug;
