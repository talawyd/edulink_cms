-- tpic_check.sql
-- Run in the TPI CONTROL project's SQL editor (never in a school project).
-- It first deactivates all existing staff INSIDE the test, creates its own,
-- and rolls everything back at the end, so it is safe on the real project.
-- A red banner ending in P0001 is expected: the report is inside it.
do $test$
declare
  report text := '';
  n int; fails int; res jsonb; r1 text; r2 text; t text;
  own1 uuid := gen_random_uuid(); own2 uuid := gen_random_uuid();
  eng uuid := gen_random_uuid();  sup uuid := gen_random_uuid();
  nobody uuid := gen_random_uuid(); newbie uuid := gen_random_uuid();
  tag text := substr(md5(random()::text), 1, 6);
  c1 text := 'zt' || tag;            -- a valid school code unique to this run
  ref1 text := substr(md5(random()::text), 1, 20);
  ref2 text := substr(md5(random()::text), 1, 20);
  url1 text; url2 text;
  key1 text := 'sb_publishable_' || substr(md5(random()::text) || md5(random()::text), 1, 30);
  key2 text := 'sb_publishable_' || substr(md5(random()::text) || md5(random()::text), 1, 30);
  sid uuid; sec1 text; sec2 text; newbie_email text; v uuid; v2 uuid;
