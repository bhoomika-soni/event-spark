import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search, CalendarX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { EventCard, type EventListItem } from "@/components/EventCard";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/events/")({
  head: () => ({
    meta: [
      { title: "Browse events — EventX" },
      {
        name: "description",
        content:
          "Browse concerts, comedy nights, workshops and more. Pick your seats and pay securely on EventX.",
      },
      { property: "og:title", content: "Browse events — EventX" },
      {
        property: "og:description",
        content: "Concerts, comedy, workshops and more — pick your exact seat.",
      },
    ],
  }),
  component: EventsPage,
});

async function fetchEvents() {
  const { data, error } = await supabase
    .from("events")
    .select("id, title, category, starts_at, price_cents, status, venues(name, city)")
    .eq("status", "PUBLISHED")
    .gte("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as EventListItem[];
}

function EventsPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["events"],
    queryFn: fetchEvents,
  });

  const categories = useMemo(
    () => ["All", ...Array.from(new Set((data ?? []).map((e) => e.category)))],
    [data],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data ?? []).filter((e) => {
      const matchesCategory = category === "All" || e.category === category;
      const matchesQuery =
        !q ||
        e.title.toLowerCase().includes(q) ||
        (e.venues?.city ?? "").toLowerCase().includes(q) ||
        (e.venues?.name ?? "").toLowerCase().includes(q);
      return matchesCategory && matchesQuery;
    });
  }, [data, search, category]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-4xl font-bold">Upcoming events</h1>
      <p className="mt-2 text-muted-foreground">
        Live seat maps, held for 10 minutes while you check out.
      </p>

      <div className="mt-8 flex flex-col gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by event, venue or city"
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={cn(
                "rounded-full border px-3 py-1 text-sm transition-colors",
                category === c
                  ? "border-primary bg-primary/15 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-8">
        {isLoading && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-44 rounded-xl" />
            ))}
          </div>
        )}

        {isError && (
          <div className="panel flex flex-col items-center gap-3 p-10 text-center">
            <p className="text-sm text-muted-foreground">We couldn't load events right now.</p>
            <Button variant="outline" onClick={() => refetch()}>
              Try again
            </Button>
          </div>
        )}

        {!isLoading && !isError && filtered.length === 0 && (
          <div className="panel flex flex-col items-center gap-3 p-14 text-center">
            <CalendarX className="size-8 text-muted-foreground" />
            <p className="font-medium">No events match your search</p>
            <p className="text-sm text-muted-foreground">
              Try a different keyword or clear the category filter.
            </p>
          </div>
        )}

        {!isLoading && filtered.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
