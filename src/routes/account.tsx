import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgePercent,
  ClipboardList,
  CircleHelp,
  Languages,
  LogOut,
  Pencil,
  UserRound,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/hooks/use-language";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "My account | Smart Cake Shop" },
      { name: "description", content: "Manage your Smart Cake Shop account and preferences." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AccountPage,
});

function AccountPage() {
  const { user, loading } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [avatar, setAvatar] = useState<string | null>(null);
  const {
    data: profile,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["my-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error: queryError } = await supabase
        .from("profiles")
        .select("full_name,email,phone,address,avatar_url,referral_code")
        .eq("id", user!.id)
        .maybeSingle();
      if (queryError) throw queryError;
      return data;
    },
  });
  const { data: referralCount, error: referralError } = useQuery({
    queryKey: ["my-referral-count", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { count, error: referralError } = await supabase
        .from("customer_referrals")
        .select("id", { count: "exact", head: true })
        .eq("referrer_user_id", user!.id);
      if (referralError) throw referralError;
      return count ?? 0;
    },
  });
  const [inviteUrl, setInviteUrl] = useState("");

  useEffect(() => {
    if (!profile?.referral_code) {
      setInviteUrl("");
      return;
    }
    const url = new URL("/auth", window.location.origin);
    url.searchParams.set("ref", profile.referral_code);
    setInviteUrl(url.toString());
  }, [profile?.referral_code]);

  useEffect(() => {
    let active = true;
    if (!profile?.avatar_url) {
      setAvatar(null);
      return;
    }
    void supabase.storage
      .from("profile-photos")
      .createSignedUrl(profile.avatar_url, 60 * 60)
      .then(({ data, error: signedError }) => {
        if (signedError) throw signedError;
        if (active) setAvatar(data.signedUrl);
      })
      .catch((signedError: unknown) => {
        console.error("Could not load the profile photo.", signedError);
        toast.error("Your profile photo could not be loaded.");
      });
    return () => {
      active = false;
    };
  }, [profile?.avatar_url]);

  const signOut = async () => {
    if (!window.confirm("Are you sure you want to log out?")) return;
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      toast.error(signOutError.message);
      return;
    }
    await queryClient.cancelQueries();
    queryClient.clear();
    navigate({ to: "/", replace: true });
  };

  const shareInvite = async () => {
    if (!inviteUrl) return;
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Join Smart Cake Shop",
          text: "Discover delicious cakes at Smart Cake Shop.",
          url: inviteUrl,
        });
      } else {
        await navigator.clipboard.writeText(inviteUrl);
        toast.success("Invitation link copied.");
      }
    } catch (shareError) {
      if (shareError instanceof DOMException && shareError.name === "AbortError") return;
      try {
        await navigator.clipboard.writeText(inviteUrl);
        toast.success("Invitation link copied.");
      } catch {
        toast.error("The invitation link could not be shared or copied.");
      }
    }
  };

  if (loading) return <main className="mx-auto max-w-3xl px-4 py-10">{t("loadingAccount")}</main>;
  if (!user) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="font-display text-4xl">{t("myAccountTitle")}</h1>
        <p className="mt-3 text-muted-foreground">{t("signInToContinue")}</p>
        <Button asChild className="mt-5">
          <Link to="/auth">{t("signIn")}</Link>
        </Button>
      </main>
    );
  }

  const sections = [
    { to: "/account" as const, label: t("accountDetails"), icon: UserRound },
    { to: "/edit-profile" as const, label: t("editProfile"), icon: Pencil },
    { to: "/orders" as const, label: t("myOrders"), icon: ClipboardList },
    { to: "/vouchers" as const, label: t("myVouchers"), icon: BadgePercent },
    { to: "/help" as const, label: t("helpCenter"), icon: CircleHelp },
  ];

  return (
    <main className="account-page mx-auto max-w-3xl px-4 py-8 sm:py-10">
      <header className="account-profile-header flex items-center gap-4 rounded-2xl bg-card p-5 shadow-soft sm:p-7">
        {avatar ? (
          <img
            src={avatar}
            alt=""
            className="account-profile-avatar h-20 w-20 rounded-full border object-cover"
          />
        ) : (
          <div className="account-profile-avatar grid h-20 w-20 place-items-center rounded-full bg-secondary text-cocoa">
            <UserRound className="h-9 w-9" />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="truncate font-display text-3xl">{t("myAccountTitle")}</h1>
          <p className="mt-1 truncate font-medium">{profile?.full_name || user.email}</p>
          <p className="truncate text-sm text-muted-foreground">{user.email}</p>
        </div>
      </header>

      {isLoading ? (
        <p className="mt-5" role="status">
          {t("loadingAccount")}
        </p>
      ) : error ? (
        <p className="mt-5 text-destructive" role="alert">
          Account details could not be loaded. Please try again.
        </p>
      ) : (
        <section className="account-details-card mt-5 rounded-2xl bg-card p-5 shadow-soft sm:p-7">
          <h2 className="text-xl font-semibold">{t("accountDetails")}</h2>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">{t("fullName")}</dt>
              <dd className="mt-1 font-medium">{profile?.full_name || "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t("emailAddress")}</dt>
              <dd className="mt-1 break-all font-medium">{user.email}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t("phoneNumber")}</dt>
              <dd className="mt-1 font-medium">{profile?.phone || "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t("defaultDeliveryAddress")}</dt>
              <dd className="mt-1 font-medium">{profile?.address || "—"}</dd>
            </div>
          </dl>
        </section>
      )}

      <nav
        aria-label={t("myAccountTitle")}
        className="account-actions mt-5 grid gap-3 sm:grid-cols-2"
      >
        {sections.map(({ to, label, icon: Icon }) => (
          <Link
            key={label}
            to={to}
            className="flex min-h-14 items-center gap-3 rounded-xl border bg-card px-4 py-3 font-medium transition hover:border-primary"
          >
            <Icon className="h-5 w-5 text-primary" />
            {label}
          </Link>
        ))}
        <Link
          to="/help"
          hash="requests"
          className="flex min-h-14 items-center gap-3 rounded-xl border bg-card px-4 py-3 font-medium transition hover:border-primary"
        >
          <ClipboardList className="h-5 w-5 text-primary" />
          {t("trackRequest")}
        </Link>
        <a
          href="#invite-friends"
          className="flex min-h-14 items-center gap-3 rounded-xl border bg-card px-4 py-3 font-medium transition hover:border-primary"
        >
          <Users className="h-5 w-5 text-primary" />
          {t("inviteFriends")}
        </a>
        <a
          href="#language"
          className="flex min-h-14 items-center gap-3 rounded-xl border bg-card px-4 py-3 font-medium transition hover:border-primary"
        >
          <Languages className="h-5 w-5 text-primary" />
          {t("language")}
        </a>
      </nav>

      <section
        id="invite-friends"
        className="account-invites mt-5 rounded-2xl bg-card p-5 shadow-soft sm:p-7"
      >
        <h2 className="text-xl font-semibold">{t("inviteFriends")}</h2>
        {profile?.referral_code && (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              Share your personal link.{" "}
              {referralError
                ? "Your invitation count could not be loaded."
                : `${referralCount ?? 0} ${referralCount === 1 ? "person has" : "people have"} joined through your invitation.`}
            </p>
            {inviteUrl && (
              <code className="block break-all rounded-md bg-muted px-3 py-2 font-mono text-sm">
                {inviteUrl}
              </code>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="outline"
                disabled={!inviteUrl}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(inviteUrl);
                    toast.success(t("copied"));
                  } catch {
                    toast.error("Invitation link could not be copied.");
                  }
                }}
              >
                Copy Invitation Link
              </Button>
              <Button variant="outline" disabled={!inviteUrl} onClick={() => void shareInvite()}>
                {t("shareInvitation")}
              </Button>
            </div>
          </div>
        )}
      </section>

      <section
        id="language"
        className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-card p-5 shadow-soft sm:p-7"
      >
        <div>
          <h2 className="font-semibold">{t("language")}</h2>
          <p className="text-sm text-muted-foreground">{t("languageDescription")}</p>
        </div>
        <select
          aria-label={t("language")}
          className="h-10 rounded-md border border-input bg-background px-3"
          value={language}
          onChange={(event) => setLanguage(event.target.value === "bn" ? "bn" : "en")}
        >
          <option value="en">{t("english")}</option>
          <option value="bn">{t("bangla")}</option>
        </select>
      </section>

      <div className="mt-8 border-t pt-5">
        <Button
          variant="outline"
          className="border-destructive text-destructive hover:bg-destructive/10"
          onClick={() => void signOut()}
        >
          <LogOut className="mr-2 h-4 w-4" />
          {t("logout")}
        </Button>
      </div>
    </main>
  );
}
