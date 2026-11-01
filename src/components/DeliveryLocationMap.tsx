import { useEffect, useRef } from "react";
import type { Map as LeafletMap, Marker as LeafletMarker } from "leaflet";
import type { DeliveryCoordinates } from "@/lib/delivery-location";
import "leaflet/dist/leaflet.css";

const FALLBACK_CENTER: DeliveryCoordinates = { latitude: 23.8103, longitude: 90.4125 };

function isValidCoordinates(point: DeliveryCoordinates): boolean {
  return (
    Number.isFinite(point.latitude) &&
    point.latitude >= -90 &&
    point.latitude <= 90 &&
    Number.isFinite(point.longitude) &&
    point.longitude >= -180 &&
    point.longitude <= 180
  );
}

function createMarkerIcon(L: typeof import("leaflet")) {
  return L.divIcon({
    className: "",
    html: '<svg width="34" height="42" viewBox="0 0 34 42" aria-hidden="true"><path fill="#c2413b" stroke="#fff" stroke-width="2" d="M17 1C8.2 1 1 8.2 1 17c0 11 16 24 16 24s16-13 16-24C33 8.2 25.8 1 17 1z"/><circle cx="17" cy="17" r="5" fill="#fff"/></svg>',
    iconSize: [34, 42],
    iconAnchor: [17, 41],
  });
}

export function DeliveryLocationMap({
  point,
  onPointChange,
  interactive = true,
  className = "",
}: {
  point: DeliveryCoordinates | null;
  onPointChange?: (point: DeliveryCoordinates) => void;
  interactive?: boolean;
  className?: string;
}) {
  const elementRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<LeafletMarker | null>(null);
  const onPointChangeRef = useRef(onPointChange);
  const pointRef = useRef(point);
  const interactiveRef = useRef(interactive);
  onPointChangeRef.current = onPointChange;
  pointRef.current = point;
  interactiveRef.current = interactive;

  useEffect(() => {
    let active = true;
    void import("leaflet").then((L) => {
      if (!active || !elementRef.current) return;
      const currentPoint = pointRef.current;
      const canMoveMarker = interactiveRef.current;
      const initialPoint =
        currentPoint && isValidCoordinates(currentPoint) ? currentPoint : FALLBACK_CENTER;
      const map = L.map(elementRef.current, {
        zoomControl: true,
        scrollWheelZoom: false,
      }).setView([initialPoint.latitude, initialPoint.longitude], currentPoint ? 16 : 12);
      mapRef.current = map;
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);
      if (currentPoint && isValidCoordinates(currentPoint)) {
        markerRef.current = L.marker([currentPoint.latitude, currentPoint.longitude], {
          draggable: canMoveMarker,
          icon: createMarkerIcon(L),
        }).addTo(map);
        markerRef.current.on("dragend", () => {
          const location = markerRef.current?.getLatLng();
          if (location) {
            onPointChangeRef.current?.({
              latitude: location.lat,
              longitude: location.lng,
            });
          }
        });
      }
      if (interactive) {
        map.on("click", (event) => {
          onPointChangeRef.current?.({
            latitude: event.latlng.lat,
            longitude: event.latlng.lng,
          });
        });
      }
    });

    return () => {
      active = false;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, [interactive]);

  useEffect(() => {
    const map = mapRef.current;
    const currentPoint = pointRef.current;
    if (!map || !currentPoint || !isValidCoordinates(currentPoint)) return;
    const position: [number, number] = [currentPoint.latitude, currentPoint.longitude];
    if (markerRef.current) {
      markerRef.current.setLatLng(position);
    } else {
      void import("leaflet").then((L) => {
        if (mapRef.current !== map || markerRef.current) return;
        markerRef.current = L.marker(position, {
          draggable: interactive,
          icon: createMarkerIcon(L),
        }).addTo(map);
        markerRef.current.on("dragend", () => {
          const location = markerRef.current?.getLatLng();
          if (location) {
            onPointChangeRef.current?.({
              latitude: location.lat,
              longitude: location.lng,
            });
          }
        });
      });
    }
    map.setView(position, Math.max(map.getZoom(), 16));
  }, [interactive, point?.latitude, point?.longitude]);

  return (
    <div
      ref={elementRef}
      role="application"
      aria-label={interactive ? "Interactive delivery location map" : "Order delivery location map"}
      className={`h-64 w-full overflow-hidden rounded-xl border bg-muted sm:h-80 ${className}`}
      style={{ touchAction: "pan-x pan-y" }}
    />
  );
}
