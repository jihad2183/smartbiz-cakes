import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ShoppingBag, Search, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { useCart } from "@/hooks/use-cart";
import { supabase } from "@/integrations/supabase/client";
import { useSiteContent } from "@/hooks/use-site-content";
import { useLanguage } from "@/hooks/use-language";

export function SiteHeader() {
  const { data: content = {} } = useSiteContent();
  const { user, isAdmin } = useAuth();
  const { count } = useCart();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const { data: avatarUrl, error: avatarError } = useQuery({
    queryKey: ["header-avatar", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("avatar_url")
        .eq("id", user!.id)
        .maybeSingle();
      if (profileError) throw profileError;
      if (!profile?.avatar_url) return null;
      const { data, error } = await supabase.storage
        .from("profile-photos")
        .createSignedUrl(profile.avatar_url, 60 * 60);
      if (error) throw error;
      return data.signedUrl;
    },
  });

  useEffect(() => {
    if (!avatarError) return;
    console.error("Could not load the profile photo in the site header.", avatarError);
    toast.error("Your profile photo could not be loaded.");
  }, [avatarError]);

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      await qc.cancelQueries();
      qc.clear();
      navigate({ to: "/auth", replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not sign out. Please try again.");
    }
  };

  return (
    <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
      {content["announcement"] && (
        <p className="bg-secondary px-4 py-2 text-center text-sm">{content["announcement"]}</p>
      )}
      <div className="site-header-inner mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3 sm:gap-4">
        <Link
          to="/"
          className="site-header-brand shrink-0 font-display text-xl font-semibold text-cocoa sm:text-2xl"
        >
          {content["shop_name"] || "Smart Cake"}
        </Link>
        <nav className="site-header-desktop-nav hidden gap-5 text-sm md:flex">
          <Link to="/cakes" search={{ q: "" }} className="hover:text-primary">
            {t("allCakes")}
          </Link>
          {user && (
            <Link to="/orders" className="hover:text-primary">
              {t("myOrders")}
            </Link>
          )}
          {user && (
            <Link to="/vouchers" className="hover:text-primary">
              {t("myVouchers")}
            </Link>
          )}
          {user && (
            <Link to="/account" className="hover:text-primary">
              {t("myAccount")}
            </Link>
          )}
          <Link to="/cart" className="flex items-center gap-1 hover:text-primary">
            {t("cart")}
            {count > 0 && <span className="text-xs text-muted-foreground">({count})</span>}
          </Link>
          {isAdmin && (
            <Link to="/admin" className="font-medium text-primary">
              {t("adminPanel")}
            </Link>
          )}
        </nav>
        <form
          className="site-header-search relative order-3 w-full sm:order-none sm:ml-auto sm:w-56 md:w-64"
          onSubmit={(e) => {
            e.preventDefault();
            navigate({ to: "/cakes", search: { q } });
          }}
        >
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("searchCakes")}
            className="pl-9"
          />
        </form>
        <Link
          to="/cart"
          className="site-header-cart relative shrink-0 rounded-full p-2 hover:bg-muted"
          aria-label={t("cart")}
        >
          <ShoppingBag className="h-5 w-5" />
          {count > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid h-5 w-5 place-items-center rounded-full bg-primary text-[10px] text-primary-foreground">
              {count}
            </span>
          )}
        </Link>
        {user ? (
          <div className="site-header-account flex shrink-0 items-center gap-2">
            <Link
              to="/account"
              aria-label={t("myAccount")}
              className="grid h-9 w-9 place-items-center overflow-hidden rounded-full border bg-secondary"
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <UserRound className="h-5 w-5 text-cocoa" />
              )}
            </Link>
            <Button variant="outline" size="sm" onClick={signOut}>
              {t("signOut")}
            </Button>
          </div>
        ) : (
          <Button asChild size="sm" className="site-header-account shrink-0">
            <Link to="/auth">{t("signIn")}</Link>
          </Button>
        )}
      </div>
      <nav className="site-header-mobile-nav flex flex-wrap gap-x-4 gap-y-2 px-4 pb-2 text-sm md:hidden">
        <Link to="/cakes" search={{ q: "" }}>
          {t("allCakes")}
        </Link>
        {user && <Link to="/orders">{t("myOrders")}</Link>}
        {user && <Link to="/vouchers">{t("myVouchers")}</Link>}
        {user && <Link to="/account">{t("myAccount")}</Link>}
        <Link to="/cart">
          {t("cart")}
          {count > 0 && ` (${count})`}
        </Link>
        {isAdmin && (
          <Link to="/admin" className="text-primary">
            {t("adminPanel")}
          </Link>
        )}
      </nav>
    </header>
  );
}
