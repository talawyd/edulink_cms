-- 0007_delete_school.sql  (TPI CONTROL)
-- A real, careful delete, separate from suspend/offboard. For a school that
-- was never real (a typo, a test entry), not for a real customer who leaves,
-- that is what offboarding is for.
--
-- Owner only. Requires typing the school's exact code back as confirmation,
-- the same pattern GitHub uses for deleting a repository. Writes one final
-- audit entry, with the code and name captured in it, before the row and
-- everything that cascades from it (project, domain, subscription, licence
-- secret and keys, checklist) is gone for good.

-- operations_log must survive a deleted school, so its own history of what
-- happened is not erased along with the school. Only this one foreign key
-- changes; every other cascade (school_projects, school_domains,
-- subscriptions, license_secrets, license_keys, school_checklist) stays as
-- ON DELETE CASCADE, since those tables have no meaning without the school.
alter table public.operations_log
  drop constraint operations_log_school_id_fkey,
  add constraint operations_log_school_id_fkey
    foreign key (school_id) references public.schools (id) on delete set null;

create function public.delete_school(p_school_id uuid, p_confirm_code text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
  v_name text;
begin
  if not public.has_tpi_role(array['owner']) then
    raise exception 'Only an owner can delete a school. Suspend or offboard it instead.' using errcode = '42501';
  end if;

  select code, name into v_code, v_name from public.schools where id = p_school_id;
  if v_code is null then
    raise exception 'School not found.';
  end if;

  if p_confirm_code is null or trim(p_confirm_code) <> v_code then
    raise exception 'Type the school code exactly to confirm: %', v_code;
  end if;

  insert into public.operations_log (actor_id, action, school_id, details)
  values ((select auth.uid()), 'school_deleted', p_school_id,
          jsonb_build_object('code', v_code, 'name', v_name));

  delete from public.schools where id = p_school_id;
end;
$$;
revoke all on function public.delete_school(uuid, text) from public, anon;
grant execute on function public.delete_school(uuid, text) to authenticated;
