create or replace function public.lock_seats(_event_id uuid, _seat_ids uuid[])
returns table(seat_id uuid, locked boolean, reason text)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare uid uuid := auth.uid(); sid uuid; updated integer;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  delete from public.seat_locks l where l.expires_at < now();
  foreach sid in array _seat_ids loop
    if exists (select 1 from public.booking_items bi where bi.seat_id = sid and bi.active) then
      lock_seats.seat_id := sid; lock_seats.locked := false; lock_seats.reason := 'BOOKED'; return next; continue;
    end if;
    begin
      insert into public.seat_locks as sl (seat_id, event_id, user_id, expires_at)
      values (sid, _event_id, uid, now() + interval '10 minutes')
      on conflict (seat_id) do update
        set user_id = excluded.user_id, expires_at = excluded.expires_at
        where sl.user_id = uid;
      get diagnostics updated = row_count;
      if updated = 0 then
        lock_seats.seat_id := sid; lock_seats.locked := false; lock_seats.reason := 'LOCKED'; return next; continue;
      end if;
      lock_seats.seat_id := sid; lock_seats.locked := true; lock_seats.reason := 'OK'; return next;
    exception when unique_violation then
      lock_seats.seat_id := sid; lock_seats.locked := false; lock_seats.reason := 'LOCKED'; return next;
    end;
  end loop;
end;
$function$;