begin
  url1 := 'https://' || ref1 || '.supabase.co';
  url2 := 'https://' || ref2 || '.supabase.co';

  -- Inside this rolled back test only: no real staff, MFA off, known domain.
  update public.tpi_staff set active = false;
  update public.platform_settings set require_mfa = false, platform_domain = 'edulink.live';
  insert into auth.users (id, email) values
    (own1, 'own1-' || tag || '@example.invalid'), (own2, 'own2-' || tag || '@example.invalid'),
    (eng,  'eng-'  || tag || '@example.invalid'), (sup,  'sup-'  || tag || '@example.invalid'),
    (nobody, 'nobody-' || tag || '@example.invalid'), (newbie, 'newbie-' || tag || '@example.invalid');
  newbie_email := 'newbie-' || tag || '@example.invalid';
  insert into public.tpi_staff (user_id, full_name, role) values
    (own1, 'Owner One', 'owner'), (own2, 'Owner Two', 'owner'),
    (eng, 'Engineer', 'engineer'), (sup, 'Support', 'support');

  select count(*) into n from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
   where ns.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
  report := report || format(E'%s | every table has row level security | expected 0, got %s\n', case when n = 0 then 'PASS' else 'FAIL' end, n);

  set local role authenticated;


  -- A. SCHOOL CODE RULES (direct inserts, as an owner)
  begin
  perform set_config('request.jwt.claim.sub', own1::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', own1, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  begin
    insert into public.schools (code, name) values ('a', 'X');
    report := report || E'FAIL | A school code is refused: a (too short) (it was allowed)\n';
  exception when check_violation then
    report := report || E'PASS | A school code is refused: a (too short)\n';
  end;
  begin
    insert into public.schools (code, name) values ('A1', 'X');
    report := report || E'FAIL | A school code is refused: A1 (capital letters) (it was allowed)\n';
  exception when check_violation then
    report := report || E'PASS | A school code is refused: A1 (capital letters)\n';
  end;
  begin
    insert into public.schools (code, name) values ('st-g', 'X');
    report := report || E'FAIL | A school code is refused: st-g (a hyphen) (it was allowed)\n';
  exception when check_violation then
    report := report || E'PASS | A school code is refused: st-g (a hyphen)\n';
  end;
  begin
    insert into public.schools (code, name) values ('9abc', 'X');
    report := report || E'FAIL | A school code is refused: 9abc (starts with a digit) (it was allowed)\n';
  exception when check_violation then
    report := report || E'PASS | A school code is refused: 9abc (starts with a digit)\n';
  end;
  begin
    insert into public.schools (code, name) values ('www', 'X');
    report := report || E'FAIL | A school code is refused: www (reserved: www) (it was allowed)\n';
  exception when check_violation then
    report := report || E'PASS | A school code is refused: www (reserved: www)\n';
  end;
  begin
    insert into public.schools (code, name) values ('tpic', 'X');
    report := report || E'FAIL | A school code is refused: tpic (reserved: tpic) (it was allowed)\n';
  exception when check_violation then
    report := report || E'PASS | A school code is refused: tpic (reserved: tpic)\n';
  end;
  begin
    insert into public.schools (code, name) values ('admin', 'X');
    report := report || E'FAIL | A school code is refused: admin (reserved: admin) (it was allowed)\n';
  exception when check_violation then
    report := report || E'PASS | A school code is refused: admin (reserved: admin)\n';
  end;
  begin
    insert into public.schools (code, name) values ('edulink', 'X');
    report := report || E'FAIL | A school code is refused: edulink (reserved: edulink) (it was allowed)\n';
  exception when check_violation then
    report := report || E'PASS | A school code is refused: edulink (reserved: edulink)\n';
  end;
  exception when others then
    report := report || format(E'FAIL | section crashed and could not finish | A. SCHOOL CODE RULES (direct inserts, as an owner) | %s\n', sqlerrm);
    reset role;
    set local role authenticated;
  end;

  -- B. ONBOARDING A SCHOOL IN ONE STEP
  begin
  select public.create_school(c1, 'Test School', 'Head', 'head@example.com', '+264', url1, key1, 'af-south-1', 'standard', 'annual', 12000) into res;
  sid := (res->>'school_id')::uuid;
  report := report || format(E'%s | create_school returns the auto calculated expiry, exactly one year out | expected %s, got %s\n', case when (res->>'license_expires_on')::date = current_date + interval '1 year' then 'PASS' else 'FAIL' end, current_date + interval '1 year', res->>'license_expires_on');
  report := report || format(E'%s | the address is built from the code and the platform domain | expected %s, got %s\n', case when res->>'hostname' = c1 || '.edulink.live' then 'PASS' else 'FAIL' end, c1 || '.edulink.live', res->>'hostname');
  n := (select count(*) from public.schools where id = sid and status = 'pending');
  report := report || format(E'%s | the school row exists and starts as pending | expected 1, got %s\n', case when n = 1 then 'PASS' else 'FAIL' end, n);
  n := (select count(*) from public.school_projects where school_id = sid and supabase_project_ref = ref1);
  report := report || format(E'%s | the project row exists and holds the project reference | expected 1, got %s\n', case when n = 1 then 'PASS' else 'FAIL' end, n);
  n := (select count(*) from public.school_domains where school_id = sid and hostname = c1 || '.edulink.live' and is_primary and domain_type = 'platform_subdomain');
  report := report || format(E'%s | the address row exists and is primary | expected 1, got %s\n', case when n = 1 then 'PASS' else 'FAIL' end, n);
  n := (select count(*) from public.subscriptions where school_id = sid and license_expires_on = current_date + interval '1 year');
  report := report || format(E'%s | the subscription exists with its expiry | expected 1, got %s\n', case when n = 1 then 'PASS' else 'FAIL' end, n);
  n := (select count(*) from public.operations_log where school_id = sid and action = 'school_created');
  report := report || format(E'%s | the onboarding was recorded in the activity log | expected 1, got %s\n', case when n = 1 then 'PASS' else 'FAIL' end, n);
  n := (select count(*) from public.operations_log where school_id = sid and details::text like '%' || key1 || '%');
  report := report || format(E'%s | the log does not contain the publishable key | expected 0, got %s\n', case when n = 0 then 'PASS' else 'FAIL' end, n);
  exception when others then
    report := report || format(E'FAIL | section crashed and could not finish | B. ONBOARDING A SCHOOL IN ONE STEP | %s\n', sqlerrm);
    reset role;
    set local role authenticated;
  end;

  -- C. MISTAKES THAT MUST BE REFUSED, WITH NO HALF MADE SCHOOL LEFT BEHIND
  begin
  n := (select count(*) from public.schools);
  r1 := 'zz' || tag;
  r2 := 'zy' || tag;
  begin
    perform public.create_school(r1, 'Test School', 'Head', 'head@example.com', '+264', url2, 'sb_secret_' || substr(md5(random()::text) || md5(random()::text), 1, 30), 'af-south-1', 'standard', 'annual', 12000);
    report := report || E'FAIL | A SECRET key is refused (it was allowed)\n';
  exception when others then
    report := report || E'PASS | A SECRET key is refused\n';
  end;
  begin
    perform public.create_school(r1, 'Test School', 'Head', 'head@example.com', '+264', url2, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abcdefghijklmnop.abcdefghijklmnopqrstuv', 'af-south-1', 'standard', 'annual', 12000);
    report := report || E'FAIL | A legacy JWT style key is refused (it was allowed)\n';
  exception when others then
    report := report || E'PASS | A legacy JWT style key is refused\n';
  end;
  begin
    perform public.create_school(r1, 'Test School', 'Head', 'head@example.com', '+264', url2, 'not-a-key', 'af-south-1', 'standard', 'annual', 12000);
    report := report || E'FAIL | A key with no prefix is refused (it was allowed)\n';
  exception when others then
    report := report || E'PASS | A key with no prefix is refused\n';
  end;
  begin
    perform public.create_school(r1, 'Test School', 'Head', 'head@example.com', '+264', url2, 'sb_publishable_ abcdefghijklmnopqrstuvwxyz1234', 'af-south-1', 'standard', 'annual', 12000);
    report := report || E'FAIL | A key with a space in it is refused (it was allowed)\n';
  exception when others then
    report := report || E'PASS | A key with a space in it is refused\n';
  end;
  begin
    perform public.create_school(r1, 'Test School', 'Head', 'head@example.com', '+264', 'https://example.com', key2, 'af-south-1', 'standard', 'annual', 12000);
    report := report || E'FAIL | A project address that is not a Supabase address is refused (it was allowed)\n';
  exception when others then
    report := report || E'PASS | A project address that is not a Supabase address is refused\n';
  end;
  begin
    perform public.create_school(r1, 'Test School', 'Head', 'head@example.com', '+264', 'https://short.supabase.co', key2, 'af-south-1', 'standard', 'annual', 12000);
    report := report || E'FAIL | A project address with the wrong length is refused (it was allowed)\n';
  exception when others then
    report := report || E'PASS | A project address with the wrong length is refused\n';
  end;
  begin
    perform public.create_school('tpic', 'Test School', 'Head', 'head@example.com', '+264', url2, key2, 'af-south-1', 'standard', 'annual', 12000);
    report := report || E'FAIL | A reserved code is refused by onboarding (it was allowed)\n';
  exception when others then
    report := report || E'PASS | A reserved code is refused by onboarding\n';
  end;
  begin
    perform public.create_school('My School', 'Test School', 'Head', 'head@example.com', '+264', url2, key2, 'af-south-1', 'standard', 'annual', 12000);
    report := report || E'FAIL | A code with capital letters and spaces is refused (it was allowed)\n';
  exception when others then
    report := report || E'PASS | A code with capital letters and spaces is refused\n';
  end;
  begin
    perform public.create_school(c1, 'Test School', 'Head', 'head@example.com', '+264', url2, key2, 'af-south-1', 'standard', 'annual', 12000);
    report := report || E'FAIL | A duplicate school code is refused (it was allowed)\n';
  exception when others then
    report := report || E'PASS | A duplicate school code is refused\n';
  end;
  n := ((select count(*) from public.schools) - n);
  report := report || format(E'%s | none of the refused attempts left a school behind | expected 0, got %s\n', case when n = 0 then 'PASS' else 'FAIL' end, n);
  n := (select count(*) from public.school_projects sp where not exists (select 1 from public.schools s where s.id = sp.school_id));
  report := report || format(E'%s | no orphan project rows exist | expected 0, got %s\n', case when n = 0 then 'PASS' else 'FAIL' end, n);
  n := (select count(*) from public.school_domains where school_id = sid);
  report := report || format(E'%s | the duplicate attempts left no extra address rows | expected 1, got %s\n', case when n = 1 then 'PASS' else 'FAIL' end, n);

  n := (select count(*) from public.school_projects where anon_key !~ '^sb_publishable_');
  report := report || format(E'%s | no school project holds anything except a publishable key | expected 0, got %s\n', case when n = 0 then 'PASS' else 'FAIL' end, n);
  exception when others then
    report := report || format(E'FAIL | section crashed and could not finish | C. MISTAKES THAT MUST BE REFUSED, WITH NO HALF MADE SCHOOL LEFT BEHIND | %s\n', sqlerrm);
    reset role;
    set local role authenticated;
  end;

  -- D. WHO MAY ONBOARD
  begin
  perform set_config('request.jwt.claim.sub', sup::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', sup, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  begin
    perform public.create_school(r2, 'Test School', 'Head', 'head@example.com', '+264', url2, key2, 'af-south-1', 'standard', 'annual', 12000);
    report := report || E'FAIL | Support staff cannot onboard a school (it was allowed)\n';
  exception when insufficient_privilege then
    report := report || E'PASS | Support staff cannot onboard a school\n';
  end;
  perform set_config('request.jwt.claim.sub', nobody::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', nobody, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  begin
    perform public.create_school(r2, 'Test School', 'Head', 'head@example.com', '+264', url2, key2, 'af-south-1', 'standard', 'annual', 12000);
    report := report || E'FAIL | A logged in stranger cannot onboard a school (it was allowed)\n';
  exception when insufficient_privilege then
    report := report || E'PASS | A logged in stranger cannot onboard a school\n';
  end;
  n := (select count(*) from public.schools);
  report := report || format(E'%s | A logged in stranger sees no schools | expected 0, got %s\n', case when n = 0 then 'PASS' else 'FAIL' end, n);
  n := (select count(*) from public.subscriptions);
  report := report || format(E'%s | A logged in stranger sees no subscriptions | expected 0, got %s\n', case when n = 0 then 'PASS' else 'FAIL' end, n);
  n := (select count(*) from public.school_projects);
  report := report || format(E'%s | A logged in stranger sees no school projects | expected 0, got %s\n', case when n = 0 then 'PASS' else 'FAIL' end, n);
  perform set_config('request.jwt.claim.sub', sup::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', sup, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  n := (select count(*) from public.schools where id = sid);
  report := report || format(E'%s | Support can read schools | expected 1, got %s\n', case when n = 1 then 'PASS' else 'FAIL' end, n);
  begin
    perform public.set_school_status(sid, 'suspended');
    report := report || E'FAIL | Support cannot change a school''s status (it was allowed)\n';
  exception when insufficient_privilege then
    report := report || E'PASS | Support cannot change a school''s status\n';
  end;
  begin
    perform public.rotate_license_secret(sid);
    report := report || E'FAIL | Support cannot rotate a signing secret (it was allowed)\n';
  exception when insufficient_privilege then
    report := report || E'PASS | Support cannot rotate a signing secret\n';
  end;
  exception when others then
    report := report || format(E'FAIL | section crashed and could not finish | D. WHO MAY ONBOARD | %s\n', sqlerrm);
    reset role;
    set local role authenticated;
  end;

  -- E. THE LOOKUP THE PORTAL MAKES
  begin
  perform set_config('request.jwt.claim.sub', own1::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', own1, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  set local role anon;
  select count(*) into n from public.resolve_school_by_hostname(upper(c1 || '.edulink.live'));
  report := report || format(E'%s | a logged out visitor can look an address up, in any letter case | expected 1, got %s\n', case when n = 1 then 'PASS' else 'FAIL' end, n);
  select count(*) into n from public.resolve_school_by_hostname('nosuchschool.edulink.live');
  report := report || format(E'%s | an unknown address returns nothing | expected 0, got %s\n', case when n = 0 then 'PASS' else 'FAIL' end, n);
  select anon_key into t from public.resolve_school_by_hostname(c1 || '.edulink.live');
  report := report || format(E'%s | the lookup returns the publishable key and never anything else secret | got a key starting %s\n', case when t = key1 then 'PASS' else 'FAIL' end, left(t, 15));
  begin
    perform 1 from public.schools;
    report := report || E'FAIL | A logged out visitor cannot read the schools table (it was allowed)\n';
  exception when insufficient_privilege then
    report := report || E'PASS | A logged out visitor cannot read the schools table\n';
  end;
  begin
    perform 1 from public.school_projects;
    report := report || E'FAIL | A logged out visitor cannot read the school projects table (it was allowed)\n';
  exception when insufficient_privilege then
    report := report || E'PASS | A logged out visitor cannot read the school projects table\n';
  end;
  begin
    perform public.create_school(r2, 'Test School', 'Head', 'head@example.com', '+264', url2, key2, 'af-south-1', 'standard', 'annual', 12000);
    report := report || E'FAIL | A logged out visitor cannot onboard a school (it was allowed)\n';
  exception when insufficient_privilege then
    report := report || E'PASS | A logged out visitor cannot onboard a school\n';
  end;
  begin
    perform public.log_operation('some_action');
    report := report || E'FAIL | A logged out visitor cannot write to the activity log (it was allowed)\n';
  exception when insufficient_privilege then
    report := report || E'PASS | A logged out visitor cannot write to the activity log\n';
  end;
  set local role authenticated;
  exception when others then
    report := report || format(E'FAIL | section crashed and could not finish | E. THE LOOKUP THE PORTAL MAKES | %s\n', sqlerrm);
    reset role;
    set local role authenticated;
  end;

  -- F. CHANGING A SCHOOL
  begin
  perform set_config('request.jwt.claim.sub', own1::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', own1, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  begin
    update public.schools set code = 'zzchanged' where id = sid;
    report := report || E'FAIL | A school code cannot be changed (it was allowed)\n';
  exception when others then
    report := report || E'PASS | A school code cannot be changed\n';
  end;
  perform public.set_school_status(sid, 'suspended', 'unpaid');
  select status into t from public.resolve_school_by_hostname(c1 || '.edulink.live');
  report := report || format(E'%s | suspending a school shows as suspended in the lookup | got %s\n', case when t = 'suspended' then 'PASS' else 'FAIL' end, t);
  begin
    perform public.set_school_status(sid, 'banana');
    report := report || E'FAIL | An invalid status is refused (it was allowed)\n';
  exception when others then
    report := report || E'PASS | An invalid status is refused\n';
  end;
  perform public.set_school_status(sid, 'active');
  begin
    perform public.update_school_project(sid, url1, 'sb_secret_' || substr(md5(random()::text) || md5(random()::text), 1, 30));
    report := report || E'FAIL | Swapping in a SECRET key is refused (it was allowed)\n';
  exception when others then
    report := report || E'PASS | Swapping in a SECRET key is refused\n';
  end;
  perform public.update_school_project(sid, url2, key2, 'eu-west-1');
  select anon_key into t from public.resolve_school_by_hostname(c1 || '.edulink.live');
  report := report || format(E'%s | updating the connection changes what the portal receives | got %s\n', case when t = key2 then 'PASS' else 'FAIL' end, left(t, 15));
  n := (select count(*) from public.operations_log where school_id = sid and action = 'school_status_changed');
  report := report || format(E'%s | status changes are in the activity log | expected 2, got %s\n', case when n = 2 then 'PASS' else 'FAIL' end, n);
  exception when others then
    report := report || format(E'FAIL | section crashed and could not finish | F. CHANGING A SCHOOL | %s\n', sqlerrm);
    reset role;
    set local role authenticated;
  end;

  -- G. LICENCE SECRETS AND KEYS
  begin
  select public.create_license_secret(sid) into sec1;
  reset role;
  n := (select count(*) from public.license_secrets where school_id = sid);
  report := report || format(E'%s | a signing secret was created | expected 1, got %s\n', case when n = 1 then 'PASS' else 'FAIL' end, n);
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', own1::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', own1, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  begin
    perform public.create_license_secret(sid);
    report := report || E'FAIL | A second secret cannot be created over the first (it was allowed)\n';
  exception when others then
    report := report || E'PASS | A second secret cannot be created over the first\n';
  end;
  select public.rotate_license_secret(sid) into sec2;
  report := report || format(E'%s | rotating gives a different secret | different: %s\n', case when sec1 <> sec2 and length(sec2) = 64 then 'PASS' else 'FAIL' end, (sec1 <> sec2));
  -- A fresh school starts with a one year expiry, but generate_license_key
  -- only issues a key inside the reminder window. Move this one school's
  -- expiry near, as it would genuinely be by the time an admin does this.
  reset role;
  update public.subscriptions set license_expires_on = current_date + 10 where school_id = sid;
  set local role authenticated;
  select public.generate_license_key(sid) ->> 'key' into t;
  report := report || format(E'%s | a key is issued in the 20 character format | got %s\n', case when t ~ '^[0-9A-F]{4}(-[0-9A-F]{4}){4}$' then 'PASS' else 'FAIL' end, t);
  n := (select count(*) from public.license_keys where school_id = sid);
  report := report || format(E'%s | the issued key is stored for the record | expected 1, got %s\n', case when n = 1 then 'PASS' else 'FAIL' end, n);
  n := (select count(*) from public.license_secrets);
  report := report || format(E'%s | nobody can read the signing secrets table directly | expected 0, got %s\n', case when n = 0 then 'PASS' else 'FAIL' end, n);
  exception when others then
    report := report || format(E'FAIL | section crashed and could not finish | G. LICENCE SECRETS AND KEYS | %s\n', sqlerrm);
    reset role;
    set local role authenticated;
  end;

  -- H. TEAM MANAGEMENT
  begin
  select count(*) into n from public.list_tpi_staff() where email like '%@example.invalid';
  report := report || format(E'%s | staff can list the team with emails | expected 4, got %s\n', case when n = 4 then 'PASS' else 'FAIL' end, n);
  begin
    perform public.add_tpi_staff('nobody-here@example.invalid', 'Ghost', 'support');
    report := report || E'FAIL | Adding someone with no login is refused (it was allowed)\n';
  exception when others then
    report := report || E'PASS | Adding someone with no login is refused\n';
  end;
  begin
    perform public.add_tpi_staff(newbie_email, 'New Person', 'god');
    report := report || E'FAIL | An invalid role is refused (it was allowed)\n';
  exception when others then
    report := report || E'PASS | An invalid role is refused\n';
  end;
  perform public.add_tpi_staff(newbie_email, 'New Person', 'support');
  n := (select count(*) from public.tpi_staff where user_id = newbie and role = 'support' and active);
  report := report || format(E'%s | a member is added by email once their login exists | expected 1, got %s\n', case when n = 1 then 'PASS' else 'FAIL' end, n);
  perform public.set_tpi_staff_active(own2, false);
  n := (select count(*) from public.tpi_staff where user_id = own2 and not active);
  report := report || format(E'%s | an owner can be deactivated while another owner remains | expected 1, got %s\n', case when n = 1 then 'PASS' else 'FAIL' end, n);
  begin
    perform public.set_tpi_staff_active(own1, false);
    report := report || E'FAIL | The last active owner cannot be deactivated (it was allowed)\n';
  exception when others then
    report := report || E'PASS | The last active owner cannot be deactivated\n';
  end;
  perform public.set_tpi_staff_active(own2, true);
  perform set_config('request.jwt.claim.sub', eng::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', eng, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  begin
    perform public.add_tpi_staff('x@example.invalid', 'X', 'support');
    report := report || E'FAIL | An engineer cannot add team members (it was allowed)\n';
  exception when insufficient_privilege then
    report := report || E'PASS | An engineer cannot add team members\n';
  end;
  begin
    perform public.set_tpi_staff_active(sup, false);
    report := report || E'FAIL | An engineer cannot deactivate team members (it was allowed)\n';
  exception when insufficient_privilege then
    report := report || E'PASS | An engineer cannot deactivate team members\n';
  end;
  perform set_config('request.jwt.claim.sub', nobody::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', nobody, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  n := (select count(*) from public.list_tpi_staff());
  report := report || format(E'%s | a stranger cannot list the team | expected 0, got %s\n', case when n = 0 then 'PASS' else 'FAIL' end, n);
  perform set_config('request.jwt.claim.sub', sup::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', sup, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  update public.tpi_staff set role = 'owner' where user_id = sup;
  get diagnostics n = row_count;
  report := report || format(E'%s | Support cannot promote themselves (rows changed) | expected 0, got %s\n', case when n = 0 then 'PASS' else 'FAIL' end, n);
  n := (select count(*) from public.tpi_staff where user_id = sup and role = 'support');
  report := report || format(E'%s | Support is still support | expected 1, got %s\n', case when n = 1 then 'PASS' else 'FAIL' end, n);
  exception when others then
    report := report || format(E'FAIL | section crashed and could not finish | H. TEAM MANAGEMENT | %s\n', sqlerrm);
    reset role;
    set local role authenticated;
  end;

  -- I. ONBOARDING CHECKLIST AND ACTIVITY LOG
  begin
  perform set_config('request.jwt.claim.sub', own1::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', own1, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  insert into public.school_checklist (school_id, step_key, done_by) values (sid, 'signups_off', nobody);
  n := (select count(*) from public.school_checklist where school_id = sid and step_key = 'signups_off' and done_by = own1);
  report := report || format(E'%s | the checklist records the real person, not a forged one | expected 1, got %s\n', case when n = 1 then 'PASS' else 'FAIL' end, n);
  begin
    insert into public.school_checklist (school_id, step_key) values (sid, 'Bad Step!');
    report := report || E'FAIL | A malformed step name is refused (it was allowed)\n';
  exception when check_violation then
    report := report || E'PASS | A malformed step name is refused\n';
  end;
  perform public.log_operation('admin_password_reset_prepared', sid, jsonb_build_object('admin', 'head@example.com'));
  n := (select count(*) from public.operations_log where school_id = sid and action = 'admin_password_reset_prepared');
  report := report || format(E'%s | a custom activity entry is recorded | expected 1, got %s\n', case when n = 1 then 'PASS' else 'FAIL' end, n);
  begin
    perform public.log_operation('DROP TABLE');
    report := report || E'FAIL | A bad action name is refused (it was allowed)\n';
  exception when others then
    report := report || E'PASS | A bad action name is refused\n';
  end;
  perform set_config('request.jwt.claim.sub', nobody::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', nobody, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  begin
    insert into public.school_checklist (school_id, step_key) values (sid, 'hacked');
    report := report || E'FAIL | A stranger cannot tick a checklist step (it was allowed)\n';
  exception when insufficient_privilege then
    report := report || E'PASS | A stranger cannot tick a checklist step\n';
  end;
  begin
    perform public.log_operation('some_action');
    report := report || E'FAIL | A stranger cannot write to the activity log (it was allowed)\n';
  exception when insufficient_privilege then
    report := report || E'PASS | A stranger cannot write to the activity log\n';
  end;
  exception when others then
    report := report || format(E'FAIL | section crashed and could not finish | I. ONBOARDING CHECKLIST AND ACTIVITY LOG | %s\n', sqlerrm);
    reset role;
    set local role authenticated;
  end;

  -- J. MULTI FACTOR ENFORCEMENT (the switch)
  begin
  perform set_config('request.jwt.claim.sub', own1::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', own1, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  update public.platform_settings set require_mfa = true;
  n := (select count(*) from public.schools);
  report := report || format(E'%s | with the switch on, a first factor only login is locked out of the schools | expected 0, got %s\n', case when n = 0 then 'PASS' else 'FAIL' end, n);
  n := (select count(*) from public.tpi_staff where user_id = own1);
  report := report || format(E'%s | with the switch on, that login can still read its own staff row (to enrol) | expected 1, got %s\n', case when n = 1 then 'PASS' else 'FAIL' end, n);
  begin
    perform public.create_school(r2, 'Test School', 'Head', 'head@example.com', '+264', url2, key2, 'af-south-1', 'standard', 'annual', 12000);
    report := report || E'FAIL | with the switch on, a first factor only login cannot onboard (it was allowed)\n';
  exception when insufficient_privilege then
    report := report || E'PASS | with the switch on, a first factor only login cannot onboard\n';
  end;
  perform set_config('request.jwt.claim.sub', own1::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', own1, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  n := (select count(*) from public.schools where id = sid);
  report := report || format(E'%s | with the switch on, a second factor login works normally | expected 1, got %s\n', case when n = 1 then 'PASS' else 'FAIL' end, n);
  update public.platform_settings set require_mfa = false;
  perform set_config('request.jwt.claim.sub', own1::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', own1, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  n := (select count(*) from public.schools where id = sid);
  report := report || format(E'%s | with the switch off again, a first factor login works | expected 1, got %s\n', case when n = 1 then 'PASS' else 'FAIL' end, n);
  perform set_config('request.jwt.claim.sub', eng::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', eng, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  update public.platform_settings set default_grace_days = 99;
  n := (select default_grace_days from public.platform_settings limit 1);
  report := report || format(E'%s | only an owner may change platform settings | value is %s (want 30)\n', case when n = 30 then 'PASS' else 'FAIL' end, n);

  exception when others then
    report := report || format(E'FAIL | section crashed and could not finish | J. MULTI FACTOR ENFORCEMENT (the switch) | %s\n', sqlerrm);
    reset role;
    set local role authenticated;
  end;

  -- K. POOLED HOSTING (many schools on one project)
  report := report || E'---- K. POOLED HOSTING (many schools on one project)\n';
  begin
    set local role authenticated;
    perform set_config('request.jwt.claim.sub', own1::text, true);
    perform set_config('request.jwt.claims', json_build_object('sub', own1, 'role', 'authenticated', 'aal', 'aal1')::text, true);

    select public.create_school('zs' || tag, 'Second School', 'Head', 'head2@example.com', '+264', url2, key2, 'af-south-1', 'standard', 'annual', 9000) into res;
    v := (res->>'school_id')::uuid;
    n := (select count(*) from public.school_projects where supabase_project_ref = ref2);
    report := report || format(E'%s | two schools can now share one pooled project | expected 2, got %s\n', case when n = 2 then 'PASS' else 'FAIL' end, n);

    select count(distinct school_id) into n from public.resolve_school_by_hostname('zs' || tag || '.edulink.live') where supabase_url = url2;
    report := report || format(E'%s | the lookup returns the school and the shared project | expected 1, got %s\n', case when n = 1 then 'PASS' else 'FAIL' end, n);
    select school_id into v2 from public.resolve_school_by_hostname(c1 || '.edulink.live');
    select school_id into sec1 from public.resolve_school_by_hostname('zs' || tag || '.edulink.live');
    report := report || format(E'%s | the lookup returns each school its OWN id even on a shared project | first %s, second %s\n',
      case when v2 = sid and sec1::uuid = v and v2 <> sec1::uuid then 'PASS' else 'FAIL' end, left(v2::text, 8), left(sec1, 8));

    begin
      perform public.set_school_profile(v, 'private', 'small', 'dedicated');
      report := report || E'FAIL | a school cannot become dedicated while others share its project (it was allowed)\n';
    exception when raise_exception then
      report := report || E'PASS | a school cannot become dedicated while others share its project\n';
    end;

    perform public.set_school_profile(v, 'private', 'small', 'pooled');
    n := (select count(*) from public.schools where id = v and school_type = 'private' and size_tier = 'small');
    report := report || format(E'%s | a school profile (type and size) is saved | expected 1, got %s\n', case when n = 1 then 'PASS' else 'FAIL' end, n);

    begin
      perform public.set_school_profile(v, 'banana', 'small', 'pooled');
      report := report || E'FAIL | an invalid school type was accepted\n';
    exception when raise_exception then
      report := report || E'PASS | an invalid school type is refused\n';
    end;

    t := 'https://' || substr(md5(random()::text), 1, 20) || '.supabase.co';
    select public.create_school('zd' || tag, 'Dedicated School', 'Head', 'head3@example.com', '+264', t, key2, 'af-south-1', 'standard', 'annual', 9000) into res;
    perform public.set_school_profile((res->>'school_id')::uuid, 'public', 'large', 'dedicated');
    n := (select count(*) from public.school_projects where school_id = (res->>'school_id')::uuid and kind = 'dedicated');
    report := report || format(E'%s | a school on its own project can be made dedicated | expected 1, got %s\n', case when n = 1 then 'PASS' else 'FAIL' end, n);
    begin
      perform public.create_school('ze' || tag, 'Intruder School', 'Head', 'head4@example.com', '+264', t, key2, 'af-south-1', 'standard', 'annual', 9000);
      report := report || E'FAIL | a second school was allowed onto a dedicated project\n';
    exception when raise_exception then
      report := report || E'PASS | a second school cannot join a dedicated project\n';
    end;
    set local role anon;
    begin
      perform public.set_school_profile(v, 'private', 'small', 'pooled');
      report := report || E'FAIL | a logged out visitor changed a school profile\n';
    exception when insufficient_privilege then
      report := report || E'PASS | a logged out visitor cannot change a school profile\n';
    end;
    set local role authenticated;
  exception when others then
    report := report || format(E'FAIL | section crashed and could not finish | %s\n', sqlerrm);
  end;
  reset role;

  fails := array_length(regexp_split_to_array(report, 'FAIL'), 1) - 1;
  raise exception E'\n\nTPIC TEST REPORT (this error is intentional; it rolls back all test data)\n\nRESULT: % failed\n\n%\n', fails, report;
end;
$test$;
