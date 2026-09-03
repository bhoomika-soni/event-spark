import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { CalendarDays, IndianRupee, Ticket, TrendingUp } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { formatMoney, formatShortDate } from "@/lib/format";

export const Route = createFileRoute("/organizer/dashboard")({
  head: () => ({
    meta: [
      { title: "Organizer dashboard — EventX" },
      {
        name: "description",
        content: "Track tickets sold, revenue and upcoming events across your line-up.",
      },
      { property: "og:title", content: "Organizer dashboard — EventX" },
      { property: "og:description", content: "Tickets sold, revenue and upcoming events." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { user, isOrganizer, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login", replace: true });
  }, [loading, user, navigate]);

  const query = useQuery({
    queryKey: ["organizer-dashboard", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: events, error } = await supabase
        .from("events")
        .select("id, title, starts_at, status, price_cents")
        .eq("organizer_id", user!.id)
        .order("starts_at", { ascending: true });
      if (error) throw error;

      const eventIds = (events ?? []).map((e) => e.id);
      let bookings: { id: string; event_id: string; total_cents: number; status: string }[] = [];
      if (eventIds.length > 0) {
        const { data, error: bErr } = await supabase
          .from("bookings")
          .select("id, event_id, total_cents, status")
          .in("event_id", eventIds)
          .eq("status", "CONFIRMED");
        if (bErr) throw bErr;
        bookings = data ?? [];
      }

      let soldCount = 0;
      if (bookings.length > 0) {
        const { count } = await supabase
          .from("booking_items")
          .select("id", { count: "exact", head: true })
          .in(
            "booking_id",
            bookings.map((b) => b.id),
          )
          .eq("active", true);
        soldCount = count ?? 0;
      }

      return { events: events ?? [], bookings, soldCount };
    },
  });

  if (loading || query.isLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-12">
        <Skeleton className="h-9 w-1/3" />
        <div className="grid gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!isOrganizer) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <h1 className="text-2xl font-bold">Organizer access only</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This account is registered as an attendee. Create an organizer account to publish events.
        </p>
        <Button asChild className="mt-6">
          <Link to="/events">Browse events</Link>
        </Button>
      </div>
    );
  }

  const events = query.data?.events ?? [];
  const bookings = query.data?.bookings ?? [];
  const revenue = bookings.reduce((sum, b) => sum + b.total_cents, 0);
  const upcoming = events.filter((e) => new Date(e.starts_at) > new Date());

  const chartData = events.map((e) => ({
    name: e.title.length > 14 ? `${e.title.slice(0, 14)}…` : e.title,
    revenue: bookings
      .filter((b) => b.event_id === e.id)
      .reduce((sum, b) => sum + b.total_cents, 0) / 100,
  }));

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Organizer dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Everything you've sold, at a glance.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/organizer/events">My events</Link>
          </Button>
          <Button asChild>
            <Link to="/organizer/events/create">Create event</Link>
          </Button>
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={<CalendarDays className="size-4" />} label="Total events" value={String(events.length)} />
        <Stat icon={<Ticket className="size-4" />} label="Tickets sold" value={String(query.data?.soldCount ?? 0)} />
        <Stat icon={<IndianRupee className="size-4" />} label="Revenue" value={formatMoney(revenue)} />
        <Stat icon={<TrendingUp className="size-4" />} label="Upcoming" value={String(upcoming.length)} />
      </div>

      <div className="panel mt-8 p-6">
        <h2 className="font-display text-lg font-semibold">Revenue by event</h2>
        {chartData.length === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground">
            Publish your first event to start seeing sales here.
          </p>
        ) : (
          <div className="mt-6 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="name" stroke="var(--color-muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-popover)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "0.5rem",
                    color: "var(--color-foreground)",
                  }}
                />
                <Bar dataKey="revenue" fill="var(--color-chart-1)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="panel mt-8 p-6">
        <h2 className="font-display text-lg font-semibold">Upcoming events</h2>
        {upcoming.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No upcoming events scheduled.</p>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {upcoming.map((e) => (
              <li key={e.id} className="flex items-center justify-between py-3 text-sm">
                <span>{e.title}</span>
                <span className="text-muted-foreground">{formatShortDate(e.starts_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="panel p-5">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="text-primary">{icon}</span>
        {label}
      </div>
      <p className="mt-2 font-display text-2xl font-bold">{value}</p>
    </div>
  );
}
