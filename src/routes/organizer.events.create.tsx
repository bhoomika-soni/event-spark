import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { eventSchema } from "@/lib/validation";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { EventForm, type EventFormValues, emptyEvent } from "@/components/EventForm";

export const Route = createFileRoute("/organizer/events/create")({
  head: () => ({
    meta: [
      { title: "Create an event — EventX organizer" },
      {
        name: "description",
        content: "Publish a new event with a date, venue, ticket price and seat layout.",
      },
      { property: "og:title", content: "Create an event — EventX organizer" },
      { property: "og:description", content: "Set date, venue, price and seat layout." },
    ],
  }),
  component: CreateEventPage,
});

function CreateEventPage() {
  const { user, isOrganizer, loading } = useAuth();
  const navigate = useNavigate();
  const [values, setValues] = useState<EventFormValues>(emptyEvent);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login", replace: true });
  }, [loading, user, navigate]);

  async function onSubmit() {
    const parsed = eventSchema.safeParse(values);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the form");
      return;
    }
    setError(null);
    setSaving(true);
    const input = parsed.data;

    const { data: venue, error: venueError } = await supabase
      .from("venues")
      .insert({ name: input.venueName, city: input.venueCity, address: input.venueAddress })
      .select("id")
      .single();

    if (venueError || !venue) {
      setSaving(false);
      setError("Could not save the venue. Are you signed in as an organizer?");
      return;
    }

    const { data: event, error: eventError } = await supabase
      .from("events")
      .insert({
        organizer_id: user!.id,
        venue_id: venue.id,
        title: input.title,
        description: input.description,
        category: input.category,
        starts_at: new Date(input.startsAt).toISOString(),
        price_cents: Math.round(input.priceRupees * 100),
        seat_rows: input.seatRows,
        seat_cols: input.seatCols,
        status: input.status,
      })
      .select("id")
      .single();

    setSaving(false);
    if (eventError || !event) {
      setError(eventError?.message ?? "Could not create the event");
      return;
    }
    toast.success("Event created and seat map generated");
    navigate({ to: "/organizer/events" });
  }

  async function becomeOrganizer() {
    setSaving(true);
    const { error: roleError } = await supabase
      .from("user_roles")
      .upsert({ user_id: user!.id, role: "ORGANIZER" }, { onConflict: "user_id,role" });
    setSaving(false);
    if (roleError) {
      toast.error("Could not enable hosting on this account");
      return;
    }
    toast.success("Hosting enabled — create your first event");
    window.location.reload();
  }

  if (!loading && user && !isOrganizer) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <h1 className="text-2xl font-bold">Become an organizer</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your account is an attendee account. Enable hosting to publish events with live seat maps.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button onClick={becomeOrganizer} disabled={saving}>
            {saving ? "Enabling…" : "Enable hosting"}
          </Button>
          <Button variant="outline" asChild>
            <Link to="/events">Browse events</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-3xl font-bold">Create an event</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        EventX generates the seat map automatically from your rows and columns.
      </p>
      <EventForm
        values={values}
        onChange={setValues}
        onSubmit={onSubmit}
        saving={saving}
        error={error}
        submitLabel="Create event"
      />
    </div>
  );
}
