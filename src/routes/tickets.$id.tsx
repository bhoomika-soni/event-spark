import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Download, Ticket as TicketIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { formatDate, formatMoney } from "@/lib/format";

export const Route = createFileRoute("/tickets/$id")({
  head: () => ({
    meta: [
      { title: "Your QR ticket — EventX" },
      { name: "description", content: "Show this QR ticket at the entrance, or download it." },
      { property: "og:title", content: "Your QR ticket — EventX" },
      { property: "og:description", content: "Scannable QR entry ticket for your booked seat." },
    ],
  }),
  component: TicketPage,
});

function TicketPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login", replace: true });
  }, [authLoading, user, navigate]);

  const ticketQuery = useQuery({
    queryKey: ["ticket", id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select(
          "id, ticket_code, issued_at, booking_id, booking_items(price_cents, seats(label)), bookings(total_cents, user_id, events(title, starts_at, venues(name, city, address)))",
        )
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const ticket = ticketQuery.data;

  useEffect(() => {
    if (!ticket) return;
    let cancelled = false;
    import("qrcode").then((QR) => {
      QR.toDataURL(`EVENTX:${ticket.ticket_code}`, {
        margin: 1,
        width: 320,
        color: { dark: "#0d1117", light: "#ffffff" },
      }).then((url) => {
        if (!cancelled) setQrDataUrl(url);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [ticket]);

  if (authLoading || ticketQuery.isLoading) {
    return (
      <div className="mx-auto max-w-md space-y-4 px-4 py-12">
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="text-2xl font-bold">Ticket not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This ticket doesn't exist, or it isn't yours.
        </p>
        <Button asChild className="mt-6">
          <Link to="/my-bookings">My bookings</Link>
        </Button>
      </div>
    );
  }

  const event = ticket.bookings?.events;
  const seatLabel = ticket.booking_items?.seats?.label ?? "—";

  function download() {
    if (!qrDataUrl) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `eventx-ticket-${ticket?.ticket_code}.png`;
    a.click();
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <Link to="/my-bookings" className="text-sm text-muted-foreground hover:text-foreground">
        ← Back to my bookings
      </Link>

      <div ref={cardRef} className="panel mt-4 overflow-hidden">
        <div className="flex items-center gap-2 border-b border-dashed border-border bg-surface-2 px-6 py-4">
          <TicketIcon className="size-4 text-primary" />
          <span className="font-display text-sm font-semibold uppercase tracking-widest">
            EventX entry pass
          </span>
        </div>

        <div className="space-y-4 p-6">
          <div>
            <h1 className="font-display text-2xl font-bold">{event?.title}</h1>
            <p className="text-sm text-muted-foreground">
              {event ? formatDate(event.starts_at) : ""}
            </p>
            <p className="text-sm text-muted-foreground">
              {event?.venues
                ? `${event.venues.name}, ${event.venues.city}`
                : "Venue to be announced"}
            </p>
          </div>

          <div className="flex justify-center rounded-xl bg-white p-4">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt={`QR code for ticket ${ticket.ticket_code}`} className="size-56" />
            ) : (
              <Skeleton className="size-56" />
            )}
          </div>

          <dl className="grid grid-cols-2 gap-3 text-sm">
            <Field label="Attendee" value={user?.email ?? "—"} />
            <Field label="Seat" value={seatLabel} />
            <Field label="Price" value={formatMoney(ticket.booking_items?.price_cents ?? 0)} />
            <Field label="Issued" value={formatDate(ticket.issued_at)} />
            <Field label="Booking ID" value={ticket.booking_id.slice(0, 8).toUpperCase()} />
            <Field label="Ticket ID" value={ticket.ticket_code.slice(0, 12).toUpperCase()} />
          </dl>

          <Button className="w-full" onClick={download} disabled={!qrDataUrl}>
            <Download className="size-4" /> Download QR ticket
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="truncate font-medium">{value}</dd>
    </div>
  );
}
