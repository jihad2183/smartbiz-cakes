import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { CakeSlice, ClipboardList, Home, ShoppingBag, UserRound } from "lucide-react";
import { toast } from "sonner";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { CartProvider } from "@/hooks/use-cart";
import { LanguageProvider, useLanguage } from "@/hooks/use-language";
import { SiteHeader } from "@/components/SiteHeader";
import { Toaster } from "@/components/ui/sonner";
import { useSiteContent } from "@/hooks/use-site-content";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/hooks/use-cart";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Smart Cake Shop" },
      { name: "description", content: "Shop celebration cakes at Smart Cake Shop." },
      { property: "og:title", content: "Smart Cake Shop" },
      { property: "og:description", content: "Shop celebration cakes at Smart Cake Shop." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <OAuthCallbackNotice />
        <ReferralAttribution />
        <LanguageProvider>
          <CartProvider>
            <SiteHeader />
            <MobileBottomNavigation />
            <Outlet />
            <ShopFooter />
            <Toaster />
          </CartProvider>
        </LanguageProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

function MobileBottomNavigation() {
  const { count } = useCart();
  const { t } = useLanguage();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  if (pathname.startsWith("/admin")) return null;

  const active = (path: string) =>
    pathname === path || (path !== "/" && pathname.startsWith(`${path}/`));

  return (
    <nav className="mobile-bottom-nav" aria-label="Primary navigation">
      <Link
        to="/"
        aria-current={active("/") ? "page" : undefined}
        className={active("/") ? "is-active" : ""}
      >
        <Home aria-hidden="true" />
        <span>{t("home")}</span>
      </Link>
      <Link
        to="/cakes"
        search={{ q: "" }}
        aria-current={active("/cakes") ? "page" : undefined}
        className={active("/cakes") ? "is-active" : ""}
      >
        <CakeSlice aria-hidden="true" />
        <span>{t("allCakes")}</span>
      </Link>
      <Link
        to="/cart"
        aria-current={active("/cart") ? "page" : undefined}
        className={active("/cart") ? "is-active" : ""}
      >
        <span className="mobile-bottom-nav-icon">
          <ShoppingBag aria-hidden="true" />
          {count > 0 && <span className="mobile-bottom-nav-count">{count}</span>}
        </span>
        <span>{t("cart")}</span>
      </Link>
      <Link
        to="/orders"
        aria-current={active("/orders") ? "page" : undefined}
        className={active("/orders") ? "is-active" : ""}
      >
        <ClipboardList aria-hidden="true" />
        <span>{t("myOrders")}</span>
      </Link>
      <Link
        to="/account"
        aria-current={active("/account") ? "page" : undefined}
        className={active("/account") ? "is-active" : ""}
      >
        <UserRound aria-hidden="true" />
        <span>{t("myAccount")}</span>
      </Link>
    </nav>
  );
}

function OAuthCallbackNotice() {
  useEffect(() => {
    const url = new URL(window.location.href);
    const hashParams = new URLSearchParams(url.hash.slice(1));
    const callbackParams = [url.searchParams, hashParams];
    const hasCallbackError = callbackParams.some(
      (params) =>
        params.has("error") || params.has("error_code") || params.has("error_description"),
    );
    if (!hasCallbackError) return;

    window.setTimeout(
      () => toast.error("Google sign-in could not be completed. Please try again."),
      0,
    );
    for (const params of callbackParams) {
      params.delete("error");
      params.delete("error_code");
      params.delete("error_description");
    }
    hashParams.delete("sb");
    url.hash = hashParams.size > 0 ? hashParams.toString() : "";
    window.history.replaceState(window.history.state, "", url);
  }, []);

  return null;
}

function ReferralAttribution() {
  const { user, loading } = useAuth();
  const userId = user?.id;

  useEffect(() => {
    if (loading || !userId) return;
    const url = new URL(window.location.href);
    const referralCode = url.searchParams.get("ref");
    if (!referralCode) return;

    void supabase.rpc("record_customer_referral", { _code: referralCode }).then(({ error }) => {
      if (error) {
        console.error("Could not record the customer invitation.", error);
        toast.error("This invitation could not be recorded.");
        return;
      }
      url.searchParams.delete("ref");
      window.history.replaceState(window.history.state, "", url);
    });
  }, [loading, userId]);

  return null;
}

function ShopFooter() {
  const { data: content = {} } = useSiteContent();
  return (
    <footer className="mt-8 border-t">
      <div className="mx-auto flex max-w-6xl flex-wrap items-start justify-between gap-6 px-4 py-8">
        <div>
          <p className="font-display text-xl">{content["shop_name"] || "Smart Cake Shop"}</p>
          {content["footer_text"] && (
            <p className="mt-2 text-sm text-muted-foreground">{content["footer_text"]}</p>
          )}
          <p className="mt-2 text-sm">
            {content["contact_phone"]} {content["contact_email"]}
          </p>
          {content["shop_address"] && <p className="text-sm">{content["shop_address"]}</p>}
        </div>
      </div>
    </footer>
  );
}
