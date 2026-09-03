import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { credentialsSchema } from "@/lib/validation";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Log in — EventX" },
      { name: "description", content: "Log in to EventX to book seats and view your QR tickets." },
      { property: "og:title", content: "Log in — EventX" },
      { property: "og:description", content: "Log in to book seats and view your tickets." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const emailNotConfirmed = error?.toLowerCase().includes("email not confirmed") ?? false;

  async function resendConfirmation() {
    const parsed = credentialsSchema.shape.email.safeParse(email);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Enter a valid email");
      return;
    }
    setResending(true);
    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email: parsed.data,
      options: { emailRedirectTo: `${window.location.origin}/events` },
    });
    setResending(false);
    if (resendError) {
      setError(resendError.message);
      return;
    }
    setError(null);
    toast.success("Confirmation email sent");
  }

  useEffect(() => {
    if (user) navigate({ to: "/events", replace: true });
  }, [user, navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = credentialsSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check your details");
      return;
    }
    setError(null);
    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithPassword(parsed.data);
    setLoading(false);
    if (authError) {
      setError(authError.message);
      return;
    }
    toast.success("Welcome back");
    navigate({ to: "/events" });
  }

  return (
    <div className="mx-auto flex max-w-md flex-col justify-center px-4 py-16">
      <h1 className="text-3xl font-bold">Log in</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Pick up where you left off — your seats are waiting.
      </p>
      <form onSubmit={onSubmit} className="panel mt-8 space-y-4 p-6">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>
        {error && (
          <div className="space-y-2">
            <p className="text-sm text-destructive">{error}</p>
            {emailNotConfirmed && (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={resending}
                onClick={resendConfirmation}
              >
                {resending ? "Sending…" : "Resend confirmation email"}
              </Button>
            )}
          </div>
        )}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Logging in…" : "Log in"}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          New here?{" "}
          <Link to="/register" className="text-primary hover:underline">
            Create an account
          </Link>
        </p>
      </form>
    </div>
  );
}
