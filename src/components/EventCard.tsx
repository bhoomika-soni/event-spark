import { Link } from "@tanstack/react-router";
import { CalendarDays, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatMoney } from "@/lib/format";

export interface EventListItem {
  id: string;
  title: string;
  category: string;
  starts_at: string;
  price_cents: number;
  status: string;
  venues: { name: string; city: string } | null;
}

export function EventCard({ event }: { event: EventListItem }) {
  return (
    <Link
      to="/events/$id"
      params={{ id: event.id }}
      className="panel group flex flex-col gap-3 p-5 transition-colors hover:border-primary/60"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-lg font-semibold leading-tight group-hover:text-primary">
          {event.title}
        </h3>
        <Badge variant="secondary" className="shrink-0">
          {event.category}
        </Badge>
      </div>
      <div className="space-y-1.5 text-sm text-muted-foreground">
        <p className="flex items-center gap-2">
          <CalendarDays className="size-4" />
          {formatDate(event.starts_at)}
        </p>
        <p className="flex items-center gap-2">
          <MapPin className="size-4" />
          {event.venues ? `${event.venues.name}, ${event.venues.city}` : "Venue TBA"}
        </p>
      </div>
      <div className="mt-auto flex items-center justify-between border-t border-border pt-3">
        <span className="text-sm text-muted-foreground">From</span>
        <span className="font-display text-lg font-semibold text-primary">
          {formatMoney(event.price_cents)}
        </span>
      </div>
    </Link>
  );
}
