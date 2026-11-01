import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("delivery map migration", () => {
  const migration = readFileSync("drizzle/migrations/0014_delivery_map_locations.sql", "utf8");

  it("adds validated coordinates and a readable map address without rewriting existing records", () => {
    const schemaChanges = migration.split("CREATE OR REPLACE FUNCTION")[0] ?? "";
    expect(migration).toContain("ADD COLUMN delivery_latitude double precision");
    expect(migration).toContain("ADD COLUMN delivery_longitude double precision");
    expect(migration).toContain("ADD COLUMN delivery_map_address text");
    expect(migration).toContain("orders_delivery_coordinates_valid");
    expect(migration).toContain("ALTER COLUMN area DROP NOT NULL");
    expect(schemaChanges).not.toMatch(/DELETE\s+FROM\s+public\.(orders|customer_addresses)/i);
    expect(schemaChanges).not.toMatch(/UPDATE\s+public\.(orders|customer_addresses)/i);
  });

  it("validates delivery pins and saves them only on the signed-in customer's order", () => {
    expect(migration).toContain("FUNCTION public.place_order_with_location");
    expect(migration).toContain("Choose a valid delivery location on the map");
    expect(migration).toContain("House and road address is required");
    expect(migration).toContain("AND user_id = auth.uid()");
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.place_order_with_location");
    expect(migration).toContain("TO authenticated");
    expect(migration).toContain("public.place_order_once");
  });
});
