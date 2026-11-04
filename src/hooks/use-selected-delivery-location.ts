import { useCallback, useEffect, useState } from "react";
import { isValidDeliveryCoordinates, type DeliveryCoordinates } from "@/lib/delivery-location";

const STORAGE_KEY = "smartcake-selected-delivery-location";
const CHANGE_EVENT = "smartcake-delivery-location-changed";

export type SelectedDeliveryLocation = DeliveryCoordinates & { address: string };

function parseLocation(value: string | null): SelectedDeliveryLocation | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object") return null;
    const record = parsed as Record<string, unknown>;
    if (
      typeof record["latitude"] !== "number" ||
      typeof record["longitude"] !== "number" ||
      typeof record["address"] !== "string"
    ) {
      return null;
    }
    const point = { latitude: record["latitude"], longitude: record["longitude"] };
    if (!isValidDeliveryCoordinates(point) || record["address"].length > 1000) {
      return null;
    }
    return { ...point, address: record["address"] };
  } catch (error) {
    console.error("Could not read the selected delivery location.", error);
    return null;
  }
}

export function writeSelectedDeliveryLocation(location: SelectedDeliveryLocation | null): void {
  if (location && !isValidDeliveryCoordinates(location)) {
    throw new Error("Choose a valid delivery location.");
  }
  if (location && location.address.length > 1000) {
    throw new Error("The selected delivery address is too long.");
  }
  if (location) localStorage.setItem(STORAGE_KEY, JSON.stringify(location));
  else localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: location }));
}

export function useSelectedDeliveryLocation() {
  const [location, setLocation] = useState<SelectedDeliveryLocation | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLocation(parseLocation(localStorage.getItem(STORAGE_KEY)));
    setLoaded(true);
    const handleChange = (event: Event) => {
      const detail = (event as CustomEvent<SelectedDeliveryLocation | null>).detail;
      setLocation(detail ?? null);
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setLocation(parseLocation(event.newValue));
    };
    window.addEventListener(CHANGE_EVENT, handleChange);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(CHANGE_EVENT, handleChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const updateLocation = useCallback((next: SelectedDeliveryLocation | null) => {
    writeSelectedDeliveryLocation(next);
  }, []);

  return { location, loaded, setLocation: updateLocation };
}
