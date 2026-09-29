-- 0005_platform_hardening.sql  (TPI CONTROL)
-- Makes the registry safe to drive from a screen:
--   * a pasted SECRET key is refused, so TPIC can never hold one
--   * school codes must be clean and can never collide with our own addresses
--   * onboarding a school is ONE atomic step, never a half made school
--   * optional multi factor enforcement for the three owners
--   * team management, onboarding checklist and an activity log helper

-- ---------------------------------------------------------------------
-- 1. Platform settings (one row)
-- ---------------------------------------------------------------------
create table public.platform_settings (
  id                 boolean primary key default true check (id),
  platform_domain    text not null default 'edulink.live'
                       check (platform_domain ~ '^[a-z0-9-]+(\.[a-z0-9-]+)+$'),
  require_mfa        boolean not null default false,
  default_grace_days int not null default 30 check (default_grace_days between 0 and 180)
);
insert into public.platform_settings default values;
alter table public.platform_settings enable row level security;
revoke all on public.platform_settings from anon;

-- When require_mfa is on, TPIC staff must have completed a second factor
-- (aal2). Turn it on only after all three of you have enrolled, or you lock
-- yourselves out. Recovery: run "update public.platform_settings set
-- require_mfa = false;" in this project's SQL editor.
create or replace function public.has_tpi_role(p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
           select 1 from public.tpi_staff s
           where s.user_id = (select auth.uid()) and s.role = any (p_roles) and s.active
         )
     and ( not coalesce((select ps.require_mfa from public.platform_settings ps limit 1), false)
           or coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2' );
$$;

create policy platform_settings_read on public.platform_settings for select to authenticated
  using ( public.has_tpi_role(array['owner', 'engineer', 'support']) );
create policy platform_settings_owner_update on public.platform_settings for update to authenticated
  using ( public.has_tpi_role(array['owner']) ) with check ( public.has_tpi_role(array['owner']) );

-- ---------------------------------------------------------------------
-- 2. School code and project rules
-- ---------------------------------------------------------------------
alter table public.schools
  add constraint schools_code_format check (code ~ '^[a-z][a-z0-9]{1,29}$'),
  add constraint schools_code_reserved check (code <> all (array[
    'www','tpic','admin','app','api','mail','email','smtp','ftp','ns1','ns2','staging','dev','test',
    'demo','portal','login','auth','static','cdn','assets','status','support','help','docs','blog',
    'edulink','tpi','root','dashboard','control','registry','vercel','supabase']));

create function public.schools_code_is_permanent()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.code is distinct from old.code then
    raise exception 'A school code cannot be changed after it is created, because it is part of the school''s web address.';
  end if;
  return new;
end;
$$;
create trigger schools_code_permanent before update on public.schools
  for each row execute function public.schools_code_is_permanent();

alter table public.school_projects alter column secrets_ref drop not null;
alter table public.school_projects
  add constraint school_projects_ref_format check (supabase_project_ref ~ '^[a-z0-9]{20}$'),
  add constraint school_projects_url_matches check (supabase_url = 'https://' || supabase_project_ref || '.supabase.co'),
  add constraint school_projects_key_format check (anon_key ~ '^sb_publishable_[A-Za-z0-9_-]{20,}$');
comment on column public.school_projects.anon_key is 'Holds the PUBLISHABLE key (sb_publishable_...). Never a secret key.';
comment on column public.school_projects.secrets_ref is 'Unused. TPIC never stores or points to school secret keys.';

alter table public.school_domains drop constraint school_domains_domain_type_check;
update public.school_domains set domain_type = 'platform_subdomain' where domain_type = 'tpilearning_subdomain';
alter table public.school_domains
  add constraint school_domains_domain_type_check
    check (domain_type in ('platform_subdomain', 'school_website', 'custom_portal_domain')),
  add constraint school_domains_hostname_lower check (hostname = lower(hostname));

-- Friendly, specific refusals for the mistakes that matter most.
create function public.assert_publishable_key(p_key text)
returns void language plpgsql immutable set search_path = ''
as $$
begin
  if p_key is null or p_key = '' then
    raise exception 'The publishable key is required.';
  end if;
  if left(p_key, 10) = 'sb_secret_' then
    raise exception 'That is a SECRET key. Never paste secret keys anywhere. Use the publishable key, which starts with sb_publishable_.';
  end if;
  if left(p_key, 3) = 'eyJ' then
    raise exception 'That looks like a legacy JWT key and could be the powerful service_role key. Use the publishable key, which starts with sb_publishable_.';
  end if;
  if p_key !~ '^sb_publishable_[A-Za-z0-9_-]{20,}$' then
    raise exception 'That does not look like a publishable key. It starts with sb_publishable_ and contains no spaces.';
  end if;
end;
$$;
revoke all on function public.assert_publishable_key(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. Onboarding checklist
-- ---------------------------------------------------------------------
create table public.school_checklist (
  school_id uuid not null references public.schools (id) on delete cascade,
  step_key  text not null check (step_key ~ '^[a-z][a-z0-9_]{2,39}$'),
  done_at   timestamptz not null default now(),
  done_by   uuid references auth.users (id) on delete set null,
  note      text check (char_length(note) <= 500),
  primary key (school_id, step_key)
);
alter table public.school_checklist enable row level security;
revoke all on public.school_checklist from anon;

create function public.stamp_done_by()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is not null then new.done_by := (select auth.uid()); end if;
  return new;
end;
$$;
create trigger school_checklist_stamp before insert or update on public.school_checklist
  for each row execute function public.stamp_done_by();

create policy school_checklist_read on public.school_checklist for select to authenticated
  using ( public.has_tpi_role(array['owner', 'engineer', 'support']) );
create policy school_checklist_write on public.school_checklist for all to authenticated
  using ( public.has_tpi_role(array['owner', 'engineer']) )
  with check ( public.has_tpi_role(array['owner', 'engineer']) );

-- ---------------------------------------------------------------------
-- 4. Onboarding a school, atomically
-- ---------------------------------------------------------------------
create function public.create_school(
  p_code text, p_name text,
  p_contact_name text, p_contact_email text, p_contact_phone text,
  p_supabase_url text, p_publishable_key text, p_region text,
  p_plan text, p_billing_cycle text, p_price numeric, p_expires_on date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
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
  if p_expires_on is null or p_expires_on <= current_date or p_expires_on > current_date + 1100 then
    raise exception 'The subscription expiry must be a future date within about three years.';
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

  insert into public.subscriptions (school_id, plan, billing_cycle, price_amount, status, license_expires_on)
  values (v_school, v_plan, p_billing_cycle, p_price, 'active', p_expires_on);

  insert into public.operations_log (actor_id, action, school_id, details)
  values ((select auth.uid()), 'school_created', v_school,
          jsonb_build_object('code', v_code, 'project_ref', v_ref, 'hostname', v_host));

  return jsonb_build_object('school_id', v_school, 'hostname', v_host, 'code', v_code);
exception
  when unique_violation then
    raise exception 'A school with that code, project or address already exists.';
end;
$$;
revoke all on function public.create_school(text,text,text,text,text,text,text,text,text,text,numeric,date) from public, anon;
grant execute on function public.create_school(text,text,text,text,text,text,text,text,text,text,numeric,date) to authenticated;

create function public.update_school_project(
  p_school_id uuid, p_supabase_url text, p_publishable_key text, p_region text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text := lower(trim(both '/' from trim(coalesce(p_supabase_url, ''))));
  v_key text := trim(coalesce(p_publishable_key, ''));
  v_ref text;
begin
  if not public.has_tpi_role(array['owner', 'engineer']) then
    raise exception 'Not allowed.' using errcode = '42501';
  end if;
  perform public.assert_publishable_key(v_key);
  v_ref := substring(v_url from '^https://([a-z0-9]{20})\.supabase\.co$');
  if v_ref is null then
    raise exception 'The project address must look like https://xxxxxxxxxxxxxxxxxxxx.supabase.co (20 characters before .supabase.co).';
  end if;
  update public.school_projects
     set supabase_project_ref = v_ref, supabase_url = v_url, anon_key = v_key,
         region = coalesce(nullif(trim(coalesce(p_region, '')), ''), region), updated_at = now()
   where school_id = p_school_id;
  if not found then
    raise exception 'School not found.';
  end if;
  insert into public.operations_log (actor_id, action, school_id, details)
  values ((select auth.uid()), 'school_project_updated', p_school_id, jsonb_build_object('project_ref', v_ref));
exception
  when unique_violation then
    raise exception 'Another school already uses that project.';
end;
$$;
revoke all on function public.update_school_project(uuid, text, text, text) from public, anon;
grant execute on function public.update_school_project(uuid, text, text, text) to authenticated;

create function public.set_school_status(p_school_id uuid, p_status text, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_tpi_role(array['owner', 'engineer']) then
    raise exception 'Not allowed.' using errcode = '42501';
  end if;
  if p_status is null or p_status not in ('pending', 'active', 'suspended', 'offboarded') then
    raise exception 'Status must be pending, active, suspended or offboarded.';
  end if;
  update public.schools set status = p_status where id = p_school_id;
  if not found then
    raise exception 'School not found.';
  end if;
  insert into public.operations_log (actor_id, action, school_id, details)
  values ((select auth.uid()), 'school_status_changed', p_school_id,
          jsonb_build_object('status', p_status, 'reason', left(coalesce(p_reason, ''), 300)));
end;
$$;
revoke all on function public.set_school_status(uuid, text, text) from public, anon;
grant execute on function public.set_school_status(uuid, text, text) to authenticated;

-- The screen records actions that happen outside the database (a password
-- reset script prepared, a key emailed). Never put a password or key in details.
create function public.log_operation(p_action text, p_school_id uuid default null, p_details jsonb default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_tpi_role(array['owner', 'engineer', 'support']) then
    raise exception 'Not allowed.' using errcode = '42501';
  end if;
  if p_action is null or p_action !~ '^[a-z][a-z_]{2,59}$' then
    raise exception 'Action names use lowercase letters and underscores.';
  end if;
  insert into public.operations_log (actor_id, action, school_id, details)
  values ((select auth.uid()), p_action, p_school_id, p_details);
end;
$$;
revoke all on function public.log_operation(text, uuid, jsonb) from public, anon;
grant execute on function public.log_operation(text, uuid, jsonb) to authenticated;

-- Lost the signing secret before pasting it into the school project, or think
-- it leaked? Rotating replaces it. Keys issued earlier stop working, so the new
-- secret must also be set in the school project.
create function public.rotate_license_secret(p_school_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare v_secret text;
begin
  if not public.has_tpi_role(array['owner', 'engineer']) then
    raise exception 'Not allowed.' using errcode = '42501';
  end if;
  v_secret := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  update public.license_secrets set secret = v_secret, created_at = now() where school_id = p_school_id;
  if not found then
    raise exception 'This school has no signing secret yet. Create one first.';
  end if;
  insert into public.operations_log (actor_id, action, school_id)
  values ((select auth.uid()), 'license_secret_rotated', p_school_id);
  return v_secret;
end;
$$;
revoke all on function public.rotate_license_secret(uuid) from public, anon;
grant execute on function public.rotate_license_secret(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 5. Team management
-- ---------------------------------------------------------------------
create function public.list_tpi_staff()
returns table (user_id uuid, email text, full_name text, role text, active boolean, last_sign_in_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select s.user_id, u.email::text, s.full_name, s.role, s.active, u.last_sign_in_at
  from public.tpi_staff s join auth.users u on u.id = s.user_id
  where public.has_tpi_role(array['owner', 'engineer', 'support'])
  order by s.full_name;
$$;
revoke all on function public.list_tpi_staff() from public, anon;
grant execute on function public.list_tpi_staff() to authenticated;

create function public.add_tpi_staff(p_email text, p_full_name text, p_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_user uuid;
begin
  if not public.has_tpi_role(array['owner']) then
    raise exception 'Only an owner can add team members.' using errcode = '42501';
  end if;
  if p_role is null or p_role not in ('owner', 'engineer', 'support') then
    raise exception 'Role must be owner, engineer or support.';
  end if;
  if char_length(trim(coalesce(p_full_name, ''))) < 2 then
    raise exception 'A name is required.';
  end if;
  select id into v_user from auth.users where lower(email) = lower(trim(coalesce(p_email, '')));
  if v_user is null then
    raise exception 'No login with that email exists yet. Create it in the Supabase dashboard under Authentication, Users, first.';
  end if;
  insert into public.tpi_staff (user_id, full_name, role, active)
  values (v_user, trim(p_full_name), p_role, true)
  on conflict (user_id) do update set full_name = excluded.full_name, role = excluded.role, active = true;
  insert into public.operations_log (actor_id, action, details)
  values ((select auth.uid()), 'staff_added', jsonb_build_object('user_id', v_user, 'role', p_role));
end;
$$;
revoke all on function public.add_tpi_staff(text, text, text) from public, anon;
grant execute on function public.add_tpi_staff(text, text, text) to authenticated;

create function public.set_tpi_staff_active(p_user_id uuid, p_active boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_role text; v_other_owners int;
begin
  if not public.has_tpi_role(array['owner']) then
    raise exception 'Only an owner can change team members.' using errcode = '42501';
  end if;
  select role into v_role from public.tpi_staff where user_id = p_user_id;
  if v_role is null then
    raise exception 'Team member not found.';
  end if;
  if not p_active and v_role = 'owner' then
    select count(*) into v_other_owners from public.tpi_staff
     where role = 'owner' and active and user_id <> p_user_id;
    if v_other_owners = 0 then
      raise exception 'You cannot deactivate the last active owner.';
    end if;
  end if;
  update public.tpi_staff set active = p_active where user_id = p_user_id;
  insert into public.operations_log (actor_id, action, details)
  values ((select auth.uid()), case when p_active then 'staff_reactivated' else 'staff_deactivated' end,
          jsonb_build_object('user_id', p_user_id));
end;
$$;
revoke all on function public.set_tpi_staff_active(uuid, boolean) from public, anon;
grant execute on function public.set_tpi_staff_active(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- 6. The lookup the portal makes. Same columns as before; now case blind.
-- ---------------------------------------------------------------------
create or replace function public.resolve_school_by_hostname(p_hostname text)
returns table (school_code text, school_name text, status text, supabase_url text, anon_key text)
language sql
stable
security definer
set search_path = ''
as $$
  select s.code, s.name, s.status, sp.supabase_url, sp.anon_key
  from public.school_domains d
  join public.schools s on s.id = d.school_id
  join public.school_projects sp on sp.school_id = s.id
  where d.hostname = lower(trim(p_hostname))
  limit 1;
$$;
