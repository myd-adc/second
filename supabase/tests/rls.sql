-- RLS / constraint checks. Run: psql -v ON_ERROR_STOP=1 -f supabase/tests/rls.sql
-- NOTE: needs auth.jwt() (provided by the real Supabase stack). Runs in one transaction that is rolled back; exits non-zero on any FAIL.
\set ON_ERROR_STOP 1
begin;

create temp table _res (ok boolean, name text);
grant all on _res to anon, authenticated;

insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at) values
  ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-000000000000','authenticated','authenticated','a@rls.test', now()),
  ('22222222-2222-2222-2222-222222222222','00000000-0000-0000-0000-000000000000','authenticated','authenticated','b@rls.test', now()),
  ('33333333-3333-3333-3333-333333333333','00000000-0000-0000-0000-000000000000','authenticated','authenticated','x@rls.test', now()),
  ('44444444-4444-4444-4444-444444444444','00000000-0000-0000-0000-000000000000','authenticated','authenticated','u@rls.test', null),
  ('55555555-5555-5555-5555-555555555555','00000000-0000-0000-0000-000000000000','authenticated','authenticated','n@rls.test', now());
delete from public.profiles where id = '55555555-5555-5555-5555-555555555555';
insert into public.allowed_emails (email) values ('a@rls.test'), ('b@rls.test'), ('u@rls.test');

-- helper: run statement as role/user; record pass if it behaves as expected
create function pg_temp.act_as(uid text, em text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    case when uid is null then '' else json_build_object('sub', uid, 'email', em, 'role', 'authenticated')::text end, true);
  perform set_config('request.jwt.claim.sub', coalesce(uid, ''), true);
end $$;

-- expect(name, sql, 'ok'|'error'|'rows=N'); executes with current role
create function pg_temp.expect(name text, stmt text, want text) returns void language plpgsql as $$
declare n bigint; failed boolean := false; ok boolean;
begin
  begin
    if want like 'rows=%' then
      execute 'select count(*) from (' || stmt || ') q' into n;
      ok := n = substr(want, 6)::bigint;
    else
      execute stmt;
      ok := want = 'ok';
    end if;
  exception when others then
    ok := want = 'error';
  end;
  insert into _res values (ok, name);
  raise notice '% %', case when ok then 'PASS' else 'FAIL' end, name;
end $$;
grant execute on function pg_temp.expect(text, text, text) to anon, authenticated;
grant execute on function pg_temp.act_as(text, text) to anon, authenticated;

-- fixtures as superuser
insert into public.stores (id, name, created_by) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'store A', '11111111-1111-1111-1111-111111111111');
insert into public.delivery_events (store_id, date, happened, reported_by) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '2026-10-01', true, '11111111-1111-1111-1111-111111111111');

-- (a) anon
set local role anon;
select pg_temp.act_as(null, null);
select pg_temp.expect('a1 anon sees 0 stores', 'select * from public.stores', 'rows=0');
select pg_temp.expect('a2 anon cannot insert store', $q$insert into public.stores(name, created_by) values ('x','11111111-1111-1111-1111-111111111111')$q$, 'error');
reset role;

-- (b) authenticated, not allowed
set local role authenticated;
select pg_temp.act_as('33333333-3333-3333-3333-333333333333', 'x@rls.test');
select pg_temp.expect('b1 non-allowed sees 0 stores', 'select * from public.stores', 'rows=0');
select pg_temp.expect('b2 non-allowed cannot insert store', $q$insert into public.stores(name, created_by) values ('x','33333333-3333-3333-3333-333333333333')$q$, 'error');
select pg_temp.expect('b3 non-allowed sees 0 profiles', 'select * from public.profiles', 'rows=0');
select pg_temp.act_as('44444444-4444-4444-4444-444444444444', 'u@rls.test');
select pg_temp.expect('b4 whitelisted but UNCONFIRMED email sees 0 stores', 'select * from public.stores', 'rows=0');
select pg_temp.expect('b5 whitelisted but UNCONFIRMED email cannot insert', $q$insert into public.stores(name, created_by) values ('x','44444444-4444-4444-4444-444444444444')$q$, 'error');
select pg_temp.expect('b6 unconfirmed: is_allowed() is false', 'select 1 where public.is_allowed()', 'rows=0');
select pg_temp.act_as('33333333-3333-3333-3333-333333333333', 'a@rls.test');
select pg_temp.expect('b7 forged email claim (uid not whitelisted) denied', 'select * from public.stores', 'rows=0');
reset role;

