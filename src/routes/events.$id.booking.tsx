import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Timer, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SeatMap, type SeatInfo } from "@/components/SeatMap";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { formatMoney } from "@/lib/format";

const HOLD_SECONDS = 10 * 60;

export const Route = createFileRoute("/events/$id/booking")({
  head: () => ({
    meta: [
      { title: "Select your seats — EventX" },
      {
        name: "description",
        content: "Pick seats on the live seat map. Selected seats are held for 10 minutes.",
      },
      { property: "og:title", content: "Select your seats — EventX" },
      { property: "og:description", content: "Live seat map with 10-minute seat holds." },
    ],
  }),
  component: BookingPage,
});

function BookingPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [selected, setSelected] = useState<string[]>([]);
  const [holdStartedAt, setHoldStartedAt] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(HOLD_SECONDS);
  const [pending, setPending] = useState(false);

  const eventQuery = useQuery({
    queryKey: ["event", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, title, price_cents, status, starts_at, venues(name, city)")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const seatsQuery = useQuery({
    queryKey: ["availability", id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("seat_availability", { _event_id: id });
      if (error) throw error;
      return (data ?? []) as SeatInfo[];
    },
    refetchInterval: 10000,
  });

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login", replace: true });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!holdStartedAt) return;
    const tick = () => {
      const left = HOLD_SECONDS - Math.floor((Date.now() - holdStartedAt) / 1000);
      setSecondsLeft(Math.max(0, left));
      if (left <= 0) {
        setSelected([]);
        setHoldStartedAt(null);
        toast.error("Your seat hold expired. Please pick seats again.");
        seatsQuery.refetch();
      }
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holdStartedAt]);

  // Release held seats only when the user actually leaves the page.
  const selectedRef = useRef<string[]>([]);
  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);
  useEffect(() => {
    return () => {
      if (selectedRef.current.length > 0) {
        void supabase.rpc("release_seats", { _seat_ids: selectedRef.current });
      }
    };
  }, []);


  async function toggleSeat(seatId: string) {
    if (pending) return;
    setPending(true);
    try {
      if (selected.includes(seatId)) {
        const { error } = await supabase.rpc("release_seats", { _seat_ids: [seatId] });
        if (error) throw error;
        const next = selected.filter((s) => s !== seatId);
        setSelected(next);
        if (next.length === 0) setHoldStartedAt(null);
      } else {
        if (selected.length >= 8) {
          toast.error("You can hold up to 8 seats at a time");
          return;
        }
        const { data, error } = await supabase.rpc("lock_seats", {
          _event_id: id,
          _seat_ids: [seatId],
        });
        if (error) throw error;
        const result = data?.[0];
        if (!result?.locked) {
          toast.error(
            result?.reason === "BOOKED"
              ? "That seat has just been booked"
              : "Someone else is holding that seat right now",
          );
        } else {
          setSelected((prev) => [...prev, seatId]);
          setHoldStartedAt((prev) => prev ?? Date.now());
        }
      }
      await seatsQuery.refetch();
    } catch (e) {
      const msg =
        typeof e === "object" && e !== null && "message" in e
          ? String((e as { message?: unknown }).message)
          : "";
      if (msg.includes("Not authenticated")) {
        toast.error("Please sign in again to hold seats.");
        navigate({ to: "/login" });
      } else {
        toast.error(msg || "Could not update your seat hold");
      }

    } finally {
      setPending(false);
    }
  }

  const seats = seatsQuery.data ?? [];
  const selectedSeats = seats.filter((s) => selected.includes(s.seat_id));
  const total = selectedSeats.reduce((sum, s) => sum + s.price_cents, 0);
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  if (eventQuery.isLoading || seatsQuery.isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 px-4 py-12">
        <Skeleton className="h-9 w-1/2" />
        <Skeleton className="h-80 w-full rounded-xl" />
      </div>
    );
  }

  if (!eventQuery.data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="text-2xl font-bold">Event unavailable</h1>
        <Button asChild className="mt-6">
          <Link to="/events">Browse events</Link>
        </Button>
      </div>
    );
  }

  if (new Date(eventQuery.data.starts_at) < new Date()) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="text-2xl font-bold">This event has ended</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Bookings are closed for past events.
        </p>
        <Button asChild className="mt-6">
          <Link to="/events">Browse upcoming events</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <Link to="/events/$id" params={{ id }} className="text-sm text-muted-foreground hover:text-foreground">
        ← Back to event
      </Link>
      <h1 className="mt-3 text-3xl font-bold">{eventQuery.data.title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Seats are held for 10 minutes. The server is the source of truth — if a seat turns
        orange, someone else got there first.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="panel p-6">
          <SeatMap seats={seats} selected={selected} onToggle={toggleSeat} disabled={pending} />
        </div>

        <aside className="panel h-fit space-y-4 p-6 lg:sticky lg:top-24">
          <h2 className="font-display text-lg font-semibold">Your selection</h2>

          {holdStartedAt && (
            <div className="flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm">
              <Timer className="size-4 text-primary" />
              Held for {mm}:{ss}
            </div>
          )}

          {selectedSeats.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No seats selected yet. Tap a seat on the map to hold it.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {selectedSeats.map((s) => (
                <li key={s.seat_id} className="flex justify-between">
                  <span>Seat {s.label}</span>
                  <span className="text-muted-foreground">{formatMoney(s.price_cents)}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="flex justify-between border-t border-border pt-3 font-display text-lg font-semibold">
            <span>Total</span>
            <span className="text-primary">{formatMoney(total)}</span>
          </div>

          <Button
            className="w-full"
            size="lg"
            disabled={selected.length === 0 || pending}
            onClick={() =>
              navigate({
                to: "/checkout",
                search: { event: id, seats: selected.join(",") },
              })
            }
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : "Continue to checkout"}
          </Button>
        </aside>
      </div>
    </div>
  );
}
