create or replace function public.lock_seats(_event_id uuid, _seat_ids uuid[])
returns table(seat_id uuid, locked boolean, reason text)
language plpgsql
security definer
set search_path to 'public'
as $function$
#variable_conflict use_column
declare
  uid uuid := auth.uid();
  sid uuid;
  updated integer;
  out_seat uuid;
  out_locked boolean;
  out_reason text;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  delete from public.seat_locks l where l.expires_at < now();
  foreach sid in array _seat_ids loop
    out_seat := sid;
    if exists (select 1 from public.booking_items bi where bi.seat_id = sid and bi.active) then
      out_locked := false; out_reason := 'BOOKED';
    else
      begin
        insert into public.seat_locks as sl (seat_id, event_id, user_id, expires_at)
        values (sid, _event_id, uid, now() + interval '10 minutes')
        on conflict (seat_id) do update
          set user_id = excluded.user_id, expires_at = excluded.expires_at
          where sl.user_id = uid;
        get diagnostics updated = row_count;
        if updated = 0 then
          out_locked := false; out_reason := 'LOCKED';
        else
          out_locked := true; out_reason := 'OK';
        end if;
      exception when unique_violation then
        out_locked := false; out_reason := 'LOCKED';
      end;
    end if;
    return query select out_seat, out_locked, out_reason;
  end loop;
end;
$function$;