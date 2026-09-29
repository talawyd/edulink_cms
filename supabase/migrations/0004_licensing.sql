-- 0004_licensing.sql  (TPI CONTROL)
-- Subscriptions, renewal reminders and activation keys.
--
-- Each school has its OWN signing secret, kept here and in that school's project.
-- A secret is never shared between schools, so if one school's database leaked,
-- that school could forge only its own licence. No other school is affected, and
-- no school data is exposed.

alter table public.subscriptions
  add column license_expires_on date,
  add column reminder_window_days int not null default 60 check (reminder_window_days between 7 and 180),
  add column last_reminder_sent_at timestamptz;

-- Signing secrets. No policy of any kind: only the functions below may read them.
create table public.license_secrets (
  school_id  uuid primary key references public.schools (id) on delete cascade,
  secret     text not null,
  created_at timestamptz not null default now()
);
alter table public.license_secrets enable row level security;

-- Every key ever issued, so you can see what was sent and whether it was used.
create table public.license_keys (
  id           uuid primary key default gen_random_uuid(),
  school_id    uuid not null references public.schools (id) on delete cascade,
  key_id       int not null,
  key_text     text not null,
  expires_on   date not null,
  issued_by    uuid references auth.users (id),
  issued_at    timestamptz not null default now(),
  sent_at      timestamptz,
  sent_to      text,
  unique (school_id, key_id)
);
create index license_keys_school_idx on public.license_keys (school_id, issued_at desc);
alter table public.license_keys enable row level security;

create policy license_keys_staff_read on public.license_keys for select to authenticated
  using ( public.has_tpi_role(array['owner', 'engineer', 'support']) );
create policy license_keys_staff_update on public.license_keys for update to authenticated
  using ( public.has_tpi_role(array['owner', 'engineer', 'support']) )
  with check ( public.has_tpi_role(array['owner', 'engineer', 'support']) );
-- No insert policy: keys are only created by the function below.

-- Called once at onboarding. Returns the secret ONE time so it can be put into
-- the school's own project. After that it is never readable again.
create function public.create_license_secret(p_school_id uuid)
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
  if exists (select 1 from public.license_secrets where school_id = p_school_id) then
    raise exception 'This school already has a signing secret. Rotating it would invalidate its licence.';
  end if;
  -- gen_random_uuid lives in the catalog, so it works with an empty search_path.
  -- Two of them give 244 bits of randomness, far more than the 256 bit key needs.
  v_secret := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  insert into public.license_secrets (school_id, secret) values (p_school_id, v_secret);
  insert into public.operations_log (actor_id, action, school_id)
  values ((select auth.uid()), 'license_secret_created', p_school_id);
  return v_secret;
end;
$$;
revoke all on function public.create_license_secret(uuid) from public, anon;
grant execute on function public.create_license_secret(uuid) to authenticated;

