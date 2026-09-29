-- 0001_tpi_staff.sql
-- This project (TPI Control) holds no learner, parent or teacher data at
-- all. It is accessed only by TPI's own team and by the release pipeline.
-- Public sign ups must be disabled here exactly as in every school
-- project; the only accounts that should ever exist here are your own
-- team's.

create extension if not exists "pgcrypto";

create table public.tpi_staff (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null,
  role        text not null check (role in ('owner', 'engineer', 'support')),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create function public.has_tpi_role(p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.tpi_staff s
    where s.user_id = (select auth.uid())
      and s.role = any (p_roles)
      and s.active
  );
$$;

alter table public.tpi_staff enable row level security;

create policy tpi_staff_self_read on public.tpi_staff for select to authenticated
  using ( user_id = (select auth.uid()) );

-- Only an owner may add or remove TPI staff. There should be very few
-- people with the 'owner' role; think of it as the equivalent of the
-- 'admin' role inside a school project.
create policy tpi_staff_owner_manage on public.tpi_staff for all to authenticated
  using ( public.has_tpi_role(array['owner']) )
  with check ( public.has_tpi_role(array['owner']) );

revoke all on all tables in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
