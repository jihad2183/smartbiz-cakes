import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Inventory pounds migration", () => {
  const migration = readFileSync("drizzle/migrations/0007_inventory_pounds.sql", "utf8");

  it("converts existing kilogram quantities and reorder thresholds to pounds", () => {
    expect(migration).toContain("quantity = quantity * 2.20462");
    expect(migration).toContain("reorder_level = reorder_level * 2.20462");
    expect(migration).toContain("WHERE lower(trim(unit)) = 'kg'");
    expect(migration).toContain("unit = 'lb'");
  });

  it("defaults new inventory records to pounds", () => {
    expect(migration).toContain("ALTER COLUMN unit SET DEFAULT 'lb'");
  });
});
