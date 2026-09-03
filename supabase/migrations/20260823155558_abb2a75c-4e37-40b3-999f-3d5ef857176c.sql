create or replace function public.seat_availability(_event_id uuid)
returns table (seat_id uuid, label text, row_label text, col_number integer, price_cents integer, status text, held_by_me boolean)
language sql stable security definer set search_path = public as $$
  select s.id,
         s.label,
         s.row_label,
         s.col_number,
         s.price_cents,
         case
           when exists (select 1 from public.booking_items bi where bi.seat_id = s.id and bi.active) then 'BOOKED'
           when exists (select 1 from public.seat_locks l where l.seat_id = s.id and l.expires_at > now()) then 'LOCKED'
           else 'AVAILABLE'
         end as status,
         exists (
           select 1 from public.seat_locks l
           where l.seat_id = s.id and l.expires_at > now() and l.user_id = auth.uid()
         ) as held_by_me
  from public.seats s
  where s.event_id = _event_id
  order by s.row_label, s.col_number
$$;
revoke all on function public.seat_availability(uuid) from public;
grant execute on function public.seat_availability(uuid) to anon, authenticated;