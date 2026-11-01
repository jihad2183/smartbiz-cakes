import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("admin financial accuracy migration", () => {
  const migration = readFileSync("drizzle/migrations/0013_admin_financial_accuracy.sql", "utf8");

  it("adds auditable cancellation dates and secure payment receipts without changing existing migrations", () => {
    expect(migration).toContain("ADD COLUMN cancelled_at timestamptz");
    expect(migration).toContain("ADD COLUMN cancellation_note text");
    expect(migration).toContain("CREATE TABLE public.order_payment_entries");
    expect(migration).toContain("ENABLE ROW LEVEL SECURITY");
    expect(migration).toContain("admins read order payment entries");
    expect(migration).toContain("Only administrators can record order payments");
    expect(migration).toContain("ON public.order_payment_entries");
  });

  it("records partial receipts and bounded refunds through a database function", () => {
    expect(migration).toContain("record_order_payment");
    expect(migration).toContain("Payments can only be recorded for confirmed orders");
    expect(migration).toContain("Payment exceeds the remaining order balance");
    expect(migration).toContain("Refund exceeds the amount received");
    expect(migration).toContain("Imported from existing verified paid order status");
  });
});