-- (c) allowed user A
set local role authenticated;
select pg_temp.act_as('11111111-1111-1111-1111-111111111111', 'A@RLS.test');
select pg_temp.expect('c1 allowed (mixed-case email) sees store', $q$select * from public.stores where id::text like 'aaaaaaaa%'$q$, 'rows=1');
select pg_temp.expect('c2 insert store created_by=self', $q$insert into public.stores(id, name, created_by) values ('aaaaaaaa-0000-0000-0000-000000000002','s2','11111111-1111-1111-1111-111111111111')$q$, 'ok');
select pg_temp.expect('c3 insert store created_by=other rejected', $q$insert into public.stores(name, created_by) values ('s3','22222222-2222-2222-2222-222222222222')$q$, 'error');
select pg_temp.expect('c4 insert rule', $q$insert into public.delivery_rules(store_id, kind, weekday, created_by) values ('aaaaaaaa-0000-0000-0000-000000000001','weekly',1,'11111111-1111-1111-1111-111111111111')$q$, 'ok');
select pg_temp.expect('c5 insert rule created_by=other rejected', $q$insert into public.delivery_rules(store_id, kind, weekday, created_by) values ('aaaaaaaa-0000-0000-0000-000000000001','weekly',2,'22222222-2222-2222-2222-222222222222')$q$, 'error');
select pg_temp.expect('c6 update rule', $q$update public.delivery_rules set note='n' where store_id='aaaaaaaa-0000-0000-0000-000000000001'$q$, 'ok');
select pg_temp.expect('c7 insert event reported_by=self', $q$insert into public.delivery_events(store_id, date, happened, reported_by) values ('aaaaaaaa-0000-0000-0000-000000000001','2026-10-02',true,'11111111-1111-1111-1111-111111111111')$q$, 'ok');
select pg_temp.expect('c8 insert event reported_by=other rejected', $q$insert into public.delivery_events(store_id, date, happened, reported_by) values ('aaaaaaaa-0000-0000-0000-000000000001','2026-10-03',true,'22222222-2222-2222-2222-222222222222')$q$, 'error');
select pg_temp.expect('c9 update own event', $q$update public.delivery_events set note='x' where date='2026-10-02'$q$, 'ok');
select pg_temp.expect('c10 cannot reassign store created_by', $q$update public.stores set created_by='22222222-2222-2222-2222-222222222222' where id='aaaaaaaa-0000-0000-0000-000000000001'$q$, 'error');
select pg_temp.expect('c11 insert opening_hours', $q$insert into public.opening_hours(store_id, weekday, opens, closes) values ('aaaaaaaa-0000-0000-0000-000000000001',0,'10:00','20:00')$q$, 'ok');
select pg_temp.expect('c12 cannot create profile for another user (no profile exists)', $q$insert into public.profiles(id, display_name) values ('55555555-5555-5555-5555-555555555555','hax')$q$, 'error');
select pg_temp.expect('c13 allowed reads profiles', $q$select * from public.profiles where id::text ~ '^(1|2|3)\1{7}-'$q$, 'rows=3');
reset role;
update public.stores set created_at = created_at - interval '1 day', updated_at = created_at - interval '1 day' where id='aaaaaaaa-0000-0000-0000-000000000001';
update public.stores set name = 'store A2' where id='aaaaaaaa-0000-0000-0000-000000000001';
select pg_temp.expect('c14 updated_at trigger advances', $q$select 1 from public.stores where id='aaaaaaaa-0000-0000-0000-000000000001' and updated_at > created_at + interval '12 hours'$q$, 'rows=1');

-- (d) delete rights
set local role authenticated;
select pg_temp.act_as('22222222-2222-2222-2222-222222222222', 'b@rls.test');
select pg_temp.expect('d1 B sees A store', $q$select * from public.stores where id::text like 'aaaaaaaa%'$q$, 'rows=2');
delete from public.stores where id='aaaaaaaa-0000-0000-0000-000000000001';
select pg_temp.expect('d2 B cannot delete A store (still there)', $q$select 1 from public.stores where id='aaaaaaaa-0000-0000-0000-000000000001'$q$, 'rows=1');
delete from public.delivery_events where date='2026-10-02';
select pg_temp.expect('d3 B cannot delete A event (still there)', $q$select 1 from public.delivery_events where date='2026-10-02'$q$, 'rows=1');
update public.delivery_events set note='hijack' where date='2026-10-02';
select pg_temp.expect('d3b B cannot update A event', $q$select 1 from public.delivery_events where note='hijack'$q$, 'rows=0');
select pg_temp.expect('d4 B can update A store (shared editing)', $q$update public.stores set notes='b was here' where id='aaaaaaaa-0000-0000-0000-000000000001'$q$, 'ok');
select pg_temp.expect('d4b update took effect', $q$select 1 from public.stores where notes='b was here'$q$, 'rows=1');
select pg_temp.act_as('11111111-1111-1111-1111-111111111111', 'a@rls.test');
delete from public.delivery_events where date='2026-10-02';
select pg_temp.expect('d5 A deletes own event', $q$select 1 from public.delivery_events where date='2026-10-02'$q$, 'rows=0');
delete from public.stores where id='aaaaaaaa-0000-0000-0000-000000000001';
select pg_temp.expect('d6 A deletes own store', $q$select 1 from public.stores where id='aaaaaaaa-0000-0000-0000-000000000001'$q$, 'rows=0');
select pg_temp.expect('d7 cascade removed rules', $q$select 1 from public.delivery_rules where store_id='aaaaaaaa-0000-0000-0000-000000000001'$q$, 'rows=0');