-- Which schools are due for renewal, for the dashboard list.
create function public.subscriptions_due(p_within_days int default 60)
returns table (school_id uuid, code text, name text, contact_email text,
               license_expires_on date, days_left int, state text, last_reminder_sent_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.code, s.name, s.contact_email, sub.license_expires_on,
         (sub.license_expires_on - current_date)::int,
         case when sub.license_expires_on >= current_date then 'active' else 'expired' end,
         sub.last_reminder_sent_at
  from public.schools s
  join public.subscriptions sub on sub.school_id = s.id
  where public.has_tpi_role(array['owner', 'engineer', 'support'])
    and sub.license_expires_on is not null
    and sub.license_expires_on <= current_date + p_within_days
  order by sub.license_expires_on;
$$;
revoke all on function public.subscriptions_due(int) from public, anon;
grant execute on function public.subscriptions_due(int) to authenticated;

-- Issue an activation key. Adds one year to whatever remains, or a year from
-- today if the subscription has already lapsed. Refuses to issue earlier than the
-- reminder window, so keys cannot be stockpiled.
--
-- The key carries an ABSOLUTE expiry date, so entering it twice is harmless.
create function public.generate_license_key(p_school_id uuid, p_years int default 1)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret text; v_current date; v_window int; v_new date;
  v_key_id int; v_days int; v_payload bytea; v_sig bytea; v_hex text; v_key text;
  v_hmac_schema text;
begin
  if not public.has_tpi_role(array['owner', 'engineer']) then
    raise exception 'Not allowed.' using errcode = '42501';
  end if;
  if p_years < 1 or p_years > 3 then
    raise exception 'Between one and three years.';
  end if;

  select secret into v_secret from public.license_secrets where school_id = p_school_id;
  if v_secret is null then
    raise exception 'This school has no signing secret yet. Create one during onboarding.';
  end if;
  select license_expires_on, reminder_window_days into v_current, v_window
  from public.subscriptions where school_id = p_school_id;
  if v_current is null then
    raise exception 'This school has no subscription record yet.';
  end if;

  if v_current - current_date > v_window then
    raise exception 'Too early. A key can be issued from % (% days before expiry).',
      to_char(v_current - v_window, 'DD Mon YYYY'), v_window;
  end if;

  v_new := greatest(v_current, current_date) + (p_years || ' years')::interval;
  v_days := v_new - date '2020-01-01';
  if v_days < 0 or v_days > 65535 then
    raise exception 'That date cannot be encoded in a key.';
  end if;

  select coalesce(max(key_id), 0) + 1 into v_key_id from public.license_keys where school_id = p_school_id;
  if v_key_id > 65535 then
    raise exception 'Too many keys issued for this school.';
  end if;

  v_payload := set_byte(set_byte(set_byte(set_byte('\x00000000'::bytea,
                 0, (v_days >> 8) & 255), 1, v_days & 255),
                 2, (v_key_id >> 8) & 255), 3, v_key_id & 255);

  select n.nspname into v_hmac_schema
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where p.proname = 'hmac' and pg_get_function_identity_arguments(p.oid) = 'bytea, bytea, text' limit 1;
  if v_hmac_schema is null then
    raise exception 'pgcrypto is not installed, so keys cannot be signed.';
  end if;
  execute format('select substring(%I.hmac($1, $2::bytea, ''sha256'') from 1 for 6)', v_hmac_schema)
    into v_sig using v_payload, v_secret;

  v_hex := upper(encode(v_payload, 'hex') || encode(v_sig, 'hex'));
  v_key := substring(v_hex,1,4) || '-' || substring(v_hex,5,4) || '-' || substring(v_hex,9,4)
        || '-' || substring(v_hex,13,4) || '-' || substring(v_hex,17,4);

  insert into public.license_keys (school_id, key_id, key_text, expires_on, issued_by)
  values (p_school_id, v_key_id, v_key, v_new, (select auth.uid()));

  insert into public.operations_log (actor_id, action, school_id, details)
  values ((select auth.uid()), 'license_key_issued', p_school_id,
          jsonb_build_object('key_id', v_key_id, 'expires_on', v_new));

  return jsonb_build_object('key', v_key, 'expires_on', v_new, 'key_id', v_key_id);
end;
$$;
revoke all on function public.generate_license_key(uuid, int) from public, anon;
grant execute on function public.generate_license_key(uuid, int) to authenticated;

-- Record that the key was emailed, and move TPIC's own expectation forward.
create function public.mark_license_key_sent(p_key_row uuid, p_sent_to text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_school uuid; v_expires date;
begin
  if not public.has_tpi_role(array['owner', 'engineer', 'support']) then
    raise exception 'Not allowed.' using errcode = '42501';
  end if;
  update public.license_keys set sent_at = now(), sent_to = p_sent_to
  where id = p_key_row returning school_id, expires_on into v_school, v_expires;
  if v_school is null then
    raise exception 'Key not found.';
  end if;
  update public.subscriptions
     set license_expires_on = greatest(coalesce(license_expires_on, v_expires), v_expires),
         last_reminder_sent_at = now()
   where school_id = v_school;
end;
$$;
revoke all on function public.mark_license_key_sent(uuid, text) from public, anon;
grant execute on function public.mark_license_key_sent(uuid, text) to authenticated;
