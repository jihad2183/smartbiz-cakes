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
import { BrandLogo } from "@/components/BrandLogo";
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
      {
        name: "description",
        content: "Beautifully crafted cakes for every celebration, made fresh at Smart Cake Shop.",
      },
      { name: "theme-color", content: "#FFF4E6" },
      { property: "og:title", content: "Smart Cake Shop" },
      {
        property: "og:description",
        content: "Beautifully crafted cakes for every celebration, made fresh at Smart Cake Shop.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "alternate icon", href: "/favicon.ico", type: "image/x-icon" },
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
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const isAdminPage = pathname.startsWith("/admin");
  const isHomePage = pathname === "/";

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <OAuthCallbackNotice />
        <ReferralAttribution />
        <LanguageProvider>
          <CartProvider>
            {!isAdminPage && <SiteHeader />}
            <MobileBottomNavigation />
            <Outlet />
            {isHomePage && <ShopFooter />}
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
  const isHttpsUrl = (value: string | undefined) => {
    if (!value) return false;
    try {
      return new URL(value).protocol === "https:";
    } catch {
      return false;
    }
  };
  const allowedSocialHosts = {
    Facebook: ["facebook.com", "fb.com"],
    Instagram: ["instagram.com"],
    YouTube: ["youtube.com", "youtu.be"],
  } as const;
  const socialLinks = (
    [
      { label: "Facebook", href: content["facebook_url"] },
      { label: "Instagram", href: content["instagram_url"] },
      { label: "YouTube", href: content["youtube_url"] },
    ] as const
  ).map((link) => {
    if (typeof link.href !== "string" || !isHttpsUrl(link.href)) {
      return { label: link.label, href: undefined };
    }
    const host = new URL(link.href).hostname;
    const allowedHosts = allowedSocialHosts[link.label];
    const isAllowedHost = allowedHosts.some(
      (domain) => host === domain || host.endsWith(`.${domain}`),
    );
    return { label: link.label, href: isAllowedHost ? link.href : undefined };
  });
  const policyLinks = [
    { label: "Privacy Policy", href: content["privacy_policy_url"] },
    { label: "Terms & Conditions", href: content["terms_url"] },
  ].filter((link) => isHttpsUrl(link.href));
  const footerDescription =
    "Your happiness is our inspiration. Discover delicious cakes and make every moment a little more special.";

  return (
    <footer className="site-footer mt-8 border-t">
      <div className="site-footer-grid mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-[1.35fr_repeat(3,1fr)] lg:py-12">
        <div className="site-footer-brand">
          <BrandLogo name={content["shop_name"] || "Smart Cake Shop"} />
          <p className="site-footer-tagline">Making Every Celebration Sweeter.</p>
          <p className="mt-4 max-w-md text-sm leading-6 text-muted-foreground">
            {footerDescription}
          </p>
          {content["footer_text"] && content["footer_text"] !== footerDescription && (
            <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              {content["footer_text"]}
            </p>
          )}
        </div>
        <nav className="site-footer-links" aria-label="Footer navigation">
          <h2 className="mb-3 text-base font-semibold">Quick Links</h2>
          <Link to="/">Home</Link>
          <Link to="/cakes" search={{ q: "" }}>
            All Cakes
          </Link>
          <a href="/#why-choose-us">About Us</a>
          <a href="/#contact">Contact Us</a>
        </nav>
        <div className="site-footer-support">
          <h2 className="mb-3 text-base font-semibold">Customer Support</h2>
          <a href="/#contact">Contact Information</a>
          {policyLinks.map((link) => (
            <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer">
              {link.label}
            </a>
          ))}
          {!policyLinks.some((link) => link.label === "Privacy Policy") && (
            <span>Privacy Policy</span>
          )}
          {!policyLinks.some((link) => link.label === "Terms & Conditions") && (
            <span>Terms &amp; Conditions</span>
          )}
          <div id="contact" className="site-footer-contact">
            {content["contact_phone"] && (
              <a href={`tel:${content["contact_phone"]}`}>{content["contact_phone"]}</a>
            )}
            {content["contact_email"] && (
              <a href={`mailto:${content["contact_email"]}`}>{content["contact_email"]}</a>
            )}
            {content["shop_address"] && <p>{content["shop_address"]}</p>}
          </div>
        </div>
        <div className="site-footer-social">
          <h2 className="mb-3 text-base font-semibold">Follow Us</h2>
          {socialLinks.map((link) =>
            link.href ? (
              <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer">
                {link.label}
              </a>
            ) : (
              <span key={link.label}>{link.label}</span>
            ),
          )}
        </div>
      </div>
      <div className="site-footer-bottom">
        <p className="mx-auto max-w-6xl px-4 py-4 text-xs text-muted-foreground">
          © 2026 Smart Cake Shop. All Rights Reserved.
        </p>
      </div>
    </footer>
  );
}
