import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";
import { CalendarPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { formatDate, formatMoney } from "@/lib/format";

export const Route = createFileRoute("/organizer/events/")({
  head: () => ({
    meta: [
      { title: "My events — EventX organizer" },
      { name: "description", content: "Create, edit and cancel the events you're hosting." },
      { property: "og:title", content: "My events — EventX organizer" },
      { property: "og:description", content: "Create, edit and cancel your events." },
    ],
  }),
  component: OrganizerEventsPage,
});

function OrganizerEventsPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login", replace: true });
  }, [loading, user, navigate]);

  const query = useQuery({
    queryKey: ["organizer-events", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, title, starts_at, status, price_cents, venues(name, city)")
        .eq("organizer_id", user!.id)
        .order("starts_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function removeEvent(id: string) {
    const { error } = await supabase.from("events").delete().eq("id", id);
    if (error) {
      toast.error("Could not delete this event");
      return;
    }
    toast.success("Event deleted");
    queryClient.invalidateQueries({ queryKey: ["organizer-events"] });
  }

  if (loading || query.isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 px-4 py-12">
        <Skeleton className="h-9 w-1/3" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  const events = query.data ?? [];

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">My events</h1>
        <Button asChild>
          <Link to="/organizer/events/create">
            <CalendarPlus className="size-4" /> Create event
          </Link>
        </Button>
      </div>

      {events.length === 0 ? (
        <div className="panel mt-8 flex flex-col items-center gap-3 p-14 text-center">
          <p className="font-medium">You haven't created any events yet</p>
          <p className="text-sm text-muted-foreground">
            Set a date, a price and a seat layout — EventX generates the seat map for you.
          </p>
        </div>
      ) : (
        <div className="mt-8 space-y-4">
          {events.map((e) => (
            <div key={e.id} className="panel flex flex-wrap items-center gap-4 p-5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-display text-lg font-semibold">{e.title}</p>
                  <Badge variant={e.status === "PUBLISHED" ? "default" : "secondary"}>
                    {e.status}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {formatDate(e.starts_at)}
                  {e.venues ? ` · ${e.venues.name}, ${e.venues.city}` : ""} ·{" "}
                  {formatMoney(e.price_cents)}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link to="/events/$id" params={{ id: e.id }}>
                    View
                  </Link>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/organizer/events/$id/edit" params={{ id: e.id }}>
                    Edit
                  </Link>
                </Button>
                <Button variant="ghost" size="sm" onClick={() => removeEvent(e.id)}>
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