-- (e) CHECK constraints (as A, on store 2)
select pg_temp.expect('e1 every_n_weeks without anchor_date', $q$insert into public.delivery_rules(store_id,kind,weekday,interval_weeks,created_by) values ('aaaaaaaa-0000-0000-0000-000000000002','every_n_weeks',1,2,'11111111-1111-1111-1111-111111111111')$q$, 'error');
select pg_temp.expect('e2 every_n_weeks interval 1', $q$insert into public.delivery_rules(store_id,kind,weekday,interval_weeks,anchor_date,created_by) values ('aaaaaaaa-0000-0000-0000-000000000002','every_n_weeks',1,1,'2026-10-06','11111111-1111-1111-1111-111111111111')$q$, 'error');
select pg_temp.expect('e2b every_n_weeks valid', $q$insert into public.delivery_rules(store_id,kind,weekday,interval_weeks,anchor_date,created_by) values ('aaaaaaaa-0000-0000-0000-000000000002','every_n_weeks',1,2,'2026-10-06','11111111-1111-1111-1111-111111111111')$q$, 'ok');
select pg_temp.expect('e3 monthly_nth nth=5', $q$insert into public.delivery_rules(store_id,kind,weekday,nth,created_by) values ('aaaaaaaa-0000-0000-0000-000000000002','monthly_nth',1,5,'11111111-1111-1111-1111-111111111111')$q$, 'error');
select pg_temp.expect('e3b monthly_nth nth=-1 valid', $q$insert into public.delivery_rules(store_id,kind,weekday,nth,created_by) values ('aaaaaaaa-0000-0000-0000-000000000002','monthly_nth',1,-1,'11111111-1111-1111-1111-111111111111')$q$, 'ok');
select pg_temp.expect('e4 irregular with weekday', $q$insert into public.delivery_rules(store_id,kind,weekday,created_by) values ('aaaaaaaa-0000-0000-0000-000000000002','irregular',1,'11111111-1111-1111-1111-111111111111')$q$, 'error');
select pg_temp.expect('e4b irregular valid', $q$insert into public.delivery_rules(store_id,kind,created_by) values ('aaaaaaaa-0000-0000-0000-000000000002','irregular','11111111-1111-1111-1111-111111111111')$q$, 'ok');
select pg_temp.expect('e4c weekly without weekday', $q$insert into public.delivery_rules(store_id,kind,created_by) values ('aaaaaaaa-0000-0000-0000-000000000002','weekly','11111111-1111-1111-1111-111111111111')$q$, 'error');
select pg_temp.expect('e5 opening_hours first row', $q$insert into public.opening_hours(store_id,weekday,is_closed) values ('aaaaaaaa-0000-0000-0000-000000000002',3,true)$q$, 'ok');
select pg_temp.expect('e5b opening_hours duplicate weekday', $q$insert into public.opening_hours(store_id,weekday,is_closed) values ('aaaaaaaa-0000-0000-0000-000000000002',3,true)$q$, 'error');
select pg_temp.expect('e5c opening_hours closed with times', $q$insert into public.opening_hours(store_id,weekday,opens,closes,is_closed) values ('aaaaaaaa-0000-0000-0000-000000000002',4,'10:00','20:00',true)$q$, 'error');
select pg_temp.expect('e5d opening_hours open without times', $q$insert into public.opening_hours(store_id,weekday) values ('aaaaaaaa-0000-0000-0000-000000000002',5)$q$, 'error');
select pg_temp.expect('e5e weekday 7 rejected', $q$insert into public.opening_hours(store_id,weekday,is_closed) values ('aaaaaaaa-0000-0000-0000-000000000002',7,true)$q$, 'error');
select pg_temp.expect('e6 event first row', $q$insert into public.delivery_events(store_id,date,happened,reported_by) values ('aaaaaaaa-0000-0000-0000-000000000002','2026-10-05',true,'11111111-1111-1111-1111-111111111111')$q$, 'ok');
select pg_temp.expect('e6b event duplicate (store,date,reporter)', $q$insert into public.delivery_events(store_id,date,happened,reported_by) values ('aaaaaaaa-0000-0000-0000-000000000002','2026-10-05',false,'11111111-1111-1111-1111-111111111111')$q$, 'error');

-- (f) allowed_emails closed to clients
select pg_temp.expect('f1 allowed user cannot select allowed_emails', 'select * from public.allowed_emails', 'error');
select pg_temp.expect('f2 allowed user cannot insert allowed_emails', $q$insert into public.allowed_emails(email) values ('evil@x.test')$q$, 'error');
reset role;
set local role anon;
select pg_temp.act_as(null, null);
select pg_temp.expect('f3 anon cannot select allowed_emails', 'select * from public.allowed_emails', 'error');
select pg_temp.expect('f4 anon cannot call is_allowed', 'select public.is_allowed()', 'error');
reset role;

-- final verdict
do $$
declare bad int; total int;
begin
  select count(*) filter (where not ok), count(*) into bad, total from _res;
  raise notice '% checks, % failed', total, bad;
  if bad > 0 then raise exception 'RLS TESTS FAILED: % of %', bad, total; end if;
end $$;
rollback;
