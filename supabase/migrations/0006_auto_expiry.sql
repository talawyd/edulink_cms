-- 0006_auto_expiry.sql  (TPI CONTROL)
-- create_school no longer accepts an expiry date. The first subscription
-- period is always exactly one year from onboarding, calculated by the
-- database, so there is no path for a wrong or missing expiry date to reach
-- a real school. update_school_project and the rest of the licensing flow
-- (rotating secrets, issuing renewal keys) are unaffected.

drop function if exists public.create_school(text,text,text,text,text,text,text,text,text,text,numeric,date);

create function public.create_school(
  p_code text, p_name text,
  p_contact_name text, p_contact_email text, p_contact_phone text,
  p_supabase_url text, p_publishable_key text, p_region text,
  p_plan text, p_billing_cycle text, p_price numeric
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
    raise exception 'A school with that code, project or address already exists.';
end;
$$;
revoke all on function public.create_school(text,text,text,text,text,text,text,text,text,text,numeric) from public, anon;
grant execute on function public.create_school(text,text,text,text,text,text,text,text,text,text,numeric) to authenticated;
