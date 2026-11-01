import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useInitialDeliveryLocation } from "@/hooks/use-initial-delivery-location";
import {
  consumePendingProfileLocation,
  getCurrentDeviceLocation,
  isValidDeliveryCoordinates,
  savePendingProfileLocation,
} from "@/lib/delivery-location";

describe("delivery location helpers", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: vi.fn(),
      },
    });
  });

  it("returns the device coordinates when location permission is granted", async () => {
    const getCurrentPosition = vi.fn((success: PositionCallback) => {
      success({
        coords: { latitude: 23.7, longitude: 90.4 },
      } as GeolocationPosition);
    });
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition },
    });

    await expect(getCurrentDeviceLocation()).resolves.toEqual({
      latitude: 23.7,
      longitude: 90.4,
    });
    expect(getCurrentPosition).toHaveBeenCalledOnce();
  });

  it.each([
    [1, "denied"],
    [2, "unavailable"],
    [3, "timeout"],
  ] as const)("reports geolocation error %s as %s", async (code, expected) => {
    const getCurrentPosition = vi.fn((_success: PositionCallback, error: PositionErrorCallback) => {
      error({
        code,
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
        message: "location error",
      } as GeolocationPositionError);
    });
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition },
    });

    await expect(getCurrentDeviceLocation()).rejects.toThrow(expected);
  });

  it("reports browsers without geolocation and validates coordinate ranges", async () => {
    Object.defineProperty(navigator, "geolocation", { configurable: true, value: undefined });
    await expect(getCurrentDeviceLocation()).rejects.toThrow("unsupported");
    expect(isValidDeliveryCoordinates({ latitude: 90, longitude: 180 })).toBe(true);
    expect(isValidDeliveryCoordinates({ latitude: 91, longitude: 0 })).toBe(false);
    expect(isValidDeliveryCoordinates(null)).toBe(false);
  });

  it("restores a recent pending OAuth location once", () => {
    const point = { latitude: 23.7, longitude: 90.4 };
    savePendingProfileLocation(point, "Dhaka");

    expect(consumePendingProfileLocation()).toEqual({ ...point, address: "Dhaka" });
    expect(consumePendingProfileLocation()).toBeNull();
  });

  it("ignores expired or invalid pending OAuth locations", () => {
    sessionStorage.setItem(
      "smartcake-pending-profile-location",
      JSON.stringify({
        latitude: 23.7,
        longitude: 90.4,
        address: null,
        savedAt: Date.now() - 11 * 60 * 1000,
      }),
    );
    expect(consumePendingProfileLocation()).toBeNull();

    sessionStorage.setItem(
      "smartcake-pending-profile-location",
      JSON.stringify({ latitude: 100, longitude: 90, address: null, savedAt: Date.now() }),
    );
    expect(consumePendingProfileLocation()).toBeNull();
  });

  it("requests device location automatically when delivery checkout loads", () => {
    const requestCurrentLocation = vi.fn(() => Promise.resolve());
    const { rerender } = renderHook(
      ({ fulfillment }: { fulfillment: "delivery" | "pickup" }) =>
        useInitialDeliveryLocation(fulfillment, true, requestCurrentLocation),
      { initialProps: { fulfillment: "delivery" as "delivery" | "pickup" } },
    );

    expect(requestCurrentLocation).toHaveBeenCalledOnce();
    rerender({ fulfillment: "pickup" });
    rerender({ fulfillment: "delivery" });
    expect(requestCurrentLocation).toHaveBeenCalledOnce();
  });

  it("waits for the saved profile location before requesting GPS", () => {
    const requestCurrentLocation = vi.fn(() => Promise.resolve());
    const { rerender } = renderHook(
      ({ shouldRequestLocation }: { shouldRequestLocation: boolean }) =>
        useInitialDeliveryLocation("delivery", shouldRequestLocation, requestCurrentLocation),
      { initialProps: { shouldRequestLocation: false } },
    );

    expect(requestCurrentLocation).not.toHaveBeenCalled();
    rerender({ shouldRequestLocation: true });
    expect(requestCurrentLocation).toHaveBeenCalledOnce();
    rerender({ shouldRequestLocation: false });
    expect(requestCurrentLocation).toHaveBeenCalledOnce();
  });
});
