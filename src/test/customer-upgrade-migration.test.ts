import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Customer checkout and support migration", () => {
  const migration = readFileSync(
    "drizzle/migrations/0010_customer_addresses_support_and_checkout_safety.sql",
    "utf8",
  );

  it("adds owner-scoped address and support data without replacing customer orders", () => {
    expect(migration).toContain("CREATE TABLE public.customer_addresses");
    expect(migration).toContain("USING (user_id = auth.uid())");
    expect(migration).toContain("CREATE TABLE public.support_requests");
    expect(migration).toContain("customers submit support requests");
    expect(migration).toContain("orders o WHERE o.id = order_id AND o.user_id = auth.uid()");
    expect(migration).not.toMatch(/\bDROP\s+TABLE\b/i);
  });

  it("limits private profile images and records checkout idempotency", () => {
    expect(migration).toContain("2097152");
    expect(migration).toContain("public = false");
    expect(migration).toContain("CREATE TABLE public.order_checkout_requests");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.place_order_once");
    expect(migration).toContain("FOR UPDATE");
  });

  it("keeps upay disabled until configured and extends server payment validation", () => {
    expect(migration).toContain("VALUES ('upay', 'upay', false");
    expect(migration).toContain("'rocket'', ''upay'', ''cod'");
    expect(migration).toContain("RAISE EXCEPTION 'Could not safely extend place_order");
  });
});
