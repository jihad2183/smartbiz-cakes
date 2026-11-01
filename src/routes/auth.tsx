import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/hooks/use-language";
import { DeliveryLocationMap } from "@/components/DeliveryLocationMap";
import {
  getCurrentDeviceLocation,
  isValidDeliveryCoordinates,
  reverseGeocodeLocation,
  clearPendingProfileLocation,
  savePendingProfileLocation,
  type DeliveryCoordinates,
} from "@/lib/delivery-location";

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
  const [location, setLocation] = useState<DeliveryCoordinates | null>(null);
  const [locationAddress, setLocationAddress] = useState("");
  const [locationStatus, setLocationStatus] = useState<
    "idle" | "detecting" | "ready" | "denied" | "unavailable" | "timeout" | "unsupported" | "error"
  >("idle");
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeUnavailable, setGeocodeUnavailable] = useState(false);
  const locationRequestId = useRef(0);
  const locationRequest = useRef<Promise<void> | null>(null);
  const automaticLocationStarted = useRef(false);
  const selectedLocationRef = useRef(location);
  const locationAddressRef = useRef(locationAddress);
  selectedLocationRef.current = location;
  locationAddressRef.current = locationAddress;

  const requestCurrentLocation = useCallback(() => {
    const requestId = ++locationRequestId.current;
    setLocationStatus("detecting");
    const request = getCurrentDeviceLocation()
      .then((currentLocation) => {
        if (requestId !== locationRequestId.current) return;
        selectedLocationRef.current = currentLocation;
        setLocation(currentLocation);
        locationAddressRef.current = "";
        setLocationAddress("");
        setGeocodeUnavailable(false);
        setLocationStatus("ready");
      })
      .catch((error: unknown) => {
        if (requestId !== locationRequestId.current) return;
        const status =
          error instanceof Error &&
          ["denied", "unavailable", "timeout", "unsupported"].includes(error.message)
            ? (error.message as "denied" | "unavailable" | "timeout" | "unsupported")
            : "error";
        setLocationStatus(status);
      })
      .finally(() => {
        if (locationRequest.current === request) locationRequest.current = null;
      });
    locationRequest.current = request;
    return request;
  }, []);

  useEffect(() => {
    if (mode !== "up" || automaticLocationStarted.current) return;
    automaticLocationStarted.current = true;
    void requestCurrentLocation();
  }, [mode, requestCurrentLocation]);

  useEffect(() => {
    if (!isValidDeliveryCoordinates(location)) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setGeocoding(true);
      setGeocodeUnavailable(false);
      void reverseGeocodeLocation(location, controller.signal)
        .then((address) => {
          locationAddressRef.current = address ?? "";
          setLocationAddress(address ?? "");
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          console.error("Could not look up the selected signup location.", error);
          setGeocodeUnavailable(true);
        })
        .finally(() => {
          if (!controller.signal.aborted) setGeocoding(false);
        });
    }, 500);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
      setGeocoding(false);
    };
  }, [location]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "up") {
      if (locationRequest.current) {
        await locationRequest.current;
      } else if (locationStatus === "idle") {
        await requestCurrentLocation();
      }
      const signupLocation = selectedLocationRef.current;
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            full_name: name,
            referral_code: new URLSearchParams(window.location.search).get("ref")?.trim() ?? "",
            ...(isValidDeliveryCoordinates(signupLocation)
              ? {
                  location_latitude: String(signupLocation.latitude),
                  location_longitude: String(signupLocation.longitude),
                  location_address: locationAddressRef.current || null,
                }
              : {}),
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
    <main className="auth-page mx-auto max-w-sm px-4 py-16">
      <h1 className="text-3xl">{mode === "in" ? t("welcomeBack") : t("createAccount")}</h1>
      <form onSubmit={submit} className="auth-form mt-6 space-y-3">
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
        className="mobile-google-login mt-3 w-full"
        type="button"
        onClick={async () => {
          clearPendingProfileLocation();
          if (locationRequest.current) {
            await locationRequest.current;
          } else if (locationStatus === "idle") {
            await requestCurrentLocation();
          }
          const selectedLocation = selectedLocationRef.current;
          if (isValidDeliveryCoordinates(selectedLocation)) {
            if (!locationAddressRef.current) {
              const controller = new AbortController();
              const timeout = window.setTimeout(() => controller.abort(), 7000);
              try {
                const address = await reverseGeocodeLocation(selectedLocation, controller.signal);
                if (address) {
                  locationAddressRef.current = address;
                  setLocationAddress(address);
                }
              } catch (error) {
                if (!(error instanceof Error && error.name === "AbortError")) {
                  console.error("Could not look up the Google sign-in location.", error);
                }
              } finally {
                window.clearTimeout(timeout);
              }
            }
            try {
              savePendingProfileLocation(selectedLocation, locationAddressRef.current || null);
            } catch (error) {
              console.error("Could not keep the selected location for Google sign-in.", error);
              toast.error("Your selected location could not be saved for Google sign-in.");
              return;
            }
          }
          const redirectUrl = new URL("/", window.location.origin);
          const referralCode = new URLSearchParams(window.location.search).get("ref");
          if (referralCode) redirectUrl.searchParams.set("ref", referralCode);
          try {
            const { error } = await supabase.auth.signInWithOAuth({
              provider: "google",
              options: { redirectTo: redirectUrl.toString() },
            });
            if (error) throw error;
          } catch (error) {
            clearPendingProfileLocation();
            console.error("Google sign-in failed.", error);
            toast.error(
              error instanceof Error
                ? `Google sign-in failed: ${error.message}`
                : "Google sign-in failed",
            );
          }
        }}
      >
        {t("continueWithGoogle")}
      </Button>
      {mode === "up" && (
        <section className="mt-6 space-y-3 rounded-xl border p-4" aria-label="Signup location">
          <div>
            <h2 className="font-semibold">Your current location</h2>
            <p className="text-sm text-muted-foreground">
              Optional. We use your device location to suggest a default delivery location. You can
              adjust it on the map.
            </p>
          </div>
          {locationStatus === "detecting" && (
            <p role="status" className="text-sm text-muted-foreground">
              Detecting your location…
            </p>
          )}
          {locationStatus !== "idle" &&
            locationStatus !== "detecting" &&
            locationStatus !== "ready" && (
              <p role="status" className="text-sm text-amber-800">
                {locationStatus === "denied"
                  ? "Location permission was denied. You can still select a location manually."
                  : "Your location could not be detected. You can still select a location manually."}
              </p>
            )}
          <DeliveryLocationMap
            point={location}
            onPointChange={(point) => {
              locationRequestId.current += 1;
              selectedLocationRef.current = point;
              locationAddressRef.current = "";
              setLocation(point);
              setLocationAddress("");
              setGeocodeUnavailable(false);
              setLocationStatus("ready");
            }}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => void requestCurrentLocation()}
              disabled={locationStatus === "detecting"}
            >
              {locationStatus === "detecting" ? "Detecting…" : "Use My Current Location"}
            </Button>
          </div>
          <p aria-live="polite" className="text-sm text-muted-foreground">
            {location
              ? `Selected: ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`
              : "Tap the map or drag the marker to select a location."}
          </p>
          {geocoding && (
            <p role="status" className="text-sm text-muted-foreground">
              Looking up address…
            </p>
          )}
          {locationAddress && (
            <p className="rounded-lg bg-secondary/50 p-3 text-sm">
              <span className="font-medium">Readable location: </span>
              {locationAddress}
            </p>
          )}
          {geocodeUnavailable && (
            <p className="text-sm text-muted-foreground">
              A readable address is unavailable. Your coordinates can still be saved.
            </p>
          )}
        </section>
      )}
      <button
        type="button"
        className="mt-4 text-sm text-primary"
        onClick={() => setMode(mode === "in" ? "up" : "in")}
      >
        {mode === "in" ? t("newHere") : t("alreadyAccount")}
      </button>
    </main>
  );
}
