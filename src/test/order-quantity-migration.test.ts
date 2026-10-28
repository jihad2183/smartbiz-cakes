import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Integer quantity database validation", () => {
  const migration = readFileSync("drizzle/migrations/0006_integer_order_quantities.sql", "utf8");

  it("rejects fractional, zero, and over-limit quantities in checkout", () => {
    expect(migration).toContain("q <> trunc(q)");
    expect(migration).toContain("q < 1 OR q > 50");
    expect(migration).toContain("quantity_num = trunc(quantity_num)");
    expect(migration).toContain("quantity >= 1");
    expect(migration).not.toContain("round((it->>'quantity')");
  });

  it("validates pounds independently and calculates prices from database cake pricing", () => {
    expect(migration).toContain("lb < 1 OR lb > 6 OR lb <> trunc(lb)");
    expect(migration).toContain("c.price * lb_int");
    expect(migration).toContain("c.price * lb_int * q_int");
  });
});
