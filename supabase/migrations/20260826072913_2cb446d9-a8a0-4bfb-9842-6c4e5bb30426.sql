insert into public.user_roles (user_id, role)
select id, 'ORGANIZER'::app_role from auth.users
on conflict (user_id, role) do nothing;

insert into public.venues (id, name, address, city) values
 ('11111111-1111-1111-1111-111111111111','Phoenix Arena','MG Road','Bengaluru'),
 ('22222222-2222-2222-2222-222222222222','Nehru Auditorium','Worli','Mumbai'),
 ('33333333-3333-3333-3333-333333333333','TechPark Hall','Sector 62','Noida')
on conflict (id) do nothing;

insert into public.events (id, organizer_id, venue_id, title, description, category, starts_at, price_cents, seat_rows, seat_cols, status)
values
 ('aaaaaaa1-0000-4000-8000-000000000001','62dfe589-c20b-42e0-9e69-0574719e38f0','11111111-1111-1111-1111-111111111111','Indie Nights Live','An evening of indie rock with three headline bands.','Music', now() + interval '14 days', 79900, 5, 8, 'PUBLISHED'),
 ('aaaaaaa1-0000-4000-8000-000000000002','62dfe589-c20b-42e0-9e69-0574719e38f0','22222222-2222-2222-2222-222222222222','Standup Central','A night of comedy with rising standup artists.','Comedy', now() + interval '21 days', 49900, 4, 6, 'PUBLISHED'),
 ('aaaaaaa1-0000-4000-8000-000000000003','1f08537a-87ad-4865-bc92-e3e4bfaebd9b','33333333-3333-3333-3333-333333333333','DevConf 2026','Full-day conference on modern full-stack engineering.','Tech', now() + interval '30 days', 129900, 6, 8, 'PUBLISHED')
on conflict (id) do nothing;