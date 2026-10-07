-- 0010_self_edit_name.sql  (TPI CONTROL)
-- Lets a staff member correct their own display name without needing an
-- owner. Touches only the caller's own tpi_staff row — never anyone else's,
-- and never the role or active columns.

create function public.update_my_staff_name(p_full_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_name text := trim(coalesce(p_full_name, ''));
begin
  if char_length(v_name) < 2 then
    raise exception 'A name is required.';
  end if;
  update public.tpi_staff set full_name = v_name where user_id = (select auth.uid());
  insert into public.operations_log (actor_id, action, details)
  values ((select auth.uid()), 'staff_self_renamed', jsonb_build_object('full_name', v_name));
end;
$$;
revoke all on function public.update_my_staff_name(text) from public, anon;
grant execute on function public.update_my_staff_name(text) to authenticated;
