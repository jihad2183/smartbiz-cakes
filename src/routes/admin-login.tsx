import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/admin-login")({
  head: () => ({
    meta: [
      { title: "Admin login | Smart Cake Shop" },
      { name: "description", content: "Sign in to the Smart Cake Shop admin portal." },
      { property: "og:title", content: "Admin login | Smart Cake Shop" },
      { property: "og:description", content: "Administrator sign-in for Smart Cake Shop." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminLogin,
});

function AdminLogin() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (!data.user) throw new Error("Supabase sign-in returned no user.");

      const roleCheck = await refresh();
      if (roleCheck.error) {
        toast.error(
          `Signed in, but administrator access could not be verified: ${roleCheck.error}`,
        );
        return;
      }
      if (!roleCheck.isAdmin) {
        toast.error("This account is not an approved administrator.");
        return;
      }

      toast.success("Welcome to the admin portal");
      await navigate({ to: "/admin", replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sign-in failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-sm px-4 py-16">
      <ShieldCheck className="mb-3 h-10 w-10 text-primary" />
      <h1 className="text-3xl">Admin portal login</h1>
      <p className="mt-2 text-sm text-muted-foreground">Only approved administrators can enter.</p>
      <form onSubmit={submit} className="mt-6 space-y-3">
        <Input
          type="email"
          placeholder="Admin email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <Button className="w-full" type="submit" disabled={busy}>
          {busy ? "Verifying…" : "Sign in as admin"}
        </Button>
      </form>
    </main>
  );
}
