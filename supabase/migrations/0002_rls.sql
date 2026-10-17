alter table public.profiles enable row level security;
alter table public.allowed_emails enable row level security;
alter table public.stores enable row level security;
alter table public.opening_hours enable row level security;
alter table public.delivery_rules enable row level security;
alter table public.delivery_events enable row level security;

-- allowed_emails: no policies for clients; also drop table privileges (defense in depth)
revoke all on public.allowed_emails from anon, authenticated;

-- profiles
create policy profiles_select on public.profiles for select to authenticated
  using (public.is_allowed());
create policy profiles_insert on public.profiles for insert to authenticated
  with check (id = auth.uid());
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- stores
create policy stores_select on public.stores for select to authenticated
  using (public.is_allowed());
create policy stores_insert on public.stores for insert to authenticated
  with check (public.is_allowed() and created_by = auth.uid());
create policy stores_update on public.stores for update to authenticated
  using (public.is_allowed()) with check (public.is_allowed());
create policy stores_delete on public.stores for delete to authenticated
  using (created_by = auth.uid() and public.is_allowed());

-- opening_hours
create policy opening_hours_select on public.opening_hours for select to authenticated
  using (public.is_allowed());
create policy opening_hours_insert on public.opening_hours for insert to authenticated
  with check (public.is_allowed());
create policy opening_hours_update on public.opening_hours for update to authenticated
  using (public.is_allowed()) with check (public.is_allowed());
create policy opening_hours_delete on public.opening_hours for delete to authenticated
  using (public.is_allowed());

-- delivery_rules
create policy delivery_rules_select on public.delivery_rules for select to authenticated
  using (public.is_allowed());
create policy delivery_rules_insert on public.delivery_rules for insert to authenticated
  with check (public.is_allowed() and created_by = auth.uid());
create policy delivery_rules_update on public.delivery_rules for update to authenticated
  using (public.is_allowed()) with check (public.is_allowed());
create policy delivery_rules_delete on public.delivery_rules for delete to authenticated
  using (public.is_allowed());

-- delivery_events
create policy delivery_events_select on public.delivery_events for select to authenticated
  using (public.is_allowed());
create policy delivery_events_insert on public.delivery_events for insert to authenticated
  with check (public.is_allowed() and reported_by = auth.uid());
-- stricter than a plain is_allowed(): a report may only be corrected by its author
create policy delivery_events_update on public.delivery_events for update to authenticated
  using (reported_by = auth.uid() and public.is_allowed())
  with check (reported_by = auth.uid() and public.is_allowed());
create policy delivery_events_delete on public.delivery_events for delete to authenticated
  using (reported_by = auth.uid() and public.is_allowed());
