import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Checkout feature database migration", () => {
  const migration = readFileSync("drizzle/migrations/0008_checkout_vouchers_payments.sql", "utf8");
  const percentageMigration = readFileSync(
    "drizzle/migrations/0009_percentage_vouchers_and_customer_pages.sql",
    "utf8",
  );

  it("persists cart, payment, fulfilment, voucher, and redemption data", () => {
    expect(migration).toContain("CREATE TABLE public.cart_items");
    expect(migration).toContain("CREATE TABLE public.payment_methods");
    expect(migration).toContain("CREATE TABLE public.vouchers");
    expect(migration).toContain("CREATE TABLE public.voucher_eligibility");
    expect(migration).toContain("CREATE TABLE public.voucher_redemptions");
    expect(migration).toContain("ADD COLUMN fulfillment_type");
    expect(migration).toContain("ADD COLUMN payment_status");
  });

  it("issues unique welcome vouchers to customers without granting admin access", () => {
    const signup = migration.split("CREATE OR REPLACE FUNCTION public.validate_voucher")[0] ?? "";
    expect(signup).toContain(
      "INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'customer')",
    );
    expect(signup).toContain("voucher_code := 'WELCOME-'");
    expect(signup).toContain("INSERT INTO public.voucher_eligibility");
    expect(signup).not.toContain("VALUES (NEW.id, 'admin')");
  });

  it("validates voucher eligibility and payment choices inside the order transaction", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.validate_voucher");
    expect(migration).toContain("CREATE FUNCTION public.place_order");
    expect(migration).toContain("FOR UPDATE");
    expect(migration).toContain("This voucher has already been used");
    expect(migration).toContain("This payment method is currently unavailable");
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.place_order");
  });

  it("enforces percentage-only vouchers while retaining customer-specific voucher history", () => {
    expect(percentageMigration).toContain("vouchers_percentage_only_check");
    expect(percentageMigration).toContain("welcome_voucher_settings_percentage_only_check");
    expect(percentageMigration).toContain("customers read their voucher history");
    expect(percentageMigration).toContain("SET active = false, discount_type = 'percent'");
  });
});
