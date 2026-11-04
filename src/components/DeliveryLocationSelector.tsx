import { useEffect, useRef, useState } from "react";
import { LocateFixed, MapPin, Search } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DeliveryLocationMap } from "@/components/DeliveryLocationMap";
import { useAuth } from "@/hooks/use-auth";
import { useSelectedDeliveryLocation } from "@/hooks/use-selected-delivery-location";
import {
  getCurrentDeviceLocation,
  isValidDeliveryCoordinates,
  reverseGeocodeLocation,
  type DeliveryCoordinates,
} from "@/lib/delivery-location";
import { supabase } from "@/integrations/supabase/client";

type SearchResult = DeliveryCoordinates & { address: string };
type LocationStatus = "idle" | "detecting" | "searching" | "geocoding" | "error";

function describeLocationError(error: unknown): string {
  if (!(error instanceof Error)) return "Location lookup failed. Please try again.";
  switch (error.message) {
    case "denied":
      return "Location permission was denied. Choose a place on the map or search by address.";
    case "unavailable":
      return "Your device could not determine a location. Choose a place on the map or search.";
    case "timeout":
      return "Location detection timed out. Choose a place on the map or try again.";
    case "unsupported":
      return "Location detection is unavailable in this browser. Choose a place on the map.";
    default:
      return error.message || "Location lookup failed. Please try again.";
  }
}

