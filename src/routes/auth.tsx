import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in | Smart Cake Shop" }, { name: "description", content: "Sign in or register to order Smart Cake Shop cakes." }, { property: "og:title", content: "Sign in | Smart Cake Shop" }, { property: "og:description", content: "Sign in or register to order Smart Cake Shop cakes." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "up") {
      const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin, data: { full_name: name } } });
      if (error) { toast.error(error.message); return; }
      toast.success("Check your email to confirm your account.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { toast.error(error.message); return; }
      navigate({ to: "/" });
    }
  };

  return (
    <main className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-3xl">{mode === "in" ? "Welcome back" : "Create account"}</h1>
      <form onSubmit={submit} className="mt-6 space-y-3">
        {mode === "up" && <Input placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} required />}
        <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Input type="password" placeholder="Password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required />
        <Button className="w-full" type="submit">{mode === "in" ? "Sign in" : "Sign up"}</Button>
      </form>
      <Button variant="outline" className="mt-3 w-full" onClick={async () => {
        const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
        if (r.error) toast.error("Google sign-in failed");
      }}>Continue with Google</Button>
      <button className="mt-4 text-sm text-primary" onClick={() => setMode(mode === "in" ? "up" : "in")}>
        {mode === "in" ? "New here? Create an account" : "Have an account? Sign in"}
      </button>
    </main>
  );
}
