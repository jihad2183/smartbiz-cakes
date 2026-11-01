import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("customer profile location migration", () => {
  const migration = readFileSync("drizzle/migrations/0015_customer_profile_location.sql", "utf8");

  it("adds optional validated profile coordinates and location metadata", () => {
    expect(migration).toContain("ADD COLUMN location_latitude double precision");
    expect(migration).toContain("ADD COLUMN location_longitude double precision");
    expect(migration).toContain("ADD COLUMN location_address text");
    expect(migration).toContain("ADD COLUMN location_updated_at timestamptz");
    expect(migration).toContain("profiles_location_coordinates_valid");
    expect(migration).toContain("profiles_location_address_length");
  });

  it("limits the OAuth location RPC to the signed-in user and preserves saved locations", () => {
    expect(migration).toContain("FUNCTION public.save_profile_location_if_missing");
    expect(migration).toContain("WHERE id = auth.uid()");
    expect(migration).toContain("AND location_latitude IS NULL");
    expect(migration).toContain("AND location_longitude IS NULL");
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.save_profile_location_if_missing");
    expect(migration).toContain("TO authenticated");
  });

  it("validates signup coordinates and keeps existing account-creation behavior", () => {
    expect(migration).toContain("metadata_latitude ~ '^-?[0-9]+([.][0-9]+)?$'");
    expect(migration).toContain("parsed_latitude BETWEEN -90 AND 90");
    expect(migration).toContain("parsed_longitude BETWEEN -180 AND 180");
    expect(migration).toContain("INSERT INTO public.user_roles (user_id, role)");
    expect(migration).toContain("INSERT INTO public.customer_referrals");
    expect(migration).toContain("INSERT INTO public.voucher_eligibility");
  });
});
