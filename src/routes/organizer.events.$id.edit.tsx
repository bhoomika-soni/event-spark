import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { eventSchema } from "@/lib/validation";
import { useAuth } from "@/lib/auth";
import { Skeleton } from "@/components/ui/skeleton";
import { EventForm, type EventFormValues, emptyEvent } from "@/components/EventForm";

export const Route = createFileRoute("/organizer/events/$id/edit")({
  head: () => ({
    meta: [
      { title: "Edit event — EventX organizer" },
      { name: "description", content: "Update the details, pricing and status of your event." },
      { property: "og:title", content: "Edit event — EventX organizer" },
      { property: "og:description", content: "Update details, pricing and status." },
    ],
  }),
  component: EditEventPage,
});

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function EditEventPage() {
  const { id } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [values, setValues] = useState<EventFormValues>(emptyEvent);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login", replace: true });
  }, [loading, user, navigate]);

  const query = useQuery({
    queryKey: ["organizer-event", id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error: err } = await supabase
        .from("events")
        .select(
          "id, title, description, category, starts_at, price_cents, seat_rows, seat_cols, status, venue_id, venues(name, city, address)",
        )
        .eq("id", id)
        .maybeSingle();
      if (err) throw err;
      return data;
    },
  });

  const event = query.data;

  useEffect(() => {
    if (!event) return;
    setValues({
      title: event.title,
      description: event.description,
      category: event.category,
      startsAt: toLocalInput(event.starts_at),
      venueName: event.venues?.name ?? "",
      venueCity: event.venues?.city ?? "",
      venueAddress: event.venues?.address ?? "",
      priceRupees: String(event.price_cents / 100),
      seatRows: String(event.seat_rows),
      seatCols: String(event.seat_cols),
      status: event.status as EventFormValues["status"],
    });
  }, [event]);

  async function onSubmit() {
    const parsed = eventSchema.safeParse(values);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the form");
      return;
    }
    setError(null);
    setSaving(true);
    const input = parsed.data;

    const { error: err } = await supabase
      .from("events")
      .update({
        title: input.title,
        description: input.description,
        category: input.category,
        starts_at: new Date(input.startsAt).toISOString(),
        price_cents: Math.round(input.priceRupees * 100),
        status: input.status,
      })
      .eq("id", id);

    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    toast.success("Event updated");
    navigate({ to: "/organizer/events" });
  }

  if (loading || query.isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 px-4 py-12">
        <Skeleton className="h-9 w-1/3" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-3xl font-bold">Edit event</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Seat layout is fixed once the seat map has been generated, so rows and columns stay as they
        are.
      </p>
      <EventForm
        values={values}
        onChange={setValues}
        onSubmit={onSubmit}
        saving={saving}
        error={error}
        submitLabel="Save changes"
      />
    </div>
  );
}
