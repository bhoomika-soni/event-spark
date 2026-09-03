import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export interface EventFormValues {
  title: string;
  description: string;
  category: string;
  startsAt: string;
  venueName: string;
  venueCity: string;
  venueAddress: string;
  priceRupees: string;
  seatRows: string;
  seatCols: string;
  status: "DRAFT" | "PUBLISHED" | "CANCELLED";
}

export const emptyEvent: EventFormValues = {
  title: "",
  description: "",
  category: "Music",
  startsAt: "",
  venueName: "",
  venueCity: "",
  venueAddress: "",
  priceRupees: "499",
  seatRows: "6",
  seatCols: "10",
  status: "PUBLISHED",
};

interface Props {
  values: EventFormValues;
  onChange: (values: EventFormValues) => void;
  onSubmit: () => void;
  saving: boolean;
  error: string | null;
  submitLabel: string;
}

export function EventForm({ values, onChange, onSubmit, saving, error, submitLabel }: Props) {
  const set = (key: keyof EventFormValues, value: string) =>
    onChange({ ...values, [key]: value });

  const totalSeats = Number(values.seatRows || 0) * Number(values.seatCols || 0);

  return (
    <form
      className="panel mt-8 space-y-5 p-6"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="title">Event name</Label>
        <Input
          id="title"
          value={values.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="Midnight Jazz Sessions"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          rows={4}
          value={values.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="Tell people what to expect."
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <Input
            id="category"
            value={values.category}
            onChange={(e) => set("category", e.target.value)}
            placeholder="Music"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="startsAt">Date & time</Label>
          <Input
            id="startsAt"
            type="datetime-local"
            value={values.startsAt}
            onChange={(e) => set("startsAt", e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="venueName">Venue</Label>
          <Input
            id="venueName"
            value={values.venueName}
            onChange={(e) => set("venueName", e.target.value)}
            placeholder="Phoenix Arena"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="venueCity">City</Label>
          <Input
            id="venueCity"
            value={values.venueCity}
            onChange={(e) => set("venueCity", e.target.value)}
            placeholder="Bengaluru"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="venueAddress">Address</Label>
        <Input
          id="venueAddress"
          value={values.venueAddress}
          onChange={(e) => set("venueAddress", e.target.value)}
          placeholder="12 MG Road"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="price">Ticket price (₹)</Label>
          <Input
            id="price"
            type="number"
            min={0}
            value={values.priceRupees}
            onChange={(e) => set("priceRupees", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="rows">Seat rows</Label>
          <Input
            id="rows"
            type="number"
            min={1}
            max={26}
            value={values.seatRows}
            onChange={(e) => set("seatRows", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cols">Seats per row</Label>
          <Input
            id="cols"
            type="number"
            min={1}
            max={30}
            value={values.seatCols}
            onChange={(e) => set("seatCols", e.target.value)}
          />
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Seat map: <span className="text-foreground">{totalSeats} seats</span> labelled A1 …{" "}
        {String.fromCharCode(64 + Math.max(1, Number(values.seatRows || 1)))}
        {values.seatCols || 1}
      </p>

      <div className="space-y-2">
        <Label>Status</Label>
        <div className="flex flex-wrap gap-2">
          {(["PUBLISHED", "DRAFT", "CANCELLED"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => set("status", s)}
              className={cn(
                "rounded-full border px-3 py-1 text-sm transition-colors",
                values.status === s
                  ? "border-primary bg-primary/15 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" size="lg" className="w-full" disabled={saving}>
        {saving ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
