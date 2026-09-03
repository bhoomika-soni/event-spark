# EventX — event booking & ticketing platform

EventX is a full-stack event booking platform: organizers publish events with a generated seat
map, attendees pick exact seats on a live map, seats are held for 10 minutes while they pay, and
every confirmed seat becomes a scannable QR ticket.

## Feature set

**Attendee**
- Browse and search published events by title, category and city
- Event detail page with live seat availability (polled every few seconds)  
- Interactive seat map — available / locked / booked / selected states
- 10-minute seat hold with a visible countdown, released automatically on expiry
- Checkout with an order summary and payment settlement
- Booking history with cancellation (up to 24 h before the event)
- Per-seat QR ticket page with downloadable PNG

**Organizer**
- Register as an organizer (role stored in a dedicated `user_roles` table)
- Create events with venue, category, price and a rows × columns seat layout
- Seat map is generated automatically by a database trigger
- Edit and delete events, toggle draft / published / cancelled
- Dashboard with tickets sold, revenue, upcoming events and a revenue-per-event chart

## Tech stack

The original brief targeted Next.js + Prisma + Redis. This project is built on the equivalent
Lovable stack, keeping every architectural guarantee:

| Brief | Implemented as |
| --- | --- |
| Next.js App Router | TanStack Start (React 19 + Vite, SSR, file-based routing) |
| TypeScript | TypeScript, strict |
| Tailwind + shadcn/ui | Tailwind CSS v4 + shadcn/ui |
| PostgreSQL + Prisma | PostgreSQL (Lovable Cloud / Supabase) with SQL migrations |
| Redis seat locks | `seat_locks` table + atomic PL/pgSQL RPCs and a unique partial index |
| Zod | Zod schemas for every form and server input |
| Razorpay | Payment server function with a Razorpay-shaped contract, test path enabled |
| Docker Compose | Managed cloud runtime (Postgres, auth, server functions) |
| QR codes | `qrcode`, rendered client-side per ticket |

## Concurrency model (the interesting part)

Double-booking is prevented at three layers:

1. **Seat locks.** `lock_seats(event_id, seat_ids)` inserts into `seat_locks` with
   `ON CONFLICT (seat_id) DO UPDATE ... WHERE user_id = auth.uid()`. A seat already held by
   someone else simply fails to lock and is reported back as `LOCKED`. Locks expire after
   10 minutes and stale rows are swept on every call.
2. **Atomic confirmation.** `confirm_booking(...)` runs in a single transaction: it verifies the
   caller still holds every seat, creates the booking, booking items, tickets and payment row,
   then deletes the locks.
3. **The database has the final word.** A unique partial index
   `booking_items(seat_id) WHERE active` makes a second active booking for the same seat
   physically impossible. `confirm_booking` catches `unique_violation` and raises
   `SEAT_ALREADY_BOOKED`, so a lost race is a clean error rather than a duplicate ticket.

`confirm_booking` is also idempotent by payment id — replaying the same payment returns the
existing booking instead of creating a second one.

## Security

- Row Level Security on every table; policies scope reads to the owner or the event organizer.
- Roles live in a separate `user_roles` table with a `has_role()` security-definer function —
  never on the profile row, so a user cannot escalate themselves to organizer.
- Booking, ticket and payment tables are **read-only** to clients; all writes go through
  security-definer RPCs that re-derive `auth.uid()` server-side.
- Public seat availability is exposed through a `seat_availability()` function that returns seat
  status only — no booking or user data leaks.
- Payment settlement runs in a server function, so provider secrets never reach the browser.

## Data model

```
profiles       user profile mirrored from auth
user_roles     USER | ORGANIZER
venues         name, city, address
events         organizer, venue, title, category, starts_at, price, seat_rows, seat_cols, status
seats          generated per event (A1 … Fn)
seat_locks     seat_id (unique), user_id, expires_at
bookings       user, event, status, total
booking_items  booking, seat, price, active   ← unique(seat_id) where active
tickets        one per booking item, unique ticket_code
payments       provider, order_id, payment_id, amount, status
```

## Routes

| Path | Purpose |
| --- | --- |
| `/` | Landing page |
| `/events` | Event gallery with search and category filter |
| `/events/$id` | Event detail with live availability |
| `/events/$id/booking` | Seat map, seat locking, hold countdown |
| `/checkout` | Order review and settlement |
| `/my-bookings` | Booking history and cancellation |
| `/tickets/$id` | QR entry pass |
| `/organizer/dashboard` | Sales metrics |
| `/organizer/events` | Manage events |
| `/organizer/events/create`, `/organizer/events/$id/edit` | Event forms |
| `/login`, `/register` | Auth with role selection |

## Payments

Payment settlement lives in `src/lib/payments.functions.ts`. It currently runs a **test path**:
it generates an order/payment reference and calls `confirm_booking`, so the whole booking flow is
demonstrable end to end without live keys.

To go live with Razorpay:

1. Add `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` as backend secrets.
2. In the server function, create the order via the Razorpay Orders API instead of generating a
   local reference, and return `order_id` to the client.
3. Open Razorpay Checkout in the browser with that order id.
4. Verify the returned signature (`HMAC-SHA256` of `order_id|payment_id` with the key secret) in
   the server function **before** calling `confirm_booking`.

The `payments` table and the `confirm_booking` signature already match this flow, so no schema
change is needed.

## Local development

```bash
bun install
bun run dev      # http://localhost:8080
```

Environment variables are provided by the Lovable Cloud integration; server-only secrets are read
inside server-function handlers.

## Demo script (for a portfolio walkthrough)

1. Register two accounts — one organizer, one attendee.
2. As the organizer, create an event with a 6 × 10 seat layout.
3. As the attendee, open the event, select two seats, watch the hold timer start.
4. In a second browser, try the same seats — they show as locked.
5. Complete checkout, open the QR ticket, download it.
6. Back in the organizer dashboard, revenue and tickets sold update.
