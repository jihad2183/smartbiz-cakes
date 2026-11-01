import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Cake photo storage migration", () => {
  it("creates the private upload bucket without changing existing bucket configuration", () => {
    const migration = readFileSync("drizzle/migrations/0011_cake_photo_bucket.sql", "utf8");

    expect(migration).toContain("INSERT INTO storage.buckets (id, name, public)");
    expect(migration).toContain("VALUES ('cake-photos', 'cake-photos', false)");
    expect(migration).toContain("ON CONFLICT (id) DO NOTHING");
    expect(migration).not.toMatch(/\bDROP\b|\bDELETE\b|\bTRUNCATE\b/i);
  });
});
