-- delete_school_check.sql
-- Run in the TPI CONTROL project's SQL editor. Creates its own throwaway
-- owner and engineer accounts and a throwaway school, tests permission,
-- a wrong confirmation code, the real cascade, and that history survives
-- the school it describes, then rolls everything back. The error at the
-- end is intentional; the report is inside it.
do $t$
declare
  own uuid := gen_random_uuid(); eng uuid := gen_random_uuid();
  tag text := substr(md5(random()::text), 1, 6);
  code text := 'zd' || tag;
  ref text := substr(md5(random()::text), 1, 20);
  key text := 'sb_publishable_' || substr(md5(random()::text) || md5(random()::text), 1, 30);
  sid uuid; res jsonb; n int; report text := '';
begin
  insert into auth.users (id, email) values (own, 'own-'||tag||'@x.invalid'), (eng, 'eng-'||tag||'@x.invalid');
  insert into public.tpi_staff (user_id, full_name, role) values (own, 'Owner', 'owner'), (eng, 'Engineer', 'engineer');

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', own::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', own, 'role', 'authenticated', 'aal', 'aal1')::text, true);

  select public.create_school(code, 'Delete Test School', 'Head', 'head@example.com', '+264',
    'https://' || ref || '.supabase.co', key, 'af-south-1', 'standard', 'annual', 12000) into res;
  sid := (res->>'school_id')::uuid;
  perform public.create_license_secret(sid);
  reset role;
  update public.subscriptions set license_expires_on = current_date + 10 where school_id = sid;
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', own::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', own, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  perform public.generate_license_key(sid);
  insert into public.school_checklist (school_id, step_key) values (sid, 'project_created');

  raise notice '---- A. an engineer cannot delete a school';
  perform set_config('request.jwt.claim.sub', eng::text, true);
  begin
    perform public.delete_school(sid, code);
    raise notice 'FAIL  engineer was allowed to delete';
  exception when insufficient_privilege then raise notice 'PASS  engineer refused'; end;

  raise notice '---- B. wrong confirmation code refuses and deletes nothing';
  perform set_config('request.jwt.claim.sub', own::text, true);
  begin
    perform public.delete_school(sid, 'wrongcode');
    raise notice 'FAIL  wrong code was accepted';
  exception when others then raise notice 'PASS  wrong code refused: %', sqlerrm; end;
  select count(*) into n from public.schools where id = sid;
  raise notice '%  the school still exists after a refused attempt (want 1, got %)', case when n=1 then 'PASS' else 'FAIL' end, n;

  raise notice '---- C. the real delete';
  perform public.delete_school(sid, code);
  select count(*) into n from public.schools where id = sid;
  raise notice '%  the school row is gone (want 0, got %)', case when n=0 then 'PASS' else 'FAIL' end, n;
  select count(*) into n from public.school_projects where school_id = sid;
  raise notice '%  its project row cascaded away (want 0, got %)', case when n=0 then 'PASS' else 'FAIL' end, n;
  select count(*) into n from public.school_domains where school_id = sid;
  raise notice '%  its domain row cascaded away (want 0, got %)', case when n=0 then 'PASS' else 'FAIL' end, n;
  select count(*) into n from public.subscriptions where school_id = sid;
  raise notice '%  its subscription cascaded away (want 0, got %)', case when n=0 then 'PASS' else 'FAIL' end, n;
  select count(*) into n from public.license_secrets where school_id = sid;
  raise notice '%  its signing secret cascaded away (want 0, got %)', case when n=0 then 'PASS' else 'FAIL' end, n;
  select count(*) into n from public.license_keys where school_id = sid;
  raise notice '%  its issued keys cascaded away (want 0, got %)', case when n=0 then 'PASS' else 'FAIL' end, n;
  select count(*) into n from public.school_checklist where school_id = sid;
  raise notice '%  its checklist cascaded away (want 0, got %)', case when n=0 then 'PASS' else 'FAIL' end, n;

  raise notice '---- D. history survives the school';
  reset role;
  select count(*) into n from public.operations_log where school_id is null and details->>'code' = code and action = 'school_deleted';
  raise notice '%  the deletion itself is logged, with the code preserved (want 1, got %)', case when n=1 then 'PASS' else 'FAIL' end, n;
  select count(*) into n from public.operations_log where details->>'code' = code and action = 'school_created';
  raise notice '%  the earlier creation log entry still exists too (want 1, got %)', case when n=1 then 'PASS' else 'FAIL' end, n;

  raise exception 'test finished, rolling back';
end
$t$;
