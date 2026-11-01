import { fireEvent, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const leafletMocks = vi.hoisted(() => {
  const mapHandlers: Record<string, (event: { latlng: { lat: number; lng: number } }) => void> = {};
  const markerHandlers: Record<string, () => void> = {};
  const map = {
    handlers: mapHandlers,
    setView: vi.fn(function (this: unknown) {
      return this;
    }),
    on: vi.fn(function (
      this: unknown,
      event: string,
      handler: (event: { latlng: { lat: number; lng: number } }) => void,
    ) {
      mapHandlers[event] = handler;
      return this;
    }),
    remove: vi.fn(),
    getZoom: vi.fn(() => 12),
  };
  const marker = {
    handlers: markerHandlers,
    on: vi.fn(function (this: unknown, event: string, handler: () => void) {
      markerHandlers[event] = handler;
      return this;
    }),
    setLatLng: vi.fn(),
    getLatLng: vi.fn(() => ({ lat: 23.8, lng: 90.3 })),
    addTo: vi.fn(function (this: unknown) {
      return this;
    }),
  };
  return {
    map,
    marker,
    mapFactory: vi.fn(() => map),
    markerFactory: vi.fn(() => marker),
    tileLayer: vi.fn(() => ({ addTo: vi.fn() })),
    divIcon: vi.fn((options: unknown) => options),
  };
});

vi.mock("leaflet", () => ({
  map: leafletMocks.mapFactory,
  marker: leafletMocks.markerFactory,
  tileLayer: leafletMocks.tileLayer,
  divIcon: leafletMocks.divIcon,
}));

import { DeliveryLocationMap } from "@/components/DeliveryLocationMap";

describe("delivery location map interactions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(leafletMocks.map.handlers).forEach((key) => delete leafletMocks.map.handlers[key]);
    Object.keys(leafletMocks.marker.handlers).forEach(
      (key) => delete leafletMocks.marker.handlers[key],
    );
  });

  it("reports map clicks and dragged marker coordinates", async () => {
    const onPointChange = vi.fn();
    render(
      <DeliveryLocationMap
        point={{ latitude: 23.7, longitude: 90.4 }}
        onPointChange={onPointChange}
      />,
    );

    await waitFor(() => expect(leafletMocks.mapFactory).toHaveBeenCalledOnce());
    leafletMocks.map.handlers["click"]?.({ latlng: { lat: 23.8, lng: 90.3 } });
    expect(onPointChange).toHaveBeenCalledWith({ latitude: 23.8, longitude: 90.3 });
    expect(leafletMocks.markerFactory).toHaveBeenCalledWith(
      [23.7, 90.4],
      expect.objectContaining({ draggable: true }),
    );

    leafletMocks.marker.handlers["dragend"]?.();
    expect(onPointChange).toHaveBeenLastCalledWith({ latitude: 23.8, longitude: 90.3 });
  });

  it("renders a non-draggable order map for administrators", async () => {
    const { getByRole, unmount } = render(
      <DeliveryLocationMap point={{ latitude: 23.7, longitude: 90.4 }} interactive={false} />,
    );

    await waitFor(() => expect(leafletMocks.mapFactory).toHaveBeenCalledOnce());
    expect(getByRole("application")).toHaveAttribute("aria-label", "Order delivery location map");
    expect(leafletMocks.markerFactory).toHaveBeenCalledWith(
      [23.7, 90.4],
      expect.objectContaining({ draggable: false }),
    );
    fireEvent.click(getByRole("application"));
    expect(leafletMocks.map.handlers["click"]).toBeUndefined();
    unmount();
    expect(leafletMocks.map.remove).toHaveBeenCalledOnce();
  });
});
