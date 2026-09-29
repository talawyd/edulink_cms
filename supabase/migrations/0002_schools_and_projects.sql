-- 0002_schools_and_projects.sql
-- The registry your app reads at runtime: given a subdomain like "stg",
-- which Supabase project does the portal talk to? This is the piece that
-- makes stg.tpilearning.com actually work, described in the last few
-- messages of the architecture discussion.
--
-- CRITICAL BOUNDARY: this table stores each school's PUBLIC anon key,
-- which is safe to send to a browser by design, that is what it is for.
-- It must NEVER store a service role key. The service role key for each
-- school's project lives only in your secrets manager (GitHub Actions
-- secrets, or similar); this table stores only secrets_ref, a NAME that
-- points at where that secret lives, never the secret itself. If you ever
-- find yourself typing a service role key into a SQL insert statement or
-- this table, stop, because that is the single mistake that would expose
-- every school at once.

create table public.schools (
  id             uuid primary key default gen_random_uuid(),
  code           text not null unique,   -- the subdomain slug, e.g. 'stg'
  name           text not null,          -- e.g. 'St George''s Diocesan School'
  status         text not null default 'pending' check (status in ('pending', 'active', 'suspended', 'offboarded')),
  plan           text not null default 'standard',
  contact_name   text,
  contact_email  text,
  contact_phone  text,
  created_at     timestamptz not null default now()
);

-- One row per school, since each school gets exactly one dedicated
-- Supabase project (architecture document, section 5).
create table public.school_projects (
  id                     uuid primary key default gen_random_uuid(),
  school_id              uuid not null unique references public.schools (id) on delete cascade,
  supabase_project_ref   text not null unique,
  supabase_url           text not null,          -- e.g. https://<ref>.supabase.co
  anon_key               text not null,          -- PUBLIC key, safe for the browser
  secrets_ref            text not null,          -- name/path in the secrets manager; never the key itself
  region                 text not null default 'unspecified',
  schema_version         text,                   -- last migration file applied, e.g. '0009'
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- Every address that should route to a school: the tpilearning.com
-- subdomain, the school's own marketing website (for the "Visit
-- eLearning" link), and, later, a fully custom portal domain for a
-- premium client.
create table public.school_domains (
  id           uuid primary key default gen_random_uuid(),
  school_id    uuid not null references public.schools (id) on delete cascade,
  domain_type  text not null check (domain_type in ('tpilearning_subdomain', 'school_website', 'custom_portal_domain')),
  hostname     text not null unique,   -- e.g. 'stg.tpilearning.com' or 'stg.com'
  is_primary   boolean not null default false,
  created_at   timestamptz not null default now()
);

create index school_domains_school_idx on public.school_domains (school_id);

-- Which migration files have been applied to which school, and whether it
-- succeeded. This is what lets you see at a glance if any school has
-- drifted onto a different schema version than the others (section 10.2).
create table public.releases (
  id                uuid primary key default gen_random_uuid(),
  school_id         uuid not null references public.schools (id) on delete cascade,
  migration_version text not null,
  status            text not null check (status in ('pending', 'success', 'failed')),
  notes             text,
  applied_at        timestamptz not null default now()
);

create index releases_school_idx on public.releases (school_id, applied_at desc);

alter table public.schools enable row level security;
alter table public.school_projects enable row level security;
alter table public.school_domains enable row level security;
alter table public.releases enable row level security;

-- Every table here is staff-only. There is no "school admin" or "teacher"
-- role in this project at all; a school never logs into TPI Control.
create policy schools_staff_read on public.schools for select to authenticated
  using ( public.has_tpi_role(array['owner', 'engineer', 'support']) );
create policy schools_staff_write on public.schools for all to authenticated
  using ( public.has_tpi_role(array['owner', 'engineer']) )
  with check ( public.has_tpi_role(array['owner', 'engineer']) );

create policy school_projects_staff_read on public.school_projects for select to authenticated
  using ( public.has_tpi_role(array['owner', 'engineer', 'support']) );
create policy school_projects_staff_write on public.school_projects for all to authenticated
  using ( public.has_tpi_role(array['owner', 'engineer']) )
  with check ( public.has_tpi_role(array['owner', 'engineer']) );

create policy school_domains_staff_read on public.school_domains for select to authenticated
  using ( public.has_tpi_role(array['owner', 'engineer', 'support']) );
create policy school_domains_staff_write on public.school_domains for all to authenticated
  using ( public.has_tpi_role(array['owner', 'engineer']) )
  with check ( public.has_tpi_role(array['owner', 'engineer']) );

create policy releases_staff_read on public.releases for select to authenticated
  using ( public.has_tpi_role(array['owner', 'engineer', 'support']) );
create policy releases_staff_write on public.releases for all to authenticated
  using ( public.has_tpi_role(array['owner', 'engineer']) )
  with check ( public.has_tpi_role(array['owner', 'engineer']) );

-- The lookup your portal actually needs at runtime: given a hostname,
-- return the school's project connection details. Tested (see the build
-- notes): the "anon" role can call this function directly, over the
-- TPI Control project's own public anon key, and gets back only the
-- non-secret columns (supabase_url, anon_key for the SCHOOL's project).
-- A direct table read from anon is still fully denied, confirmed by
-- testing, because table grants were revoked in migration 0001 and this
-- function is the one deliberate, narrow exception, returning only fields
-- that are safe to hand to a browser by design. No Edge Function is
-- needed for this specific lookup; call it directly:
--   supabase.rpc('resolve_school_by_hostname', { p_hostname: 'stg.tpilearning.com' })
-- using the TPI Control project's own anon key, which your portal ships
-- with (it is the one and only Supabase key your app's base code needs
-- baked in; every school's own anon key is discovered through this call).
create function public.resolve_school_by_hostname(p_hostname text)
returns table (
  school_code  text,
  school_name  text,
  status       text,
  supabase_url text,
  anon_key     text
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.code, s.name, s.status, sp.supabase_url, sp.anon_key
  from public.school_domains d
  join public.schools s on s.id = d.school_id
  join public.school_projects sp on sp.school_id = s.id
  where d.hostname = p_hostname
  limit 1;
$$;
