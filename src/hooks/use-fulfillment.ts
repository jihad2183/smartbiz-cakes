import { useEffect, useState } from "react";

export type Fulfillment = "delivery" | "pickup";
const STORAGE_KEY = "smartcake-fulfillment";

export function useFulfillment() {
  const [fulfillment, setFulfillmentState] = useState<Fulfillment>("delivery");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "delivery" || stored === "pickup") setFulfillmentState(stored);
  }, []);

  const setFulfillment = (next: Fulfillment) => {
    localStorage.setItem(STORAGE_KEY, next);
    setFulfillmentState(next);
  };

  return { fulfillment, setFulfillment };
}
