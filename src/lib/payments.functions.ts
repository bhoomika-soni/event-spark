import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const payInput = z.object({
  eventId: z.string().uuid(),
  seatIds: z.array(z.string().uuid()).min(1).max(8),
});

/**
 * Server-side payment settlement.
 *
 * Razorpay swap-in point: create the order with the Razorpay SDK, then verify
 * the `razorpay_signature` HMAC here BEFORE calling `confirm_booking`. Until
 * live keys are configured this issues a test-mode reference instead. Either
 * way the client never decides whether a payment succeeded, and
 * `confirm_booking` is idempotent on the payment id.
 */
export const payAndConfirmBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => payInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const orderId = `order_test_${crypto.randomUUID().replace(/-/g, "").slice(0, 14)}`;
    const paymentId = `pay_test_${crypto.randomUUID().replace(/-/g, "").slice(0, 14)}`;

    const { data: bookingId, error } = await supabase.rpc("confirm_booking", {
      _event_id: data.eventId,
      _seat_ids: data.seatIds,
      _order_id: orderId,
      _payment_id: paymentId,
    });

    if (error) {
      console.error("confirm_booking failed", error.message);
      const message = error.message.includes("SEAT_ALREADY_BOOKED")
        ? "SEAT_ALREADY_BOOKED"
        : error.message.includes("SEAT_LOCK_EXPIRED")
          ? "SEAT_LOCK_EXPIRED"
          : "PAYMENT_FAILED";
      return { ok: false as const, error: message };
    }

    return { ok: true as const, bookingId: bookingId as string };
  });