export function DeliveryLocationSelector({
  open,
  onOpenChange,
  onConfirmed,
  requestLocationOnOpen = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmed?: () => void;
  requestLocationOnOpen?: boolean;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { location, setLocation } = useSelectedDeliveryLocation();
  const [point, setPoint] = useState<DeliveryCoordinates | null>(null);
  const [address, setAddress] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [status, setStatus] = useState<LocationStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [confirming, setConfirming] = useState(false);
  const searchController = useRef<AbortController | null>(null);
  const requestId = useRef(0);
  const automaticRequestStarted = useRef(false);
  const requestLocationRef = useRef<(automaticSelection: boolean) => Promise<void>>(async () => {});

  useEffect(() => {
    if (!open) return;
    setPoint(location ? { latitude: location.latitude, longitude: location.longitude } : null);
    setAddress(location?.address ?? "");
    setSearchQuery("");
    setResults([]);
    setStatus("idle");
    setErrorMessage("");
  }, [location, open]);

  useEffect(() => {
    const query = searchQuery.trim();
    if (!open || query.length < 3) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    searchController.current?.abort();
    searchController.current = controller;
    const timeout = window.setTimeout(() => {
      setStatus("searching");
      setErrorMessage("");
      const params = new URLSearchParams({
        format: "jsonv2",
        q: query,
        limit: "5",
        addressdetails: "1",
      });
      void fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
        headers: { "Accept-Language": navigator.language || "en" },
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok) throw new Error(`Address search failed (${response.status}).`);
          const value: unknown = await response.json();
          if (!Array.isArray(value)) throw new Error("Address search returned invalid results.");
          const found: SearchResult[] = value.flatMap((result): SearchResult[] => {
            if (!result || typeof result !== "object") return [];
            const record = result as Record<string, unknown>;
            if (typeof record["lat"] !== "string" || typeof record["lon"] !== "string") {
              return [];
            }
            const latitude = Number(record["lat"]);
            const longitude = Number(record["lon"]);
            if (
              typeof record["display_name"] !== "string" ||
              !isValidDeliveryCoordinates({ latitude, longitude })
            ) {
              return [];
            }
            return [{ latitude, longitude, address: record["display_name"] }];
          });
          setResults(found);
          setStatus("idle");
        })
        .catch((searchError: unknown) => {
          if (controller.signal.aborted) return;
          console.error("Could not search delivery locations.", searchError);
          setStatus("error");
          setErrorMessage(
            searchError instanceof Error ? searchError.message : "Address search failed.",
          );
        });
    }, 700);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [open, searchQuery]);

  useEffect(
    () => () => {
      searchController.current?.abort();
    },
    [],
  );

  const selectSearchResult = (result: SearchResult) => {
    requestId.current += 1;
    setPoint({ latitude: result.latitude, longitude: result.longitude });
    setAddress(result.address);
    setSearchQuery(result.address);
    setResults([]);
    setStatus("idle");
    setErrorMessage("");
  };

  const requestCurrentLocation = async (automaticSelection: boolean) => {
    const activeRequest = ++requestId.current;
    setStatus("detecting");
    setErrorMessage("");
    try {
      const current = await getCurrentDeviceLocation();
      if (activeRequest !== requestId.current) return;
      setPoint(current);
      setAddress("");
      if (automaticSelection) {
        setStatus("geocoding");
        let readableAddress = "";
        try {
          readableAddress = (await reverseGeocodeLocation(current)) ?? "";
        } catch (geocodeError) {
          console.error("Could not reverse-geocode the current device location.", geocodeError);
          toast.error("Location found, but its address could not be looked up.");
        }
        if (activeRequest !== requestId.current) return;
        await confirmLocation(current, readableAddress, false);
      } else {
        setStatus("idle");
      }
    } catch (locationError) {
      if (activeRequest !== requestId.current) return;
      setStatus("error");
      const message = describeLocationError(locationError);
      setErrorMessage(message);
      if (locationError instanceof Error && locationError.message === "denied") {
        onOpenChange(true);
      }
    }
  };
  requestLocationRef.current = requestCurrentLocation;

  useEffect(() => {
    if (!open) {
      automaticRequestStarted.current = false;
      return;
    }
    if (!requestLocationOnOpen || automaticRequestStarted.current) return;
    automaticRequestStarted.current = true;
    void requestLocationRef.current(true);
  }, [open, requestLocationOnOpen]);

  const confirmLocation = async (
    selectedPoint: DeliveryCoordinates = point!,
    knownAddress = address,
    lookupAddress = true,
  ) => {
    if (!isValidDeliveryCoordinates(selectedPoint)) {
      setErrorMessage("Select a location on the map or search for an address.");
      return;
    }
    setConfirming(true);
    setErrorMessage("");
    let readableAddress = knownAddress.trim();
    if (!readableAddress && lookupAddress) {
      setStatus("geocoding");
      try {
        readableAddress = (await reverseGeocodeLocation(selectedPoint)) ?? "";
      } catch (geocodeError) {
        console.error("Could not reverse-geocode the selected delivery location.", geocodeError);
        setErrorMessage("Address lookup failed; you can still confirm this map location.");
      }
    }
    const selected = {
      latitude: selectedPoint.latitude,
      longitude: selectedPoint.longitude,
      address: readableAddress.slice(0, 1000),
    };
    try {
      setLocation(selected);
    } catch (storageError) {
      console.error("Could not save the selected delivery location in this browser.", storageError);
      toast.error("The location could not be saved in this browser.");
      setConfirming(false);
      return;
    }
    if (user) {
      try {
        const { error } = await supabase
          .from("profiles")
          .update({
            location_latitude: selected.latitude,
            location_longitude: selected.longitude,
            location_address: selected.address || null,
            location_updated_at: new Date().toISOString(),
          })
          .eq("id", user.id);
        if (error) throw error;
        await queryClient.invalidateQueries({ queryKey: ["checkout-profile", user.id] });
        await queryClient.invalidateQueries({ queryKey: ["my-profile", user.id] });
        await queryClient.invalidateQueries({ queryKey: ["header-delivery-location", user.id] });
      } catch (profileError) {
        console.error(
          "Could not save the selected location to the customer profile.",
          profileError,
        );
        toast.error(
          profileError instanceof Error
            ? `Location selected, but profile save failed: ${profileError.message}`
            : "Location selected, but it could not be saved to your profile.",
        );
      }
    }
    toast.success("Delivery location updated.");
    setConfirming(false);
    onConfirmed?.();
    onOpenChange(false);
  };

  const useMyLocation = () => {
    void requestCurrentLocation(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[calc(100%-1rem)] max-w-2xl overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Choose your delivery location</DialogTitle>
          <DialogDescription>
            Search an address, choose a point on the map, or use your current location. Location
            access is optional.
          </DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            aria-label="Search delivery address"
            className="pl-9"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search by address or area"
            autoComplete="street-address"
          />
          {results.length > 0 && (
            <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border bg-background shadow-lg">
              {results.map((result) => (
                <li key={`${result.latitude}:${result.longitude}`}>
                  <button
                    type="button"
                    className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                    onClick={() => selectSearchResult(result)}
                  >
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>{result.address}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {status === "searching" && (
          <p role="status" className="text-sm text-muted-foreground">
            Searching addresses…
          </p>
        )}
        <DeliveryLocationMap
          point={point}
          onPointChange={(next) => {
            requestId.current += 1;
            setPoint(next);
            setAddress("");
            setSearchQuery("");
          }}
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={status === "detecting"}
            onClick={useMyLocation}
          >
            <LocateFixed />
            {status === "detecting" ? "Detecting…" : "Use My Current Location"}
          </Button>
          <Button
            type="button"
            disabled={!isValidDeliveryCoordinates(point) || confirming}
            onClick={() => void confirmLocation()}
          >
            {confirming || status === "geocoding" ? "Confirming…" : "Confirm Location"}
          </Button>
        </div>
        {address && <p className="rounded-md bg-secondary/50 p-3 text-sm">{address}</p>}
        {point && (
          <p className="text-xs text-muted-foreground">
            Selected point: {point.latitude.toFixed(6)}, {point.longitude.toFixed(6)}
          </p>
        )}
        {errorMessage && (
          <p role="alert" className="text-sm text-amber-800">
            {errorMessage}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Map and address data © OpenStreetMap contributors. Address search is provided by
          OpenStreetMap Nominatim.
        </p>
      </DialogContent>
    </Dialog>
  );
}
