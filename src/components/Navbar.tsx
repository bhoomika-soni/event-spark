import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Ticket, Menu } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/lib/auth";

function getInitials(name: string | null | undefined, email: string | null | undefined) {
  if (name?.trim()) {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }
  return (email?.[0] ?? "U").toUpperCase();
}

export function Navbar() {
  const { user, profile, isOrganizer, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await signOut();
    setOpen(false);
    navigate({ to: "/", replace: true });
  }

  const links = (
    <>
      <Link
        to="/events"
        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        activeProps={{ className: "text-foreground" }}
        onClick={() => setOpen(false)}
      >
        Events
      </Link>
      {user && (
        <Link
          to="/my-bookings"
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          activeProps={{ className: "text-foreground" }}
          onClick={() => setOpen(false)}
        >
          My bookings
        </Link>
      )}
      {user && (
        <Link
          to="/profile"
          className="text-sm text-muted-foreground transition-colors hover:text-foreground md:hidden"
          activeProps={{ className: "text-foreground" }}
          onClick={() => setOpen(false)}
        >
          My profile
        </Link>
      )}

      {isOrganizer && (
        <Link
          to="/organizer/dashboard"
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          activeProps={{ className: "text-foreground" }}
          onClick={() => setOpen(false)}
        >
          Organizer
        </Link>
      )}
    </>
  );

  return (
    <header className="sticky top-0 z-50 border-b border-border/80 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Ticket className="size-4" />
          </span>
          <span className="font-display text-lg font-bold tracking-tight">EventX</span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">{links}</nav>

        <div className="ml-auto hidden items-center gap-2 md:flex">
          {user ? (
            <>
              <Button variant="ghost" size="icon" className="rounded-full" asChild>
                <Link to="/profile" aria-label="My profile">
                  <Avatar className="size-8">
                    <AvatarImage src={profile?.signedAvatarUrl ?? undefined} alt="Profile" />
                    <AvatarFallback>
                      {getInitials(profile?.full_name, user.email)}
                    </AvatarFallback>
                  </Avatar>
                </Link>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/profile">My profile</Link>
              </Button>
              <Button variant="outline" size="sm" onClick={handleSignOut}>
                Sign out
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/login">Log in</Link>
              </Button>
              <Button size="sm" asChild>
                <Link to="/register">Sign up</Link>
              </Button>
            </>
          )}
        </div>


        <Button
          variant="ghost"
          size="icon"
          className="ml-auto md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          <Menu className="size-5" />
        </Button>
      </div>

      {open && (
        <div className="flex flex-col gap-4 border-t border-border px-4 py-4 md:hidden">
          {links}
          {user ? (
            <>
              <div className="flex items-center gap-3">
                <Avatar className="size-10">
                  <AvatarImage src={profile?.signedAvatarUrl ?? undefined} alt="Profile" />
                  <AvatarFallback>
                    {getInitials(profile?.full_name, user.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">
                    {profile?.full_name?.trim() || "EventX User"}
                  </span>
                  <span className="text-xs text-muted-foreground">{user.email}</span>
                </div>
              </div>
              <Button variant="ghost" size="sm" asChild className="justify-start">
                <Link to="/profile" onClick={() => setOpen(false)}>
                  My profile
                </Link>
              </Button>
              <Button variant="outline" size="sm" onClick={handleSignOut}>
                Sign out
              </Button>
            </>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" asChild className="flex-1">
                <Link to="/login" onClick={() => setOpen(false)}>
                  Log in
                </Link>
              </Button>
              <Button size="sm" asChild className="flex-1">
                <Link to="/register" onClick={() => setOpen(false)}>
                  Sign up
                </Link>
              </Button>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
