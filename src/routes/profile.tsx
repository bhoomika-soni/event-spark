import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Camera, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/lib/auth";
import { formatMoney } from "@/lib/format";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "My profile — EventX" },
      {
        name: "description",
        content:
          "Manage your EventX profile picture, review your spending and event profit and loss, and switch accounts.",
      },
      { property: "og:title", content: "My profile — EventX" },
      { property: "og:description", content: "Profile picture, booking spend and event profit & loss." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
});

const PIE_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

function ProfilePage() {
  const { user, isOrganizer, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login", replace: true });
  }, [loading, user, navigate]);

  const profileQuery = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, avatar_url")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      let signedUrl: string | null = null;
      if (data?.avatar_url) {
        const { data: signed } = await supabase.storage
          .from("avatars")
          .createSignedUrl(data.avatar_url, 60 * 60);
        signedUrl = signed?.signedUrl ?? null;
      }
      return { ...data, signedUrl };
    },
  });

  const statsQuery = useQuery({
    queryKey: ["profile-stats", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: myBookings, error } = await supabase
        .from("bookings")
        .select("id, event_id, total_cents, status, user_id")
        .eq("user_id", user!.id);
      if (error) throw error;

      const { data: myEvents, error: eErr } = await supabase
        .from("events")
        .select("id, title, starts_at, price_cents")
        .eq("organizer_id", user!.id);
      if (eErr) throw eErr;

      const eventIds = (myEvents ?? []).map((e) => e.id);
      let eventBookings: { event_id: string; total_cents: number; status: string }[] = [];
      let eventSeats: { event_id: string; price_cents: number }[] = [];
      if (eventIds.length > 0) {
        const { data, error: bErr } = await supabase
          .from("bookings")
          .select("event_id, total_cents, status")
          .in("event_id", eventIds);
        if (bErr) throw bErr;
        eventBookings = data ?? [];

        const { data: seats, error: sErr } = await supabase
          .from("seats")
          .select("event_id, price_cents")
          .in("event_id", eventIds);
        if (sErr) throw sErr;
        eventSeats = seats ?? [];
      }

      return { myBookings: myBookings ?? [], myEvents: myEvents ?? [], eventBookings, eventSeats };
    },
  });

  async function handleAvatar(file: File) {
    if (!user) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please pick an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5 MB");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { error: dbErr } = await supabase
        .from("profiles")
        .update({ avatar_url: path })
        .eq("id", user.id);
      if (dbErr) throw dbErr;
      await queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
      toast.success("Profile picture updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not upload picture");
    } finally {
      setUploading(false);
    }
  }

  async function handleSignOut(to: "/" | "/login") {
    await queryClient.cancelQueries();
    queryClient.clear();
    await signOut();
    navigate({ to, replace: true });
  }

  if (loading || !user) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 px-4 py-12">
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const profile = profileQuery.data;
  const stats = statsQuery.data;

  const perEvent = (stats?.myEvents ?? []).map((e) => {
    const rows = (stats?.eventBookings ?? []).filter((b) => b.event_id === e.id);
    const earned = rows
      .filter((b) => b.status === "CONFIRMED")
      .reduce((s, b) => s + b.total_cents, 0);
    // Full house value = every seat of this event sold at its price
    const potential = (stats?.eventSeats ?? [])
      .filter((s) => s.event_id === e.id)
      .reduce((s, seat) => s + seat.price_cents, 0);
    // Unsold (including seats freed by cancellations) is the money left on the table
    const lost = Math.max(potential - earned, 0);
    return { id: e.id, title: e.title, earned, potential, lost, net: earned - lost };
  });

  const pieData = perEvent.filter((e) => e.earned > 0).map((e) => ({
    name: e.title,
    value: e.earned / 100,
  }));
  const totalEarned = perEvent.reduce((s, e) => s + e.earned, 0);
  const totalLost = perEvent.reduce((s, e) => s + e.lost, 0);
  const totalPotential = perEvent.reduce((s, e) => s + e.potential, 0);

  const initials = (profile?.full_name || user.email || "U").slice(0, 2).toUpperCase();

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <div className="panel flex flex-wrap items-center gap-6 p-6">
        <div className="relative">
          <Avatar className="size-20 border border-border">
            {profile?.signedUrl ? <AvatarImage src={profile.signedUrl} alt="Profile picture" /> : null}
            <AvatarFallback className="font-display text-lg">{initials}</AvatarFallback>
          </Avatar>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            aria-label="Change profile picture"
            className="absolute -bottom-1 -right-1 flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow disabled:opacity-60"
          >
            <Camera className="size-4" />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleAvatar(f);
              e.target.value = "";
            }}
          />
        </div>

        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold">{profile?.full_name || "My profile"}</h1>
          <p className="truncate text-sm text-muted-foreground">{user.email}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {isOrganizer ? "Organizer account" : "Attendee account"}
            {uploading ? " · uploading picture…" : ""}
          </p>
        </div>

        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => handleSignOut("/")}>
            <LogOut className="size-4" /> Sign out
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Event earnings" value={formatMoney(totalEarned)} />
        <Stat label="Full house value" value={formatMoney(totalPotential)} />
        <Stat label="Loss on unsold seats" value={formatMoney(totalLost)} tone="down" />
        <Stat
          label="Net profit / loss"
          value={formatMoney(totalEarned - totalLost)}
          tone={totalEarned - totalLost >= 0 ? "up" : "down"}
        />
      </div>

      <div className="panel mt-6 p-6">
        <h2 className="font-display text-lg font-semibold">Revenue share by event</h2>
        {statsQuery.isLoading ? (
          <Skeleton className="mt-6 h-64 rounded-xl" />
        ) : pieData.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            No event earnings yet.{" "}
            <Link to="/organizer/events/create" className="text-primary underline-offset-4 hover:underline">
              Host an event
            </Link>{" "}
            to start tracking profit and loss.
          </p>
        ) : (
          <div className="mt-6 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={100} innerRadius={50}>
                  {pieData.map((entry, i) => (
                    <Cell key={entry.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Legend />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-popover)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "0.5rem",
                    color: "var(--color-foreground)",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {perEvent.length > 0 && (
        <div className="panel mt-6 p-6">
          <h2 className="font-display text-lg font-semibold">Profit & loss by event</h2>
          <ul className="mt-4 divide-y divide-border text-sm">
            {perEvent.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <span className="font-medium">{e.title}</span>
                <span className="flex gap-4 text-muted-foreground">
                  <span>Earned {formatMoney(e.earned)}</span>
                  <span>Unsold loss {formatMoney(e.lost)}</span>
                  <span className={e.net >= 0 ? "text-success" : "text-destructive"}>
                    Net {formatMoney(e.net)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "up" | "down" }) {
  return (
    <div className="panel p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p
        className={`mt-2 font-display text-2xl font-bold ${
          tone === "up" ? "text-success" : tone === "down" ? "text-destructive" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}
