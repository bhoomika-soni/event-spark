import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Role = "USER" | "ORGANIZER";

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  signedAvatarUrl: string | null;
}

interface AuthValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: Role[];
  isOrganizer: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue>({
  user: null,
  session: null,
  profile: null,
  roles: [],
  isOrganizer: false,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const uid = session?.user.id;
    if (!uid) {
      setRoles([]);
      setProfile(null);
      return;
    }
    let cancelled = false;

    async function loadProfile() {
      const { data: profileRow, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, avatar_url")
        .eq("id", uid!)
        .maybeSingle();
      if (cancelled) return;
      if (error || !profileRow) {
        setProfile(null);
        return;
      }
      let signedAvatarUrl: string | null = null;
      if (profileRow.avatar_url) {
        const { data: signed } = await supabase.storage
          .from("avatars")
          .createSignedUrl(profileRow.avatar_url, 60 * 60);
        signedAvatarUrl = signed?.signedUrl ?? null;
      }
      setProfile({ ...profileRow, signedAvatarUrl });
    }

    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", uid)
      .then(({ data }) => {
        if (!cancelled) setRoles((data ?? []).map((r) => r.role as Role));
      });

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [session?.user.id]);

  const value: AuthValue = {
    user: session?.user ?? null,
    session,
    profile,
    roles,
    isOrganizer: roles.includes("ORGANIZER"),
    loading,
    signOut: async () => {
      await supabase.auth.signOut();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
