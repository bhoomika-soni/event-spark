import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, LockKeyhole, QrCode, ShieldCheck, Timer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { EventCard, type EventListItem } from "@/components/EventCard";
import { Skeleton } from "@/components/ui/skeleton";
import heroImage from "@/assets/hero-crowd.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "EventX — book event seats without double-bookings" },
      {
        name: "description",
        content:
          "Browse live events, pick exact seats on an interactive map, hold them for 10 minutes and check out with a scannable QR ticket.",
      },
      { property: "og:title", content: "EventX — book event seats in seconds" },
      {
        property: "og:description",
        content: "Interactive seat maps, 10-minute seat holds and QR tickets for every booking.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const query = useQuery({
    queryKey: ["featured-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, title, category, starts_at, price_cents, status, venues(name, city)")
        .eq("status", "PUBLISHED")
        .gte("starts_at", new Date().toISOString())
        .order("starts_at", { ascending: true })
        .limit(3);
      if (error) throw error;
      return (data ?? []) as EventListItem[];
    },
  });

  return (
    <div>
      <section className="relative overflow-hidden border-b border-border">
        <img
          src={heroImage}
          alt="Crowd with raised hands at a live concert lit by amber stage lights"
          width={1600}
          height={1008}
          className="absolute inset-0 size-full object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/80 to-background" />
        <div className="relative mx-auto max-w-4xl px-4 py-28 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-2/80 px-3 py-1 text-xs uppercase tracking-widest text-muted-foreground">
            <ShieldCheck className="size-3.5 text-primary" /> No double-bookings, ever
          </span>
          <h1 className="mt-6 font-display text-5xl font-bold leading-tight sm:text-6xl">
            The seat you picked is the seat you get.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
            EventX gives every event a live seat map, holds your seats for ten minutes while you pay,
            and issues a scannable QR ticket the moment payment settles.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button size="lg" asChild>
              <Link to="/events">
                Browse events <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/organizer/events/create">Host an event</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20">
        <div className="grid gap-5 sm:grid-cols-3">
          <Feature
            icon={<LockKeyhole className="size-5" />}
            title="Atomic seat locking"
            body="Seats are reserved inside the database, so two people clicking the same seat at the same millisecond can never both win."
          />
          <Feature
            icon={<Timer className="size-5" />}
            title="10-minute holds"
            body="Your selection is held while you check out, then released automatically so no seat sits dead."
          />
          <Feature
            icon={<QrCode className="size-5" />}
            title="Instant QR tickets"
            body="Every confirmed seat gets its own signed ticket code, rendered as a downloadable QR pass."
          />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-24">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-3xl font-bold">Happening soon</h2>
            <p className="mt-1 text-sm text-muted-foreground">Next up on the EventX calendar.</p>
          </div>
          <Link to="/events" className="text-sm text-primary hover:underline">
            See all events
          </Link>
        </div>

        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {query.isLoading &&
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-48 rounded-xl" />
            ))}
          {query.data?.map((e) => <EventCard key={e.id} event={e} />)}
          {query.data?.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No events published yet — organizers, this is your moment.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function Feature({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="panel p-6">
      <span className="flex size-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
        {icon}
      </span>
      <h3 className="mt-4 font-display text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}
