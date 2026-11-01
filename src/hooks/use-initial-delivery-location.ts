import { useEffect, useRef } from "react";
import type { Fulfillment } from "@/hooks/use-fulfillment";

export function useInitialDeliveryLocation(
  fulfillment: Fulfillment,
  shouldRequestLocation: boolean,
  requestCurrentLocation: () => Promise<void>,
) {
  const requested = useRef(false);

  useEffect(() => {
    if (fulfillment !== "delivery" || !shouldRequestLocation || requested.current) return;
    requested.current = true;
    void requestCurrentLocation();
  }, [fulfillment, requestCurrentLocation, shouldRequestLocation]);
}
