import { z } from "zod";

export const credentialsSchema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(8, "Use at least 8 characters").max(72),
});

export const registerSchema = credentialsSchema.extend({
  fullName: z.string().trim().min(2, "Tell us your name").max(80),
  role: z.enum(["USER", "ORGANIZER"]),
});

export const eventSchema = z.object({
  title: z.string().trim().min(3, "Title is too short").max(120),
  description: z.string().trim().max(2000).default(""),
  category: z.string().trim().min(2).max(40),
  startsAt: z.string().min(1, "Pick a date and time"),
  venueName: z.string().trim().min(2, "Venue name is required").max(120),
  venueCity: z.string().trim().min(2, "City is required").max(80),
  venueAddress: z.string().trim().max(200).default(""),
  priceRupees: z.coerce.number().min(0, "Price cannot be negative").max(1000000),
  seatRows: z.coerce.number().int().min(1).max(26),
  seatCols: z.coerce.number().int().min(1).max(30),
  status: z.enum(["DRAFT", "PUBLISHED", "CANCELLED"]),
});

export type EventInput = z.infer<typeof eventSchema>;

export const seatSelectionSchema = z
  .array(z.string().uuid())
  .min(1, "Select at least one seat")
  .max(8, "You can book up to 8 seats at once");
