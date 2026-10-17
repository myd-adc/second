-- Local dev / e2e seed. Runs after migrations (supabase db reset).
insert into public.allowed_emails (email) values ('test@example.com')
  on conflict do nothing;

-- Minimal seed auth user; the on_auth_user_created trigger creates its profile.
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'test@example.com', now(), now())
  on conflict (id) do nothing;

insert into public.stores (id, name, address, lat, lng, notes, created_by) values
  ('00000000-0000-0000-0000-0000000000b1', 'Секонд Центр', 'вул. Хрещатик, 1, Київ', 50.4472, 30.5227,
   'дорогий, але буває вінтаж', '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000b2', 'Сток Лівобережна', 'бул. Перова, 10, Київ', 50.4517, 30.6021,
   null, '00000000-0000-0000-0000-0000000000a1')
  on conflict (id) do nothing;

insert into public.opening_hours (store_id, weekday, opens, closes, is_closed)
select s.id, d, case when d = 6 then null else time '10:00' end,
       case when d = 6 then null else time '20:00' end, d = 6
from (values ('00000000-0000-0000-0000-0000000000b1'::uuid),
             ('00000000-0000-0000-0000-0000000000b2'::uuid)) s(id), generate_series(0, 6) d
on conflict do nothing;

insert into public.delivery_rules (store_id, kind, weekday, interval_weeks, anchor_date, nth, time_of_day, note, created_by)
select * from (values
  ('00000000-0000-0000-0000-0000000000b1'::uuid, 'weekly'::public.rule_kind, 1::smallint, null::smallint, null::date, null::smallint, time '09:00', 'завозять зранку', '00000000-0000-0000-0000-0000000000a1'::uuid),
  ('00000000-0000-0000-0000-0000000000b1'::uuid, 'weekly'::public.rule_kind, 4::smallint, null::smallint, null::date, null::smallint, null::time, null::text, '00000000-0000-0000-0000-0000000000a1'::uuid),
  ('00000000-0000-0000-0000-0000000000b2'::uuid, 'every_n_weeks'::public.rule_kind, 2::smallint, 2::smallint, date '2026-10-06', null::smallint, null::time, null::text, '00000000-0000-0000-0000-0000000000a1'::uuid)
) v(store_id, kind, weekday, interval_weeks, anchor_date, nth, time_of_day, note, created_by)
where not exists (select 1 from public.delivery_rules);
