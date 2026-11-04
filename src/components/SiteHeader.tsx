import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MapPin, ShoppingBag, Search, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { BrandLogo } from "@/components/BrandLogo";
import { DeliveryLocationSelector } from "@/components/DeliveryLocationSelector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { useCart } from "@/hooks/use-cart";
import { supabase } from "@/integrations/supabase/client";
import { useSiteContent } from "@/hooks/use-site-content";
import { useLanguage } from "@/hooks/use-language";
import { useSelectedDeliveryLocation } from "@/hooks/use-selected-delivery-location";
import { isValidDeliveryCoordinates } from "@/lib/delivery-location";

export function SiteHeader() {
  const { data: content = {} } = useSiteContent();
  const { user } = useAuth();
  const { count } = useCart();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);
  const [requestLocationOnOpen, setRequestLocationOnOpen] = useState(false);
  const syncingLocation = useRef<string | null>(null);
  const { location, loaded: locationLoaded, setLocation } = useSelectedDeliveryLocation();
  const {
    data: savedLocation,
    isLoading: savedLocationLoading,
    error: savedLocationError,
  } = useQuery({
    queryKey: ["header-delivery-location", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("location_latitude,location_longitude,location_address")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
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

  useEffect(() => {
    if (!savedLocationError) return;
    console.error("Could not load the saved delivery location.", savedLocationError);
    toast.error("Your saved delivery location could not be loaded.");
  }, [savedLocationError]);

  useEffect(() => {
    if (!locationLoaded || location || !savedLocation) return;
    const point = {
      latitude: savedLocation.location_latitude ?? Number.NaN,
      longitude: savedLocation.location_longitude ?? Number.NaN,
    };
    if (!isValidDeliveryCoordinates(point)) return;
    try {
      setLocation({
        ...point,
        address: savedLocation.location_address ?? "",
      });
    } catch (error) {
      console.error("Could not load the saved delivery location.", error);
      toast.error("Your saved delivery location could not be loaded.");
    }
  }, [location, locationLoaded, savedLocation, setLocation]);

  useEffect(() => {
    if (!user || !location || savedLocationLoading || !savedLocation) return;
    if (
      savedLocation.location_latitude === location.latitude &&
      savedLocation.location_longitude === location.longitude &&
      (savedLocation.location_address ?? "") === location.address
    ) {
      return;
    }
    const fingerprint = `${user.id}:${location.latitude}:${location.longitude}:${location.address}`;
    if (syncingLocation.current === fingerprint) return;
    syncingLocation.current = fingerprint;
    void (async () => {
      try {
        const { error } = await supabase
          .from("profiles")
          .update({
            location_latitude: location.latitude,
            location_longitude: location.longitude,
            location_address: location.address || null,
            location_updated_at: new Date().toISOString(),
          })
          .eq("id", user.id);
        if (error) throw error;
        await qc.invalidateQueries({ queryKey: ["header-delivery-location", user.id] });
        await qc.invalidateQueries({ queryKey: ["checkout-profile", user.id] });
        await qc.invalidateQueries({ queryKey: ["my-profile", user.id] });
      } catch (error) {
        console.error(
          "Could not sync the selected delivery location to the customer profile.",
          error,
        );
        toast.error("Your selected location could not be saved to your profile.");
      } finally {
        if (syncingLocation.current === fingerprint) syncingLocation.current = null;
      }
    })();
  }, [location, qc, savedLocation, savedLocationLoading, user]);

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
    <header className="site-header sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
      {content["announcement"] && (
        <p className="bg-secondary px-4 py-2 text-center text-sm">{content["announcement"]}</p>
      )}
      <div className="site-header-inner mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3 sm:gap-4">
        <Link to="/" className="site-header-brand shrink-0" aria-label="Smart Cake Shop home">
          <BrandLogo name={content["shop_name"] || "Smart Cake Shop"} compact />
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
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 pb-3">
        {location ? (
          <div className="flex min-w-0 items-center gap-2 text-sm">
            <MapPin className="h-4 w-4 shrink-0 text-primary" />
            <span
              className="max-w-[min(60vw,36rem)] truncate"
              title={location.address || undefined}
            >
              {location.address || "Delivery location selected"}
            </span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setRequestLocationOnOpen(false);
                setLocationDialogOpen(true);
              }}
            >
              Change Location
            </Button>
          </div>
        ) : locationLoaded && (!user || !savedLocationLoading) ? (
          <div className="flex w-full flex-wrap items-center gap-2 rounded-lg bg-secondary/60 p-2 text-sm">
            <span className="mr-auto">Allow Location Access to find your delivery location.</span>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setRequestLocationOnOpen(true);
                setLocationDialogOpen(true);
              }}
            >
              Allow Location
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setRequestLocationOnOpen(false);
                setLocationDialogOpen(true);
              }}
            >
              Select Location Manually
            </Button>
          </div>
        ) : null}
      </div>
      <DeliveryLocationSelector
        open={locationDialogOpen}
        onOpenChange={(open) => {
          setLocationDialogOpen(open);
          if (!open) setRequestLocationOnOpen(false);
        }}
        requestLocationOnOpen={requestLocationOnOpen}
      />
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
      </nav>
    </header>
  );
}
