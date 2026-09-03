import { cn } from "@/lib/utils";

export interface SeatInfo {
  seat_id: string;
  label: string;
  row_label: string;
  col_number: number;
  price_cents: number;
  status: "AVAILABLE" | "LOCKED" | "BOOKED";
  held_by_me: boolean;
}

interface SeatMapProps {
  seats: SeatInfo[];
  selected: string[];
  onToggle: (seatId: string) => void;
  disabled?: boolean;
}

export function SeatMap({ seats, selected, onToggle, disabled }: SeatMapProps) {
  const rows = seats.reduce<Record<string, SeatInfo[]>>((acc, seat) => {
    (acc[seat.row_label] ??= []).push(seat);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="mx-auto h-2 w-3/4 rounded-full bg-gradient-to-r from-transparent via-primary to-transparent opacity-70" />
      <p className="text-center text-xs uppercase tracking-[0.3em] text-muted-foreground">Stage</p>

      <div className="overflow-x-auto pb-2">
        <div className="mx-auto w-fit space-y-2">
          {Object.entries(rows).map(([rowLabel, rowSeats]) => (
            <div key={rowLabel} className="flex items-center gap-2">
              <span className="w-5 text-xs font-medium text-muted-foreground">{rowLabel}</span>
              <div className="flex gap-1.5">
                {rowSeats
                  .slice()
                  .sort((a, b) => a.col_number - b.col_number)
                  .map((seat) => {
                    const isSelected = selected.includes(seat.seat_id);
                    const isMine = seat.held_by_me;
                    const unavailable =
                      seat.status === "BOOKED" || (seat.status === "LOCKED" && !isMine);
                    return (
                      <button
                        key={seat.seat_id}
                        type="button"
                        aria-label={`Seat ${seat.label} — ${unavailable ? "unavailable" : "available"}`}
                        aria-pressed={isSelected}
                        disabled={unavailable || disabled}
                        onClick={() => onToggle(seat.seat_id)}
                        className={cn(
                          "size-7 rounded-md border text-[10px] font-medium transition-all sm:size-8",
                          isSelected
                            ? "border-primary bg-primary text-primary-foreground shadow-[0_0_0_3px_var(--color-primary)/20]"
                            : seat.status === "BOOKED"
                              ? "cursor-not-allowed border-border bg-seat-booked text-muted-foreground/40"
                              : seat.status === "LOCKED"
                                ? "cursor-not-allowed border-seat-locked/60 bg-seat-locked/30 text-muted-foreground"
                                : "border-border bg-seat-available text-foreground/80 hover:border-primary hover:bg-primary/20",
                        )}
                      >
                        {seat.col_number}
                      </button>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-4 text-xs text-muted-foreground">
        <Legend className="bg-seat-available border-border" label="Available" />
        <Legend className="bg-primary border-primary" label="Selected" />
        <Legend className="bg-seat-locked/40 border-seat-locked/60" label="Held by someone" />
        <Legend className="bg-seat-booked border-border" label="Booked" />
      </div>
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className={cn("size-3 rounded border", className)} />
      {label}
    </span>
  );
}
