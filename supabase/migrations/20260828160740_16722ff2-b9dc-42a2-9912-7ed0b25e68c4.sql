CREATE OR REPLACE FUNCTION public.confirm_booking(_event_id uuid, _seat_ids uuid[], _order_id text, _payment_id text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  if _payment_id is not null then
    select booking_id into existing from public.payments where payment_id = _payment_id;
    if existing is not null then return existing; end if;
  end if;

  delete from public.seat_locks where expires_at < now();

  if exists (
    select 1 from unnest(_seat_ids) sid
    where not exists (select 1 from public.seat_locks l where l.seat_id = sid and l.user_id = uid and l.expires_at > now())
  ) then
    raise exception 'SEAT_LOCK_EXPIRED';
  end if;

  insert into public.bookings (user_id, event_id, status, total_cents)
  values (uid, _event_id, 'CONFIRMED', 0) returning id into bid;

  for s in select * from public.seats where id = any(_seat_ids) order by label loop
    insert into public.booking_items (booking_id, seat_id, price_cents, active)
    values (bid, s.id, s.price_cents, true) returning id into item_id;
    total := total + s.price_cents;
    insert into public.tickets (booking_item_id, booking_id, ticket_code)
    values (
      item_id,
      bid,
      upper(replace(gen_random_uuid()::text, '-', '')) || upper(substr(md5(clock_timestamp()::text || item_id::text), 1, 8))
    );
  end loop;

  update public.bookings set total_cents = total where id = bid;
  insert into public.payments (booking_id, provider, order_id, payment_id, amount_cents, status)
  values (bid, 'razorpay', _order_id, _payment_id, total, case when _payment_id is null then 'CREATED' else 'PAID' end);

  delete from public.seat_locks where seat_id = any(_seat_ids);
  return bid;
exception when unique_violation then
  raise exception 'SEAT_ALREADY_BOOKED';
end;
$function$;

REVOKE ALL ON FUNCTION public.confirm_booking(uuid, uuid[], text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.confirm_booking(uuid, uuid[], text, text) TO authenticated, service_role;