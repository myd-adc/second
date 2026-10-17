-- save_store RPC checks. Run: psql -v ON_ERROR_STOP=1 -f supabase/tests/save_store.sql
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


create temp table _ctx (k text primary key, v text);
grant all on _ctx to anon, authenticated;

insert into _ctx select 'base', count(*)::text from public.stores;  -- pre-existing (seed) stores

-- (a) anon / non-allowed cannot call it
set local role anon;
select pg_temp.act_as(null, null);
select pg_temp.expect('a1 anon cannot call save_store', $q$select public.save_store('{"name":"x"}'::jsonb)$q$, 'error');
reset role;
set local role authenticated;
select pg_temp.act_as('33333333-3333-3333-3333-333333333333', 'x@rls.test');
select pg_temp.expect('a2 non-allowed cannot call save_store', $q$select public.save_store('{"name":"x"}'::jsonb)$q$, 'error');
reset role;
select pg_temp.expect('a3 nothing was created', $q$select 1 from public.stores where name = 'x'$q$, 'rows=0');

-- (b) allowed user A creates a store
set local role authenticated;
select pg_temp.act_as('11111111-1111-1111-1111-111111111111', 'a@rls.test');
select pg_temp.expect('b1 create store with hours + 2 rules',
  $q$insert into _ctx select 'sid', public.save_store($p${
    "name":"Shop 1","address":"addr","lat":50.4,"lng":30.5,"notes":"n",
    "hours":[{"weekday":0,"opens":"10:00","closes":"20:00","is_closed":false},
             {"weekday":6,"opens":null,"closes":null,"is_closed":true}],
    "rules":[{"kind":"weekly","weekday":2,"interval_weeks":7,"anchor_date":"2026-01-01","nth":3,"time_of_day":"09:30","note":"old","is_active":true},
             {"kind":"irregular","is_active":true}]}$p$::jsonb)::text$q$, 'ok');
select pg_temp.expect('b2 store exists, created_by=A',
  $q$select 1 from public.stores s, _ctx c where c.k='sid' and s.id = c.v::uuid and s.created_by='11111111-1111-1111-1111-111111111111' and s.name='Shop 1' and s.lat=50.4$q$, 'rows=1');
select pg_temp.expect('b3 2 hours rows', $q$select 1 from public.opening_hours h, _ctx c where c.k='sid' and h.store_id=c.v::uuid$q$, 'rows=2');
select pg_temp.expect('b4 2 rule rows', $q$select 1 from public.delivery_rules r, _ctx c where c.k='sid' and r.store_id=c.v::uuid$q$, 'rows=2');
select pg_temp.expect('b5 weekly rule has unused fields NULLed',
  $q$select 1 from public.delivery_rules r, _ctx c where c.k='sid' and r.store_id=c.v::uuid and kind='weekly' and weekday=2 and interval_weeks is null and anchor_date is null and nth is null and time_of_day='09:30' and note='old'$q$, 'rows=1');
select pg_temp.expect('b6 rule created_by = A',
  $q$select 1 from public.delivery_rules r, _ctx c where c.k='sid' and r.store_id=c.v::uuid and created_by='11111111-1111-1111-1111-111111111111'$q$, 'rows=2');
reset role;

