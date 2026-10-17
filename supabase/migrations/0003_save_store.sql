-- save_store(payload): create/update a store and replace its opening hours and delivery rules
-- in one transaction (the function call). SECURITY INVOKER: RLS applies to every statement.
-- payload = {
--   id?, name, address?, lat?, lng?, notes?,
--   hours: [{weekday, opens, closes, is_closed}],
--   rules: [{kind, weekday, interval_weeks, anchor_date, nth, time_of_day, note, is_active}]
-- }
-- Nothing is validated here beyond the table constraints; their violations propagate.
create function public.save_store(payload jsonb) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  sid uuid;
  h jsonb;
  r jsonb;
  k public.rule_kind;
begin
  if payload ->> 'id' is not null then
    sid := (payload ->> 'id')::uuid;
    update public.stores set
      name = payload ->> 'name',
      address = payload ->> 'address',
      lat = (payload ->> 'lat')::double precision,
      lng = (payload ->> 'lng')::double precision,
      notes = payload ->> 'notes'
    where id = sid;
    if not found then
      raise exception 'store % not found or not allowed', sid;
    end if;
  else
    insert into public.stores (name, address, lat, lng, notes)
    values (payload ->> 'name', payload ->> 'address',
            (payload ->> 'lat')::double precision, (payload ->> 'lng')::double precision,
            payload ->> 'notes')
    returning id into sid;
  end if;

  delete from public.opening_hours where store_id = sid;
  for h in select * from jsonb_array_elements(coalesce(payload -> 'hours', '[]'::jsonb)) loop
    insert into public.opening_hours (store_id, weekday, opens, closes, is_closed)
    values (sid, (h ->> 'weekday')::smallint, (h ->> 'opens')::time, (h ->> 'closes')::time,
            coalesce((h ->> 'is_closed')::boolean, false));
  end loop;

  delete from public.delivery_rules where store_id = sid;
  for r in select * from jsonb_array_elements(coalesce(payload -> 'rules', '[]'::jsonb)) loop
    k := (r ->> 'kind')::public.rule_kind;
    insert into public.delivery_rules
      (store_id, kind, weekday, interval_weeks, anchor_date, nth, time_of_day, note, is_active)
    values (
      sid, k,
      (r ->> 'weekday')::smallint,
      case when k = 'every_n_weeks' then (r ->> 'interval_weeks')::smallint end,
      case when k = 'every_n_weeks' then (r ->> 'anchor_date')::date end,
      case when k = 'monthly_nth' then (r ->> 'nth')::smallint end,
      (r ->> 'time_of_day')::time,
      r ->> 'note',
      coalesce((r ->> 'is_active')::boolean, true));
  end loop;

  return sid;
end $$;
revoke execute on function public.save_store(jsonb) from public, anon;
grant execute on function public.save_store(jsonb) to authenticated;
