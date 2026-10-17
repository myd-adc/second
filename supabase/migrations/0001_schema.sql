-- Schema for second-hand tracker (spec section 3). Weekday: 0 = Monday.
create type public.rule_kind as enum ('weekly', 'every_n_weeks', 'monthly_nth', 'irregular');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now()
);

create table public.allowed_emails (
  email text primary key,
  added_at timestamptz not null default now(),
  constraint allowed_emails_lowercase check (email = lower(email))
);

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  lat double precision,
  lng double precision,
  notes text,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.opening_hours (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  opens time,
  closes time,
  is_closed boolean not null default false,
  constraint opening_hours_store_weekday_key unique (store_id, weekday),
  constraint opening_hours_times_check check (
    (is_closed and opens is null and closes is null)
    or (not is_closed and opens is not null and closes is not null)
  )
);

create table public.delivery_rules (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  kind public.rule_kind not null,
  weekday smallint check (weekday between 0 and 6),
  interval_weeks smallint,
  anchor_date date,
  nth smallint,
  time_of_day time,
  note text,
  is_active boolean not null default true,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  constraint delivery_rules_kind_check check (
    case kind
      when 'weekly' then weekday is not null
      when 'every_n_weeks' then weekday is not null
        and interval_weeks is not null and interval_weeks >= 2
        and anchor_date is not null
      when 'monthly_nth' then weekday is not null
        and nth is not null and nth in (1, 2, 3, 4, -1)
      when 'irregular' then weekday is null
    end
  ),
  -- fields belonging to other kinds must stay empty
  constraint delivery_rules_unused_fields_check check (
    (kind = 'every_n_weeks' or (interval_weeks is null and anchor_date is null))
    and (kind = 'monthly_nth' or nth is null)
  )
);

create table public.delivery_events (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  date date not null,
  happened boolean not null,
  reported_by uuid not null default auth.uid() references public.profiles (id),
  note text,
  created_at timestamptz not null default now(),
  constraint delivery_events_store_date_reporter_key unique (store_id, date, reported_by)
);

-- FK / lookup indexes (opening_hours is covered by its unique constraint)
create index delivery_rules_store_id_idx on public.delivery_rules (store_id);
create index delivery_events_store_date_idx on public.delivery_events (store_id, date);
create index stores_created_by_idx on public.stores (created_by);
create index delivery_rules_created_by_idx on public.delivery_rules (created_by);
create index delivery_events_reported_by_idx on public.delivery_events (reported_by);

-- stores.updated_at
create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger stores_set_updated_at before update on public.stores
  for each row execute function public.set_updated_at();

-- ownership columns are immutable
create function public.forbid_owner_change() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_table_name = 'delivery_events' then
    if new.reported_by is distinct from old.reported_by then
      raise exception 'reported_by is immutable';
    end if;
  elsif new.created_by is distinct from old.created_by then
    raise exception 'created_by is immutable';
  end if;
  return new;
end $$;

create trigger stores_owner_immutable before update on public.stores
  for each row execute function public.forbid_owner_change();
create trigger delivery_rules_owner_immutable before update on public.delivery_rules
  for each row execute function public.forbid_owner_change();
create trigger delivery_events_owner_immutable before update on public.delivery_events
  for each row execute function public.forbid_owner_change();

-- profile on signup
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(split_part(coalesce(new.email, ''), '@', 1), ''), 'user'))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- access check
create function public.is_allowed() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(
    exists (
      select 1 from public.allowed_emails
      where email = lower(auth.jwt() ->> 'email')
    ), false)
$$;
revoke execute on function public.is_allowed() from public, anon;
grant execute on function public.is_allowed() to authenticated;
