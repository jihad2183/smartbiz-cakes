export type DeliveryCoordinates = {
  latitude: number;
  longitude: number;
};

export function isValidDeliveryCoordinates(
  point: DeliveryCoordinates | null,
): point is DeliveryCoordinates {
  return (
    point !== null &&
    Number.isFinite(point.latitude) &&
    point.latitude >= -90 &&
    point.latitude <= 90 &&
    Number.isFinite(point.longitude) &&
    point.longitude >= -180 &&
    point.longitude <= 180
  );
}

export function getCurrentDeviceLocation(): Promise<DeliveryCoordinates> {
  if (!navigator.geolocation) {
    return Promise.reject(new Error("unsupported"));
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        resolve({ latitude: coords.latitude, longitude: coords.longitude });
      },
      (error) => {
        reject(
          new Error(
            error.code === error.PERMISSION_DENIED
              ? "denied"
              : error.code === error.POSITION_UNAVAILABLE
                ? "unavailable"
                : error.code === error.TIMEOUT
                  ? "timeout"
                  : "error",
          ),
        );
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 },
    );
  });
}

export async function reverseGeocodeLocation(
  point: DeliveryCoordinates,
  signal?: AbortSignal,
): Promise<string | null> {
  const query = new URLSearchParams({
    format: "jsonv2",
    lat: String(point.latitude),
    lon: String(point.longitude),
  });
  const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${query.toString()}`, {
    headers: { "Accept-Language": navigator.language || "en" },
    ...(signal ? { signal } : {}),
  });
  if (!response.ok) throw new Error(`Reverse geocoding failed (${response.status}).`);
  const result: unknown = await response.json();
  return result &&
    typeof result === "object" &&
    "display_name" in result &&
    typeof result.display_name === "string"
    ? result.display_name
    : null;
}

const PENDING_PROFILE_LOCATION_KEY = "smartcake-pending-profile-location";

export function savePendingProfileLocation(
  point: DeliveryCoordinates,
  address: string | null,
): void {
  sessionStorage.setItem(
    PENDING_PROFILE_LOCATION_KEY,
    JSON.stringify({ ...point, address, savedAt: Date.now() }),
  );
}

export function consumePendingProfileLocation():
  (DeliveryCoordinates & { address: string | null }) | null {
  try {
    const pendingLocation = sessionStorage.getItem(PENDING_PROFILE_LOCATION_KEY);
    sessionStorage.removeItem(PENDING_PROFILE_LOCATION_KEY);
    if (!pendingLocation) return null;
    const parsed: unknown = JSON.parse(pendingLocation);
    if (!parsed || typeof parsed !== "object") return null;
    const candidate = parsed as Record<string, unknown>;
    const point = {
      latitude: Number(candidate["latitude"]),
      longitude: Number(candidate["longitude"]),
    };
    const savedAt = Number(candidate["savedAt"]);
    if (
      !isValidDeliveryCoordinates(point) ||
      !Number.isFinite(savedAt) ||
      Date.now() - savedAt > 10 * 60 * 1000
    ) {
      return null;
    }
    return {
      ...point,
      address:
        typeof candidate["address"] === "string" && candidate["address"].length <= 1000
          ? candidate["address"]
          : null,
    };
  } catch (error) {
    console.error("Could not restore the pending signup location.", error);
    return null;
  }
}

export function clearPendingProfileLocation(): void {
  try {
    sessionStorage.removeItem(PENDING_PROFILE_LOCATION_KEY);
  } catch (error) {
    console.error("Could not clear the pending signup location.", error);
  }
}
