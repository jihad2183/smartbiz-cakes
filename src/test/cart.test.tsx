import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { CartProvider, useCart } from "@/hooks/use-cart";
import { isValidQuantity } from "@/lib/order-quantity";

describe("Direct cake additions", () => {
  beforeEach(() => localStorage.clear());
  it("adds one cake and increments the same cake on another click", () => {
    const { result } = renderHook(() => useCart(), { wrapper: CartProvider });
    const cake = { cake_id: "mango", name: "Mango Cream Delight", price: 1650, image_url: null };
    act(() => result.current.add(cake));
    expect(result.current.count).toBe(1);
    act(() => result.current.add(cake));
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0]?.quantity).toBe(2);
    expect(result.current.total).toBe(3300);
  });

  it("accepts only positive whole-number quantities", () => {
    const { result } = renderHook(() => useCart(), { wrapper: CartProvider });
    const cake = {
      cake_id: "truffle",
      name: "Dark Chocolate Truffle",
      price: 1950,
      image_url: null,
    };
    act(() => result.current.add(cake));
    act(() => result.current.setQty("truffle:1", 2.3));
    expect(result.current.items[0]?.quantity).toBe(1);
    expect(result.current.total).toBe(1950);
    act(() => result.current.setQty("truffle:1", 3));
    expect(result.current.items[0]?.quantity).toBe(3);
    expect(result.current.total).toBe(5850);
    act(() => result.current.setQty("truffle:1", 0));
    expect(result.current.items[0]?.quantity).toBe(3);
    act(() => result.current.setQty("truffle:1", -3));
    expect(result.current.items[0]?.quantity).toBe(3);
  });

  it("rejects fractional and out-of-range additions", () => {
    const { result } = renderHook(() => useCart(), { wrapper: CartProvider });
    const cake = {
      cake_id: "truffle",
      name: "Dark Chocolate Truffle",
      price: 1950,
      image_url: null,
    };
    act(() => expect(result.current.add(cake, 1.5)).toBe(false));
    act(() => expect(result.current.add(cake, 51)).toBe(false));
    expect(result.current.items).toHaveLength(0);
  });

  it("normalizes old fractional local cart values to whole quantities", () => {
    localStorage.setItem(
      "smartcake-cart",
      JSON.stringify([
        {
          cake_id: "mango",
          name: "Mango Cream Delight",
          price: 1000,
          image_url: null,
          quantity: 1.5,
          pounds: 2,
        },
      ]),
    );
    const { result } = renderHook(() => useCart(), { wrapper: CartProvider });
    expect(result.current.items[0]?.quantity).toBe(2);
    expect(result.current.items[0]?.pounds).toBe(2);
  });
});
describe("Pound sizes", () => {
  beforeEach(() => localStorage.clear());
  it("prices a line by pounds and keeps sizes as separate lines", () => {
    const { result } = renderHook(() => useCart(), { wrapper: CartProvider });
    const cake = { cake_id: "mango", name: "Mango", price: 1000, image_url: null };
    act(() => result.current.add({ ...cake, pounds: 2 }));
    act(() => result.current.add({ ...cake, pounds: 3 }));
    expect(result.current.items).toHaveLength(2);
    expect(result.current.total).toBe(5000);
  });

  describe("Order quantity validation", () => {
    it("accepts only positive integer quantities up to the checkout limit", () => {
      expect(isValidQuantity(1)).toBe(true);
      expect(isValidQuantity(50)).toBe(true);
      expect(isValidQuantity(1.5)).toBe(false);
      expect(isValidQuantity(0)).toBe(false);
      expect(isValidQuantity(51)).toBe(false);
    });
  });
  it("rejects sizes outside 1 to 6 pounds", () => {
    const { result } = renderHook(() => useCart(), { wrapper: CartProvider });
    act(() =>
      result.current.add({ cake_id: "x", name: "X", price: 500, image_url: null, pounds: 9 }),
    );
    expect(result.current.items[0]?.pounds).toBe(1);
  });

  it("does not merge weight changes into a line that would exceed 50 cakes", () => {
    const { result } = renderHook(() => useCart(), { wrapper: CartProvider });
    const cake = { cake_id: "mango", name: "Mango", price: 1000, image_url: null };
    act(() => result.current.add({ ...cake, pounds: 1 }, 30));
    act(() => result.current.add({ ...cake, pounds: 2 }, 30));
    let updated = true;
    act(() => {
      updated = result.current.setPounds("mango:2", 1);
    });
    expect(updated).toBe(false);
    expect(result.current.items).toHaveLength(2);
    expect(result.current.items.map((item) => item.quantity)).toEqual([30, 30]);
  });
});
