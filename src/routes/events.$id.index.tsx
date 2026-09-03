import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, MapPin, Armchair, IndianRupee } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, formatMoney } from "@/lib/format";

export const Route = createFileRoute("/events/$id/")({
  head: () => ({
    meta: [
      { title: "Event details — EventX" },
      { name: "description", content: "See the line-up, venue, pricing and live seat availability." },
      { property: "og:title", content: "Event details — EventX" },
      { property: "og:description", content: "Venue, pricing and live seat availability." },
    ],
  }),
  component: EventDetail,
});

function EventDetail() {
  const { id } = Route.useParams();

  const eventQuery = useQuery({
    queryKey: ["event", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*, venues(name, city, address)")
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
      return data ?? [];
    },
    refetchInterval: 15000,
  });

  if (eventQuery.isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 px-4 py-12">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  if (eventQuery.isError || !eventQuery.data) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-20 text-center">
        <h1 className="text-2xl font-bold">Event not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This event may have been removed or is not published yet.
        </p>
        <Button asChild className="mt-6">
          <Link to="/events">Browse events</Link>
        </Button>
      </div>
    );
  }

  const event = eventQuery.data;
  const seats = seatsQuery.data ?? [];
  const available = seats.filter((s) => s.status === "AVAILABLE").length;
  const cancelled = event.status === "CANCELLED";
  const ended = new Date(event.starts_at) < new Date();

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <Badge variant="secondary">{event.category}</Badge>
      <h1 className="mt-3 text-4xl font-bold">{event.title}</h1>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Info icon={<CalendarDays className="size-4" />} label={formatDate(event.starts_at)} />
        <Info
          icon={<MapPin className="size-4" />}
          label={
            event.venues
              ? `${event.venues.name}, ${event.venues.city}`
              : "Venue to be announced"
          }
        />
        <Info
          icon={<IndianRupee className="size-4" />}
          label={`${formatMoney(event.price_cents)} per seat`}
        />
        <Info
          icon={<Armchair className="size-4" />}
          label={
            seatsQuery.isLoading
              ? "Checking seat availability…"
              : `${available} of ${seats.length} seats available`
          }
        />
      </div>

      {event.description && (
        <div className="panel mt-8 p-6">
          <h2 className="font-display text-lg font-semibold">About this event</h2>
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
            {event.description}
          </p>
        </div>
      )}

      <div className="panel mt-8 flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-display text-lg font-semibold">
            {ended
              ? "This event has ended"
              : cancelled
                ? "This event was cancelled"
                : "Ready to pick your seats?"}
          </p>
          <p className="text-sm text-muted-foreground">
            {ended || cancelled
              ? "Bookings are closed for this event."
              : "Seats are held for 10 minutes once you select them."}
          </p>
        </div>
        <Button asChild size="lg" disabled={cancelled || ended}>
          <Link to="/events/$id/booking" params={{ id }}>
            Select seats
          </Link>
        </Button>
      </div>
    </div>
  );
}

function Info({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-3 text-sm">
      <span className="text-primary">{icon}</span>
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}
