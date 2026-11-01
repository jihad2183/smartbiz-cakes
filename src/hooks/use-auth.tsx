import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { consumePendingProfileLocation } from "@/lib/delivery-location";
import { toast } from "sonner";

type RoleCheck = { isAdmin: boolean; error: string | null };
const isMissingSession = (error: unknown) =>
  error instanceof Error && error.name === "AuthSessionMissingError";

type AuthCtx = {
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
  roleError: string | null;
  refresh: () => Promise<RoleCheck>;
};
const Ctx = createContext<AuthCtx>({
  user: null,
  isAdmin: false,
  loading: true,
  roleError: null,
  refresh: async () => ({ isAdmin: false, error: null }),
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [roleError, setRoleError] = useState<string | null>(null);
  const loadSequence = useRef(0);

  const load = async (u: User | null, sequence = ++loadSequence.current): Promise<RoleCheck> => {
    if (sequence !== loadSequence.current) return { isAdmin: false, error: null };
    setUser(u);
    if (!u) {
      setIsAdmin(false);
      setRoleError(null);
      setLoading(false);
      return { isAdmin: false, error: null };
    }

    try {
      const { data, error } = await supabase.rpc("has_role", {
        _user_id: u.id,
        _role: "admin",
      });
      if (error) throw error;

      const verifiedAdmin = data === true;
      if (sequence === loadSequence.current) {
        setIsAdmin(verifiedAdmin);
        setRoleError(null);
      }
      return { isAdmin: verifiedAdmin, error: null };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Administrator access could not be verified.";
      console.error("Could not verify administrator role.", error);
      if (sequence === loadSequence.current) {
        setIsAdmin(false);
        setRoleError(message);
      }
      return { isAdmin: false, error: message };
    } finally {
      if (sequence === loadSequence.current) setLoading(false);
    }
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        event === "INITIAL_SESSION" ||
        event === "SIGNED_IN" ||
        event === "SIGNED_OUT" ||
        event === "USER_UPDATED"
      ) {
        const sequence = ++loadSequence.current;
        setTimeout(() => {
          if ((event === "INITIAL_SESSION" || event === "SIGNED_IN") && session?.user) {
            const pendingLocation = consumePendingProfileLocation();
            if (pendingLocation) {
              void (async () => {
                try {
                  const { error } = await supabase.rpc("save_profile_location_if_missing", {
                    _latitude: pendingLocation.latitude,
                    _longitude: pendingLocation.longitude,
                    _address: pendingLocation.address,
                  });
                  if (error) throw error;
                } catch (error: unknown) {
                  console.error("Could not save the selected Google signup location.", error);
                  toast.error("Your account is ready, but its location could not be saved.");
                }
              })();
            }
          }
          void load(session?.user ?? null, sequence);
        }, 0);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const refresh = async (): Promise<RoleCheck> => {
    try {
      const { data, error } = await supabase.auth.getUser();
      if (isMissingSession(error)) {
        return {
          isAdmin: false,
          error: "No active sign-in session was found. Please sign in again.",
        };
      }
      if (error) throw error;
      return load(data.user);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Your sign-in session could not be verified.";
      console.error("Could not refresh the sign-in session.", error);
      setIsAdmin(false);
      setRoleError(message);
      setLoading(false);
      return { isAdmin: false, error: message };
    }
  };

  return (
    <Ctx.Provider value={{ user, isAdmin, loading, roleError, refresh }}>{children}</Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
