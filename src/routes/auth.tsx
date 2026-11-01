import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/hooks/use-language";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in | Smart Cake Shop" },
      { name: "description", content: "Sign in or register to order Smart Cake Shop cakes." },
      { property: "og:title", content: "Sign in | Smart Cake Shop" },
      {
        property: "og:description",
        content: "Sign in or register to order Smart Cake Shop cakes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "up") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            full_name: name,
            referral_code: new URLSearchParams(window.location.search).get("ref")?.trim() ?? "",
          },
        },
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success(t("checkEmail"));
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast.error(error.message);
        return;
      }
      navigate({ to: "/" });
    }
  };

  return (
    <main className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-3xl">{mode === "in" ? t("welcomeBack") : t("createAccount")}</h1>
      <form onSubmit={submit} className="mt-6 space-y-3">
        {mode === "up" && (
          <Input
            placeholder={t("fullName")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        )}
        <Input
          type="email"
          placeholder={t("emailAddress")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Input
          type="password"
          placeholder={t("password")}
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <Button className="w-full" type="submit">
          {mode === "in" ? t("signIn") : t("createAccount")}
        </Button>
      </form>
      <Button
        variant="outline"
        className="mt-3 w-full"
        type="button"
        onClick={async () => {
          const redirectUrl = new URL("/", window.location.origin);
          const referralCode = new URLSearchParams(window.location.search).get("ref");
          if (referralCode) redirectUrl.searchParams.set("ref", referralCode);
          const r = await lovable.auth.signInWithOAuth("google", {
            redirect_uri: redirectUrl.toString(),
          });
          if (r.error) toast.error("Google sign-in failed");
        }}
      >
        {t("continueWithGoogle")}
      </Button>
      <button
        className="mt-4 text-sm text-primary"
        onClick={() => setMode(mode === "in" ? "up" : "in")}
      >
        {mode === "in" ? t("newHere") : t("alreadyAccount")}
      </button>
    </main>
  );
}
