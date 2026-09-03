-- ROLES
create type public.app_role as enum ('USER','ORGANIZER');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "profiles_select_own" on public.profiles for select to authenticated using (id = auth.uid());
create policy "profiles_update_own" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "user_roles_select_own" on public.user_roles for select to authenticated using (user_id = auth.uid());

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''), coalesce(new.email,''))
  on conflict (id) do nothing;
  insert into public.user_roles (user_id, role)
  values (new.id, case when coalesce(new.raw_user_meta_data->>'role','USER') = 'ORGANIZER'
                       then 'ORGANIZER'::public.app_role else 'USER'::public.app_role end)
  on conflict do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- VENUES
create table public.venues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null default '',
  city text not null default '',
  created_at timestamptz not null default now()
);
grant select on public.venues to anon, authenticated;
grant insert, update, delete on public.venues to authenticated;
grant all on public.venues to service_role;
alter table public.venues enable row level security;
create policy "venues_public_read" on public.venues for select using (true);
create policy "venues_organizer_write" on public.venues for insert to authenticated with check (public.has_role(auth.uid(),'ORGANIZER'));

-- EVENTS
create table public.events (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references auth.users(id) on delete cascade,
  venue_id uuid references public.venues(id) on delete set null,
  title text not null,
  description text not null default '',
  category text not null default 'General',
  image_url text,
  starts_at timestamptz not null,
  price_cents integer not null default 0 check (price_cents >= 0),
  seat_rows integer not null default 5 check (seat_rows between 1 and 26),
  seat_cols integer not null default 8 check (seat_cols between 1 and 30),
  status text not null default 'PUBLISHED' check (status in ('DRAFT','PUBLISHED','CANCELLED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index events_organizer_idx on public.events(organizer_id);
create index events_starts_at_idx on public.events(starts_at);
grant select on public.events to anon, authenticated;
grant insert, update, delete on public.events to authenticated;
grant all on public.events to service_role;
alter table public.events enable row level security;
create policy "events_public_read" on public.events for select using (status = 'PUBLISHED' or organizer_id = auth.uid());
create policy "events_organizer_insert" on public.events for insert to authenticated with check (organizer_id = auth.uid() and public.has_role(auth.uid(),'ORGANIZER'));
create policy "events_organizer_update" on public.events for update to authenticated using (organizer_id = auth.uid()) with check (organizer_id = auth.uid());
create policy "events_organizer_delete" on public.events for delete to authenticated using (organizer_id = auth.uid());

-- SEATS
create table public.seats (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  label text not null,
  row_label text not null,
  col_number integer not null,
  price_cents integer not null default 0,
  unique (event_id, label)
);
create index seats_event_idx on public.seats(event_id);
grant select on public.seats to anon, authenticated;
grant all on public.seats to service_role;
alter table public.seats enable row level security;
create policy "seats_public_read" on public.seats for select using (true);

-- SEAT LOCKS
create table public.seat_locks (
  id uuid primary key default gen_random_uuid(),
  seat_id uuid not null unique references public.seats(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index seat_locks_event_idx on public.seat_locks(event_id);
create index seat_locks_expires_idx on public.seat_locks(expires_at);
grant select on public.seat_locks to anon, authenticated;
grant all on public.seat_locks to service_role;
alter table public.seat_locks enable row level security;
create policy "seat_locks_public_read" on public.seat_locks for select using (true);

-- BOOKINGS
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  status text not null default 'PENDING' check (status in ('PENDING','CONFIRMED','CANCELLED','FAILED')),
  total_cents integer not null default 0,
  created_at timestamptz not null default now()
);
create index bookings_user_idx on public.bookings(user_id);
create index bookings_event_idx on public.bookings(event_id);
grant select, insert, update on public.bookings to authenticated;
grant all on public.bookings to service_role;
alter table public.bookings enable row level security;
create policy "bookings_select_own_or_organizer" on public.bookings for select to authenticated
  using (user_id = auth.uid() or exists (select 1 from public.events e where e.id = event_id and e.organizer_id = auth.uid()));
create policy "bookings_update_own" on public.bookings for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.booking_items (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  seat_id uuid not null references public.seats(id) on delete cascade,
  price_cents integer not null default 0,
  active boolean not null default true
);
-- THE critical constraint: a seat can appear in at most one ACTIVE booking
create unique index booking_items_one_active_per_seat on public.booking_items(seat_id) where active;
create index booking_items_booking_idx on public.booking_items(booking_id);
grant select on public.booking_items to authenticated;
grant all on public.booking_items to service_role;
alter table public.booking_items enable row level security;
create policy "booking_items_select_related" on public.booking_items for select to authenticated
  using (exists (select 1 from public.bookings b where b.id = booking_id
                 and (b.user_id = auth.uid() or exists (select 1 from public.events e where e.id = b.event_id and e.organizer_id = auth.uid()))));

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  provider text not null default 'razorpay',
  order_id text,
  payment_id text unique,
  amount_cents integer not null default 0,
  status text not null default 'CREATED' check (status in ('CREATED','PAID','FAILED','CANCELLED','REFUNDED')),
  created_at timestamptz not null default now()
);
create index payments_booking_idx on public.payments(booking_id);
grant select on public.payments to authenticated;
grant all on public.payments to service_role;
alter table public.payments enable row level security;
create policy "payments_select_own" on public.payments for select to authenticated
  using (exists (select 1 from public.bookings b where b.id = booking_id and b.user_id = auth.uid()));

create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  booking_item_id uuid not null unique references public.booking_items(id) on delete cascade,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  ticket_code text not null unique,
  issued_at timestamptz not null default now()
);
grant select on public.tickets to authenticated;
grant all on public.tickets to service_role;
alter table public.tickets enable row level security;
create policy "tickets_select_related" on public.tickets for select to authenticated
  using (exists (select 1 from public.bookings b where b.id = booking_id
                 and (b.user_id = auth.uid() or exists (select 1 from public.events e where e.id = b.event_id and e.organizer_id = auth.uid()))));

-- SEAT GENERATION on event insert / layout change
create or replace function public.generate_seats_for_event(_event_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare e record; r integer; c integer;
begin
  select * into e from public.events where id = _event_id;
  if e is null then return; end if;
  for r in 1..e.seat_rows loop
    for c in 1..e.seat_cols loop
      insert into public.seats (event_id, label, row_label, col_number, price_cents)
      values (_event_id, chr(64 + r) || c::text, chr(64 + r), c, e.price_cents)
      on conflict (event_id, label) do update set price_cents = excluded.price_cents;
    end loop;
  end loop;
end;
$$;

create or replace function public.events_after_write()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.generate_seats_for_event(new.id);
  return new;
end;
$$;
create trigger events_seed_seats after insert on public.events
for each row execute function public.events_after_write();

create or replace function public.events_touch()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;
create trigger events_set_updated before update on public.events
for each row execute function public.events_touch();

-- SEAT LOCKING (10 min TTL)
create or replace function public.lock_seats(_event_id uuid, _seat_ids uuid[])
returns table (seat_id uuid, locked boolean, reason text)
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); sid uuid;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  delete from public.seat_locks where expires_at < now();
  foreach sid in array _seat_ids loop
    if exists (select 1 from public.booking_items bi where bi.seat_id = sid and bi.active) then
      seat_id := sid; locked := false; reason := 'BOOKED'; return next; continue;
    end if;
    begin
      insert into public.seat_locks (seat_id, event_id, user_id, expires_at)
      values (sid, _event_id, uid, now() + interval '10 minutes')
      on conflict (seat_id) do update
        set user_id = excluded.user_id, expires_at = excluded.expires_at
        where public.seat_locks.user_id = uid;
      if not found then
        seat_id := sid; locked := false; reason := 'LOCKED'; return next; continue;
      end if;
      seat_id := sid; locked := true; reason := 'OK'; return next;
    exception when unique_violation then
      seat_id := sid; locked := false; reason := 'LOCKED'; return next;
    end;
  end loop;
end;
$$;
grant execute on function public.lock_seats(uuid, uuid[]) to authenticated;

create or replace function public.release_seats(_seat_ids uuid[])
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.seat_locks where seat_id = any(_seat_ids) and user_id = auth.uid();
end;
$$;
grant execute on function public.release_seats(uuid[]) to authenticated;

-- CONFIRM BOOKING: atomic, idempotent on payment_id
create or replace function public.confirm_booking(
  _event_id uuid, _seat_ids uuid[], _order_id text, _payment_id text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  bid uuid;
  total integer := 0;
  s record;
  item_id uuid;
  existing uuid;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if _seat_ids is null or array_length(_seat_ids,1) is null then raise exception 'No seats selected'; end if;

  -- idempotency: same payment id must not create a second booking
  if _payment_id is not null then
    select booking_id into existing from public.payments where payment_id = _payment_id;
    if existing is not null then return existing; end if;
  end if;

  delete from public.seat_locks where expires_at < now();

  -- every seat must be held by this user
  if exists (
    select 1 from unnest(_seat_ids) sid
    where not exists (select 1 from public.seat_locks l where l.seat_id = sid and l.user_id = uid and l.expires_at > now())
  ) then
    raise exception 'SEAT_LOCK_EXPIRED';
  end if;

  insert into public.bookings (user_id, event_id, status, total_cents)
  values (uid, _event_id, 'CONFIRMED', 0) returning id into bid;

  for s in select * from public.seats where id = any(_seat_ids) order by label loop
    -- unique partial index raises here if another transaction won the seat
    insert into public.booking_items (booking_id, seat_id, price_cents, active)
    values (bid, s.id, s.price_cents, true) returning id into item_id;
    total := total + s.price_cents;
    insert into public.tickets (booking_item_id, booking_id, ticket_code)
    values (item_id, bid, encode(gen_random_bytes(12),'hex'));
  end loop;

  update public.bookings set total_cents = total where id = bid;
  insert into public.payments (booking_id, provider, order_id, payment_id, amount_cents, status)
  values (bid, 'razorpay', _order_id, _payment_id, total, case when _payment_id is null then 'CREATED' else 'PAID' end);

  delete from public.seat_locks where seat_id = any(_seat_ids);
  return bid;
exception when unique_violation then
  raise exception 'SEAT_ALREADY_BOOKED';
end;
$$;
grant execute on function public.confirm_booking(uuid, uuid[], text, text) to authenticated;

-- CANCEL BOOKING: frees seats
create or replace function public.cancel_booking(_booking_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare b record;
begin
  select * into b from public.bookings where id = _booking_id;
  if b is null then raise exception 'Booking not found'; end if;
  if b.user_id <> auth.uid() then raise exception 'Forbidden'; end if;
  if b.status <> 'CONFIRMED' then raise exception 'Booking is not cancellable'; end if;
  if (select starts_at from public.events where id = b.event_id) < now() + interval '24 hours' then
    raise exception 'CANCELLATION_WINDOW_CLOSED';
  end if;
  update public.bookings set status = 'CANCELLED' where id = _booking_id;
  update public.booking_items set active = false where booking_id = _booking_id;
  update public.payments set status = 'REFUNDED' where booking_id = _booking_id;
end;
$$;
grant execute on function public.cancel_booking(uuid) to authenticated;