-- (c) B updates (replace) the store: hours/rules replaced, created_by kept
set local role authenticated;
select pg_temp.act_as('22222222-2222-2222-2222-222222222222', 'b@rls.test');
select pg_temp.expect('c1 update by id replaces children',
  $q$select public.save_store(('{"id":"' || (select v from _ctx where k='sid') || '","name":"Shop 1b","address":null,
    "hours":[{"weekday":1,"opens":"08:00","closes":"22:00","is_closed":false}],
    "rules":[{"kind":"monthly_nth","weekday":4,"nth":-1,"is_active":false}]}')::jsonb)$q$, 'ok');
select pg_temp.expect('c2 same store row, renamed, address nulled, created_by still A',
  $q$select 1 from public.stores s, _ctx c where c.k='sid' and s.id=c.v::uuid and s.name='Shop 1b' and s.address is null and s.created_by='11111111-1111-1111-1111-111111111111'$q$, 'rows=1');
select pg_temp.expect('c3 update created no extra store', $q$select 1 from public.stores having count(*) = (select v::int from _ctx where k='base') + 1$q$, 'rows=1');
select pg_temp.expect('c4 old hours gone, new present',
  $q$select 1 from public.opening_hours h, _ctx c where c.k='sid' and h.store_id=c.v::uuid and h.weekday=1 and h.opens='08:00'$q$, 'rows=1');
select pg_temp.expect('c5 only 1 hours row', $q$select 1 from public.opening_hours h, _ctx c where c.k='sid' and h.store_id=c.v::uuid$q$, 'rows=1');
select pg_temp.expect('c6 old rules gone, only monthly_nth rule',
  $q$select 1 from public.delivery_rules r, _ctx c where c.k='sid' and r.store_id=c.v::uuid and kind='monthly_nth' and nth=-1 and not is_active$q$, 'rows=1');
select pg_temp.expect('c7 only 1 rule row', $q$select 1 from public.delivery_rules r, _ctx c where c.k='sid' and r.store_id=c.v::uuid$q$, 'rows=1');
select pg_temp.expect('c8 update of unknown id raises',
  $q$select public.save_store('{"id":"deadbeef-0000-0000-0000-000000000000","name":"x"}'::jsonb)$q$, 'error');
reset role;

-- (d) kind change weekly -> every_n_weeks and back, stale fields NULLed
set local role authenticated;
select pg_temp.act_as('11111111-1111-1111-1111-111111111111', 'a@rls.test');
select pg_temp.expect('d1 weekly rule saved',
  $q$select public.save_store(('{"id":"' || (select v from _ctx where k='sid') || '","name":"S",
    "rules":[{"kind":"weekly","weekday":3,"is_active":true}]}')::jsonb)$q$, 'ok');
select pg_temp.expect('d2 weekly -> every_n_weeks works',
  $q$select public.save_store(('{"id":"' || (select v from _ctx where k='sid') || '","name":"S",
    "rules":[{"kind":"every_n_weeks","weekday":3,"interval_weeks":2,"anchor_date":"2026-10-07","nth":2,"is_active":true}]}')::jsonb)$q$, 'ok');
select pg_temp.expect('d3 every_n_weeks row has interval+anchor, nth NULL',
  $q$select 1 from public.delivery_rules r, _ctx c where c.k='sid' and r.store_id=c.v::uuid and kind='every_n_weeks' and interval_weeks=2 and anchor_date='2026-10-07' and nth is null$q$, 'rows=1');
select pg_temp.expect('d4 every_n_weeks -> weekly NULLs interval/anchor',
  $q$select public.save_store(('{"id":"' || (select v from _ctx where k='sid') || '","name":"S",
    "rules":[{"kind":"weekly","weekday":3,"interval_weeks":2,"anchor_date":"2026-10-07","is_active":true}]}')::jsonb)$q$, 'ok');
select pg_temp.expect('d5 weekly row clean',
  $q$select 1 from public.delivery_rules r, _ctx c where c.k='sid' and r.store_id=c.v::uuid and kind='weekly' and interval_weeks is null and anchor_date is null$q$, 'rows=1');

-- (e) atomicity: invalid rule -> error, previous rows intact
select pg_temp.expect('e1 invalid rule (every_n_weeks w/o anchor_date) raises',
  $q$select public.save_store(('{"id":"' || (select v from _ctx where k='sid') || '","name":"CHANGED",
    "hours":[{"weekday":5,"opens":"01:00","closes":"02:00","is_closed":false}],
    "rules":[{"kind":"weekly","weekday":0,"is_active":true},
             {"kind":"every_n_weeks","weekday":3,"interval_weeks":2,"is_active":true}]}')::jsonb)$q$, 'error');
select pg_temp.expect('e2 store name unchanged',
  $q$select 1 from public.stores s, _ctx c where c.k='sid' and s.id=c.v::uuid and s.name='S'$q$, 'rows=1');
select pg_temp.expect('e3 previous rule intact (weekly weekday 3 only)',
  $q$select 1 from public.delivery_rules r, _ctx c where c.k='sid' and r.store_id=c.v::uuid and kind='weekly' and weekday=3$q$, 'rows=1');
select pg_temp.expect('e4 rule count still 1', $q$select 1 from public.delivery_rules r, _ctx c where c.k='sid' and r.store_id=c.v::uuid$q$, 'rows=1');
select pg_temp.expect('e5 hours: d* saves had none; failed call inserted none (rolled back)',
  $q$select 1 from public.opening_hours h, _ctx c where c.k='sid' and h.store_id=c.v::uuid$q$, 'rows=0');
select pg_temp.expect('e6 failed CREATE leaves no new store',
  $q$select public.save_store('{"name":"ghost","rules":[{"kind":"weekly"}]}'::jsonb)$q$, 'error');
select pg_temp.expect('e7 store count unchanged', $q$select 1 from public.stores having count(*) = (select v::int from _ctx where k='base') + 1$q$, 'rows=1');
reset role;

-- (f) re-check closed doors after data exists
set local role anon;
select pg_temp.act_as(null, null);
select pg_temp.expect('f1 anon cannot update existing store via save_store',
  $q$select public.save_store(('{"id":"' || (select v from _ctx where k='sid') || '","name":"hacked"}')::jsonb)$q$, 'error');
reset role;
set local role authenticated;
select pg_temp.act_as('33333333-3333-3333-3333-333333333333', 'x@rls.test');
select pg_temp.expect('f2 non-allowed cannot update existing store',
  $q$select public.save_store(('{"id":"' || (select v from _ctx where k='sid') || '","name":"hacked"}')::jsonb)$q$, 'error');
reset role;
select pg_temp.expect('f3 store untouched', $q$select 1 from public.stores where name='S'$q$, 'rows=1');
select pg_temp.expect('f4 rules untouched', $q$select 1 from public.delivery_rules r, _ctx c where c.k='sid' and r.store_id=c.v::uuid$q$, 'rows=1');

-- final verdict
do $$
declare bad int; total int;
begin
  select count(*) filter (where not ok), count(*) into bad, total from _res;
  raise notice '% checks, % failed', total, bad;
  if bad > 0 then raise exception 'SAVE_STORE TESTS FAILED: % of %', bad, total; end if;
end $$;
rollback;
