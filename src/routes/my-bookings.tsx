import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { TicketX, QrCode } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { formatDate, formatMoney } from "@/lib/format";

export const Route = createFileRoute("/my-bookings")({
  head: () => ({
    meta: [
      { title: "My bookings — EventX" },
      { name: "description", content: "Your booking history, QR tickets and cancellations." },
      { property: "og:title", content: "My bookings — EventX" },
      { property: "og:description", content: "Booking history, QR tickets and cancellations." },
    ],
  }),
  component: MyBookingsPage,
});

function MyBookingsPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [cancelling, setCancelling] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login", replace: true });
  }, [authLoading, user, navigate]);

  const bookingsQuery = useQuery({
    queryKey: ["my-bookings", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select(
          "id, user_id, status, total_cents, created_at, events(title, starts_at, venues(name, city)), booking_items(id, price_cents, seats(label), tickets(id))",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function cancel(bookingId: string) {
    setCancelling(bookingId);
    const { error } = await supabase.rpc("cancel_booking", { _booking_id: bookingId });
    setCancelling(null);
    if (error) {
      toast.error(
        error.message.includes("CANCELLATION_WINDOW_CLOSED")
          ? "Bookings can only be cancelled up to 24 hours before the event"
          : "Could not cancel this booking",
      );
      return;
    }
    toast.success("Booking cancelled and seats released");
    queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
  }

  if (authLoading || bookingsQuery.isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 px-4 py-12">
        <Skeleton className="h-9 w-1/3" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  const bookings = bookingsQuery.data ?? [];
  const mine = bookings.filter((b) => b.user_id === user?.id);
  const spent = mine
    .filter((b) => b.status === "CONFIRMED")
    .reduce((s, b) => s + b.total_cents, 0);
  const refunded = mine
    .filter((b) => b.status === "CANCELLED")
    .reduce((s, b) => s + b.total_cents, 0);

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-bold">My bookings</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Every confirmed seat comes with its own QR ticket.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="panel p-5">
          <p className="text-sm text-muted-foreground">Spent on tickets</p>
          <p className="mt-2 font-display text-2xl font-bold">{formatMoney(spent)}</p>
        </div>
        <div className="panel p-5">
          <p className="text-sm text-muted-foreground">Refunded to you</p>
          <p className="mt-2 font-display text-2xl font-bold">{formatMoney(refunded)}</p>
        </div>
      </div>


      {bookingsQuery.isError && (
        <p className="panel mt-8 p-6 text-sm text-destructive">We couldn't load your bookings.</p>
      )}

      {bookings.length === 0 && !bookingsQuery.isError && (
        <div className="panel mt-8 flex flex-col items-center gap-3 p-14 text-center">
          <TicketX className="size-8 text-muted-foreground" />
          <p className="font-medium">No bookings yet</p>
          <Button asChild className="mt-2">
            <Link to="/events">Find an event</Link>
          </Button>
        </div>
      )}

      <div className="mt-8 space-y-4">
        {bookings.map((b) => {
          const event = b.events;
          return (
            <div key={b.id} className="panel space-y-4 p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-display text-lg font-semibold">{event?.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {event ? formatDate(event.starts_at) : ""}
                    {event?.venues ? ` · ${event.venues.name}, ${event.venues.city}` : ""}
                  </p>
                </div>
                <Badge variant={b.status === "CONFIRMED" ? "default" : "secondary"}>
                  {b.status}
                </Badge>
              </div>

              <div className="flex flex-wrap gap-2">
                {b.booking_items.map((item) => {
                  const ticket = item.tickets as { id: string } | { id: string }[] | null;
                  const ticketId = Array.isArray(ticket) ? ticket[0]?.id : ticket?.id;
                  return ticketId && b.status === "CONFIRMED" ? (
                    <Button key={item.id} variant="outline" size="sm" asChild>
                      <Link to="/tickets/$id" params={{ id: ticketId }}>
                        <QrCode className="size-3.5" /> Seat {item.seats?.label}
                      </Link>
                    </Button>
                  ) : (
                    <span
                      key={item.id}
                      className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground"
                    >
                      Seat {item.seats?.label}
                    </span>
                  );
                })}
              </div>

              <div className="flex items-center justify-between border-t border-border pt-4">
                <span className="font-display text-lg font-semibold text-primary">
                  {formatMoney(b.total_cents)}
                </span>
                {b.status === "CONFIRMED" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={cancelling === b.id}
                    onClick={() => cancel(b.id)}
                  >
                    {cancelling === b.id ? "Cancelling…" : "Cancel booking"}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
