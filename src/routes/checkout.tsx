import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, ShieldCheck, Smartphone, CreditCard, Landmark } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { payAndConfirmBooking } from "@/lib/payments.functions";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { formatMoney, formatDate } from "@/lib/format";
import type { SeatInfo } from "@/components/SeatMap";

const searchSchema = z.object({
  event: z.string().uuid(),
  seats: z.string().min(1),
});

export const Route = createFileRoute("/checkout")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Checkout — EventX" },
      { name: "description", content: "Review your held seats and pay securely to confirm." },
      { property: "og:title", content: "Checkout — EventX" },
      { property: "og:description", content: "Review your held seats and pay securely." },
    ],
  }),
  component: CheckoutPage,
});

function CheckoutPage() {
  const { event: eventId, seats: seatsParam } = Route.useSearch();
  const seatIds = seatsParam.split(",").filter(Boolean);
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const pay = useServerFn(payAndConfirmBooking);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login", replace: true });
  }, [authLoading, user, navigate]);

  const eventQuery = useQuery({
    queryKey: ["event", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, title, starts_at, venues(name, city)")
        .eq("id", eventId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const seatsQuery = useQuery({
    queryKey: ["availability", eventId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("seat_availability", { _event_id: eventId });
      if (error) throw error;
      return (data ?? []) as SeatInfo[];
    },
    refetchInterval: 15000,
  });

  const chosen = (seatsQuery.data ?? []).filter((s) => seatIds.includes(s.seat_id));
  const stillHeld = chosen.every((s) => s.held_by_me);
  const total = chosen.reduce((sum, s) => sum + s.price_cents, 0);

  async function handlePay() {
    setPaying(true);
    try {
      const result = await pay({ data: { eventId, seatIds } });
      if (!result.ok) {
        const messages: Record<string, string> = {
          SEAT_ALREADY_BOOKED: "Someone else booked one of those seats first.",
          SEAT_LOCK_EXPIRED: "Your seat hold expired. Please select seats again.",
          PAYMENT_FAILED: "Payment could not be completed. You were not charged.",
        };
        toast.error(messages[result.error] ?? "Payment failed");
        navigate({ to: "/events/$id/booking", params: { id: eventId } });
        return;
      }
      toast.success("Booking confirmed — your tickets are ready");
      navigate({ to: "/my-bookings" });
    } catch {
      toast.error("Payment could not be completed. You were not charged.");
    } finally {
      setPaying(false);
    }
  }

  if (eventQuery.isLoading || seatsQuery.isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 px-4 py-12">
        <Skeleton className="h-9 w-1/2" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (
    !eventQuery.data ||
    chosen.length === 0 ||
    new Date(eventQuery.data.starts_at) < new Date()
  ) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="text-2xl font-bold">Nothing to check out</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your seat selection is no longer available.
        </p>
        <Button asChild className="mt-6">
          <Link to="/events">Browse events</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-3xl font-bold">Checkout</h1>

      <div className="panel mt-6 space-y-4 p-6">
        <div>
          <p className="font-display text-lg font-semibold">{eventQuery.data.title}</p>
          <p className="text-sm text-muted-foreground">
            {formatDate(eventQuery.data.starts_at)}
            {eventQuery.data.venues
              ? ` · ${eventQuery.data.venues.name}, ${eventQuery.data.venues.city}`
              : ""}
          </p>
        </div>

        <ul className="space-y-2 border-t border-border pt-4 text-sm">
          {chosen.map((s) => (
            <li key={s.seat_id} className="flex justify-between">
              <span>Seat {s.label}</span>
              <span className="text-muted-foreground">{formatMoney(s.price_cents)}</span>
            </li>
          ))}
        </ul>

        <div className="flex justify-between border-t border-border pt-4 font-display text-xl font-semibold">
          <span>Total</span>
          <span className="text-primary">{formatMoney(total)}</span>
        </div>
      </div>

      {!stillHeld && (
        <p className="mt-4 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          One or more of your seat holds has expired. Please select your seats again.
        </p>
      )}

      <div className="panel mt-6 space-y-4 p-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ShieldCheck className="size-4 text-success" />
          Payment is verified on the server before your booking is confirmed.
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1">
            <Smartphone className="size-3.5" /> UPI
          </span>
          <span className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1">
            <CreditCard className="size-3.5" /> Cards
          </span>
          <span className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1">
            <Landmark className="size-3.5" /> Net banking
          </span>
        </div>
        <Button className="w-full" size="lg" disabled={paying || !stillHeld} onClick={handlePay}>
          {paying ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Confirming…
            </>
          ) : (
            `Pay ${formatMoney(total)}`
          )}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Test mode — no money is charged. Add Razorpay keys to enable live UPI, cards and net
          banking.
        </p>
      </div>
    </div>
  );
}
