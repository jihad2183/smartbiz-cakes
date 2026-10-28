import { describe, expect, it } from "vitest";
import { CAKE_PAGE_SIZE, getCakePageCount, getCakePageRange } from "@/lib/cake-pagination";

describe("Cake catalog pagination", () => {
  it("uses at most 12 products per page and computes page counts from results", () => {
    expect(CAKE_PAGE_SIZE).toBe(12);
    expect(getCakePageCount(0)).toBe(0);
    expect(getCakePageCount(12)).toBe(1);
    expect(getCakePageCount(13)).toBe(2);
    expect(getCakePageCount(25)).toBe(3);
  });

  it("uses non-overlapping 12-item database ranges", () => {
    expect(getCakePageRange(1)).toEqual({ from: 0, to: 11 });
    expect(getCakePageRange(2)).toEqual({ from: 12, to: 23 });
    expect(getCakePageRange(0)).toEqual({ from: 0, to: 11 });
  });
});
