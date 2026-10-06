-- 0009_shared_hosting.sql  (TPI CONTROL)
-- Onboarding no longer forces one shape on every school. An admin now picks
-- hosting up front: shared (reuse a known pool's connection, nothing to
-- retype) or dedicated (the school gets its own project, attached once that
-- project actually exists, not before). create_school still exists for
-- compatibility, but new onboarding should call the two functions below.

create table public.hosting_pools (
  id            uuid primary key default gen_random_uuid(),
  label         text not null unique check (label ~ '^[a-z][a-z0-9_]{1,29}$'),
  kind          text not null check (kind in ('private', 'public')),
  supabase_url  text not null,
  anon_key      text not null,
  created_at    timestamptz not null default now(),
  check (supabase_url ~ '^https://[a-z0-9]{20}\.supabase\.co$')
);
alter table public.hosting_pools enable row level security;
create policy hosting_pools_staff_read on public.hosting_pools for select to authenticated
  using ( public.has_tpi_role(array['owner', 'engineer', 'support']) );

create function public.register_hosting_pool(p_label text, p_kind text, p_url text, p_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_url text := lower(trim(both '/' from trim(coalesce(p_url, ''))));
begin
  if not public.has_tpi_role(array['owner', 'engineer']) then
    raise exception 'Not allowed.' using errcode = '42501';
  end if;
  if p_kind not in ('private', 'public') then
    raise exception 'Pool kind must be private or public.';
  end if;
  perform public.assert_publishable_key(trim(coalesce(p_key, '')));
  if v_url !~ '^https://[a-z0-9]{20}\.supabase\.co$' then
    raise exception 'The pool URL must look like https://xxxxxxxxxxxxxxxxxxxx.supabase.co.';
  end if;
  insert into public.hosting_pools (label, kind, supabase_url, anon_key)
  values (lower(trim(p_label)), p_kind, v_url, trim(p_key))
  on conflict (label) do update set kind = excluded.kind, supabase_url = excluded.supabase_url, anon_key = excluded.anon_key;
end;
$$;
revoke all on function public.register_hosting_pool(text, text, text, text) from public, anon;
grant execute on function public.register_hosting_pool(text, text, text, text) to authenticated;

create function public.create_school_shared(
  p_code text, p_name text, p_contact_name text, p_contact_email text, p_contact_phone text,
  p_pool_label text, p_plan text, p_billing_cycle text, p_price numeric
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text := lower(trim(coalesce(p_code, '')));
  v_name text := trim(coalesce(p_name, ''));
  v_email text := nullif(trim(coalesce(p_contact_email, '')), '');
  v_plan text := coalesce(nullif(trim(coalesce(p_plan, '')), ''), 'standard');
  v_pool public.hosting_pools%rowtype;
  v_domain text; v_host text; v_school uuid; v_expires date := current_date + interval '1 year';
begin
  if not public.has_tpi_role(array['owner', 'engineer']) then
    raise exception 'Not allowed.' using errcode = '42501';
  end if;
  if v_code !~ '^[a-z][a-z0-9]{1,29}$' then
    raise exception 'The school code must be 2 to 30 characters: lowercase letters and digits, starting with a letter.';
  end if;
  if char_length(v_name) < 2 or char_length(v_name) > 120 then
    raise exception 'The school name must be 2 to 120 characters.';
  end if;
  if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'The contact email does not look right.';
  end if;
  if p_billing_cycle is null or p_billing_cycle not in ('monthly', 'annual') then
    raise exception 'The billing cycle must be monthly or annual.';
  end if;
  if p_price is null or p_price < 0 then
    raise exception 'The price must be zero or more.';
  end if;

  select * into v_pool from public.hosting_pools where label = lower(trim(coalesce(p_pool_label, '')));
  if v_pool.id is null then
    raise exception 'No hosting pool is registered under that name. Registered pools: %',
      (select coalesce(string_agg(label, ', '), 'none yet') from public.hosting_pools);
  end if;

  select ps.platform_domain into v_domain from public.platform_settings ps limit 1;
  v_host := v_code || '.' || v_domain;

  insert into public.schools (code, name, status, plan, contact_name, contact_email, contact_phone, school_type)
  values (v_code, v_name, 'pending', v_plan, nullif(trim(coalesce(p_contact_name, '')), ''), v_email,
          nullif(trim(coalesce(p_contact_phone, '')), ''), v_pool.kind)
  returning id into v_school;

  insert into public.school_projects (school_id, supabase_project_ref, supabase_url, anon_key, region, kind)
  values (v_school, substring(v_pool.supabase_url from '^https://([a-z0-9]{20})\.supabase\.co$'),
          v_pool.supabase_url, v_pool.anon_key, 'shared pool: ' || v_pool.label, 'pooled');

  insert into public.school_domains (school_id, domain_type, hostname, is_primary)
  values (v_school, 'platform_subdomain', v_host, true);

  insert into public.subscriptions (school_id, plan, billing_cycle, price_amount, status, license_expires_on)
  values (v_school, v_plan, p_billing_cycle, p_price, 'active', v_expires);

  insert into public.operations_log (actor_id, action, school_id, details)
  values ((select auth.uid()), 'school_created_shared', v_school,
          jsonb_build_object('code', v_code, 'pool', v_pool.label, 'hostname', v_host, 'license_expires_on', v_expires));

  return jsonb_build_object('school_id', v_school, 'hostname', v_host, 'code', v_code,
                            'pool', v_pool.label, 'license_expires_on', v_expires);
exception
  when unique_violation then
    raise exception 'A school with that code or address already exists.';
end;
$$;
revoke all on function public.create_school_shared(text,text,text,text,text,text,text,text,numeric) from public, anon;
grant execute on function public.create_school_shared(text,text,text,text,text,text,text,text,numeric) to authenticated;

create function public.create_school_dedicated(
  p_code text, p_name text, p_contact_name text, p_contact_email text, p_contact_phone text,
  p_school_type text, p_region text, p_plan text, p_billing_cycle text, p_price numeric
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text := lower(trim(coalesce(p_code, '')));
  v_name text := trim(coalesce(p_name, ''));
  v_email text := nullif(trim(coalesce(p_contact_email, '')), '');
  v_plan text := coalesce(nullif(trim(coalesce(p_plan, '')), ''), 'standard');
  v_domain text; v_host text; v_school uuid; v_expires date := current_date + interval '1 year';
begin
  if not public.has_tpi_role(array['owner', 'engineer']) then
    raise exception 'Not allowed.' using errcode = '42501';
  end if;
  if v_code !~ '^[a-z][a-z0-9]{1,29}$' then
    raise exception 'The school code must be 2 to 30 characters: lowercase letters and digits, starting with a letter.';
  end if;
  if char_length(v_name) < 2 or char_length(v_name) > 120 then
    raise exception 'The school name must be 2 to 120 characters.';
  end if;
  if p_school_type not in ('private', 'public') then
    raise exception 'School type must be private or public.';
  end if;
  if p_billing_cycle is null or p_billing_cycle not in ('monthly', 'annual') then
    raise exception 'The billing cycle must be monthly or annual.';
  end if;
  if p_price is null or p_price < 0 then
    raise exception 'The price must be zero or more.';
  end if;

  select ps.platform_domain into v_domain from public.platform_settings ps limit 1;
  v_host := v_code || '.' || v_domain;

  insert into public.schools (code, name, status, plan, contact_name, contact_email, contact_phone, school_type)
  values (v_code, v_name, 'pending', v_plan, nullif(trim(coalesce(p_contact_name, '')), ''), v_email,
          nullif(trim(coalesce(p_contact_phone, '')), ''), p_school_type)
  returning id into v_school;

  insert into public.school_domains (school_id, domain_type, hostname, is_primary)
  values (v_school, 'platform_subdomain', v_host, true);

  insert into public.subscriptions (school_id, plan, billing_cycle, price_amount, status, license_expires_on)
  values (v_school, v_plan, p_billing_cycle, p_price, 'active', v_expires);

  insert into public.operations_log (actor_id, action, school_id, details)
  values ((select auth.uid()), 'school_created_dedicated', v_school,
          jsonb_build_object('code', v_code, 'hostname', v_host, 'license_expires_on', v_expires,
                             'note', 'awaiting its own Supabase project'));

  return jsonb_build_object('school_id', v_school, 'hostname', v_host, 'code', v_code, 'awaiting_connection', true);
exception
  when unique_violation then
    raise exception 'A school with that code or address already exists.';
end;
$$;
revoke all on function public.create_school_dedicated(text,text,text,text,text,text,text,text,text,numeric) from public, anon;
grant execute on function public.create_school_dedicated(text,text,text,text,text,text,text,text,text,numeric) to authenticated;

create function public.attach_dedicated_project(p_school_id uuid, p_url text, p_key text, p_region text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text := lower(trim(both '/' from trim(coalesce(p_url, ''))));
  v_key text := trim(coalesce(p_key, ''));
  v_ref text;
begin
  if not public.has_tpi_role(array['owner', 'engineer']) then
    raise exception 'Not allowed.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.schools where id = p_school_id) then
    raise exception 'School not found.';
  end if;
  perform public.assert_publishable_key(v_key);
  v_ref := substring(v_url from '^https://([a-z0-9]{20})\.supabase\.co$');
  if v_ref is null then
    raise exception 'The project address must look like https://xxxxxxxxxxxxxxxxxxxx.supabase.co.';
  end if;

  insert into public.school_projects (school_id, supabase_project_ref, supabase_url, anon_key, region, kind)
  values (p_school_id, v_ref, v_url, v_key, coalesce(nullif(trim(coalesce(p_region, '')), ''), 'unspecified'), 'dedicated')
  on conflict (school_id) do update
    set supabase_project_ref = excluded.supabase_project_ref, supabase_url = excluded.supabase_url,
        anon_key = excluded.anon_key, region = excluded.region, kind = 'dedicated', updated_at = now();

  insert into public.operations_log (actor_id, action, school_id, details)
  values ((select auth.uid()), 'dedicated_project_attached', p_school_id, jsonb_build_object('project_ref', v_ref));
exception
  when unique_violation then
    raise exception 'That project is already the dedicated project for a different school.';
end;
$$;
revoke all on function public.attach_dedicated_project(uuid, text, text, text) from public, anon;
grant execute on function public.attach_dedicated_project(uuid, text, text, text) to authenticated;

drop function public.resolve_school_by_hostname(text);
create function public.resolve_school_by_hostname(p_hostname text)
returns table (school_id uuid, school_code text, school_name text, status text, supabase_url text, anon_key text)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.code, s.name, s.status, sp.supabase_url, sp.anon_key
  from public.school_domains d
  join public.schools s on s.id = d.school_id
  left join public.school_projects sp on sp.school_id = s.id
  where d.hostname = lower(trim(p_hostname))
  limit 1;
$$;
