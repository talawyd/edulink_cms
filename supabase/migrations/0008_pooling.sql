-- 0008_pooling.sql  (TPI CONTROL)
-- Many schools may now share one Supabase project (a "pool"): one pool for
-- private schools, one for public schools. A dedicated project, sold as the
-- premium option, still holds exactly one school.

alter table public.school_projects drop constraint school_projects_supabase_project_ref_key;

alter table public.school_projects
  add column kind text not null default 'pooled' check (kind in ('pooled', 'dedicated'));
create index school_projects_ref_idx on public.school_projects (supabase_project_ref);
create unique index school_projects_one_school_per_dedicated
  on public.school_projects (supabase_project_ref) where kind = 'dedicated';

-- A project is either a shared pool or one school's own, never both.
create function public.school_projects_kind_consistent()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if exists (select 1 from public.school_projects p
             where p.supabase_project_ref = new.supabase_project_ref
               and p.id <> new.id and p.kind <> new.kind) then
    raise exception 'A Supabase project is either a shared pool or one school''s dedicated project, not both.';
  end if;
  return new;
end;
$$;
create trigger school_projects_kind_check before insert or update of supabase_project_ref, kind
  on public.school_projects for each row execute function public.school_projects_kind_consistent();

-- What kind of school this is, which drives its price.
alter table public.schools
  add column school_type text check (school_type in ('private', 'public')),
  add column size_tier   text check (size_tier in ('small', 'medium', 'large', 'very_large'));

-- Sets a school's type, size tier and hosting in one audited step. Making a
-- school dedicated is refused while other schools still share its project.
create function public.set_school_profile(p_school_id uuid, p_type text, p_tier text, p_hosting text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_ref text; v_sharing int;
begin
  if not public.has_tpi_role(array['owner', 'engineer']) then
    raise exception 'Not allowed.' using errcode = '42501';
  end if;
  if p_type not in ('private', 'public') then
    raise exception 'School type must be private or public.';
  end if;
  if p_tier not in ('small', 'medium', 'large', 'very_large') then
    raise exception 'Size must be small, medium, large or very_large.';
  end if;
  if p_hosting not in ('pooled', 'dedicated') then
    raise exception 'Hosting must be pooled or dedicated.';
  end if;

  select supabase_project_ref into v_ref from public.school_projects where school_id = p_school_id;
  if v_ref is null then
    raise exception 'School not found.';
  end if;
  if p_hosting = 'dedicated' then
    select count(*) into v_sharing from public.school_projects where supabase_project_ref = v_ref and school_id <> p_school_id;
    if v_sharing > 0 then
      raise exception 'This project is shared with % other school(s). A dedicated school needs its own project.', v_sharing;
    end if;
  end if;

  update public.schools set school_type = p_type, size_tier = p_tier where id = p_school_id;
  update public.school_projects set kind = p_hosting, updated_at = now() where school_id = p_school_id;
  insert into public.operations_log (actor_id, action, school_id, details)
  values ((select auth.uid()), 'school_profile_set', p_school_id,
          jsonb_build_object('type', p_type, 'tier', p_tier, 'hosting', p_hosting));
end;
$$;
revoke all on function public.set_school_profile(uuid, text, text, text) from public, anon;
grant execute on function public.set_school_profile(uuid, text, text, text) to authenticated;

-- The portal needs the school's id as well: inside a pool, that id is how a
-- school is told apart from its neighbours.
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
  join public.school_projects sp on sp.school_id = s.id
  where d.hostname = lower(trim(p_hostname))
  limit 1;
$$;

-- Registering a school no longer fails because its project is already in use.
CREATE OR REPLACE FUNCTION public.create_school(p_code text, p_name text, p_contact_name text, p_contact_email text, p_contact_phone text, p_supabase_url text, p_publishable_key text, p_region text, p_plan text, p_billing_cycle text, p_price numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_code   text := lower(trim(coalesce(p_code, '')));
  v_name   text := trim(coalesce(p_name, ''));
  v_url    text := lower(trim(both '/' from trim(coalesce(p_supabase_url, ''))));
  v_key    text := trim(coalesce(p_publishable_key, ''));
  v_email  text := nullif(trim(coalesce(p_contact_email, '')), '');
  v_plan   text := coalesce(nullif(trim(coalesce(p_plan, '')), ''), 'standard');
  v_ref    text;
  v_domain text;
  v_host   text;
  v_school uuid;
  v_expires date := current_date + interval '1 year';
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

  perform public.assert_publishable_key(v_key);
  v_ref := substring(v_url from '^https://([a-z0-9]{20})\.supabase\.co$');
  if v_ref is null then
    raise exception 'The project address must look like https://xxxxxxxxxxxxxxxxxxxx.supabase.co (20 characters before .supabase.co).';
  end if;

  if p_billing_cycle is null or p_billing_cycle not in ('monthly', 'annual') then
    raise exception 'The billing cycle must be monthly or annual.';
  end if;
  if p_price is null or p_price < 0 then
    raise exception 'The price must be zero or more.';
  end if;

  select ps.platform_domain into v_domain from public.platform_settings ps limit 1;
  v_host := v_code || '.' || v_domain;

  insert into public.schools (code, name, status, plan, contact_name, contact_email, contact_phone)
  values (v_code, v_name, 'pending', v_plan,
          nullif(trim(coalesce(p_contact_name, '')), ''), v_email,
          nullif(trim(coalesce(p_contact_phone, '')), ''))
  returning id into v_school;

  insert into public.school_projects (school_id, supabase_project_ref, supabase_url, anon_key, region)
  values (v_school, v_ref, v_url, v_key, coalesce(nullif(trim(coalesce(p_region, '')), ''), 'unspecified'));

  insert into public.school_domains (school_id, domain_type, hostname, is_primary)
  values (v_school, 'platform_subdomain', v_host, true);

  -- The first period is always exactly one year, calculated here, never
  -- supplied by the caller.
  insert into public.subscriptions (school_id, plan, billing_cycle, price_amount, status, license_expires_on)
  values (v_school, v_plan, p_billing_cycle, p_price, 'active', v_expires);

  insert into public.operations_log (actor_id, action, school_id, details)
  values ((select auth.uid()), 'school_created', v_school,
          jsonb_build_object('code', v_code, 'project_ref', v_ref, 'hostname', v_host, 'license_expires_on', v_expires));

  return jsonb_build_object('school_id', v_school, 'hostname', v_host, 'code', v_code, 'license_expires_on', v_expires);
exception
  when unique_violation then
    raise exception 'A school with that code or address already exists.';
end;
$function$;
