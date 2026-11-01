import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isValidPhoneNumber } from "@/lib/phone";

describe("customer phone and referral safeguards", () => {
  const migration = readFileSync(
    "drizzle/migrations/0012_customer_referrals_and_checkout_phone.sql",
    "utf8",
  );

  it("accepts formatted phone numbers with 7 to 15 digits", () => {
    expect(isValidPhoneNumber("+880 1712-345678")).toBe(true);
    expect(isValidPhoneNumber("1234567")).toBe(true);
    expect(isValidPhoneNumber("123456")).toBe(false);
    expect(isValidPhoneNumber("1234567890123456")).toBe(false);
    expect(isValidPhoneNumber("abc1234567")).toBe(false);
  });

  it("stores referrals through protected owner-scoped relationships", () => {
    expect(migration).toContain("CREATE TABLE public.customer_referrals");
    expect(migration).toContain("referred_user_id uuid NOT NULL UNIQUE");
    expect(migration).toContain("customers read their own referral relationships");
    expect(migration).toContain(
      "GRANT EXECUTE ON FUNCTION public.record_customer_referral(text) TO authenticated",
    );
    expect(migration).toContain("INSERT INTO public.customer_referrals");
    expect(migration).not.toContain("GRANT INSERT, UPDATE, DELETE ON public.customer_referrals");
  });

  it("lets customers see expired vouchers only when they are eligible", () => {
    expect(migration).toContain(
      'DROP POLICY IF EXISTS "eligible customers and admins read vouchers"',
    );
    expect(migration).toContain("OR eligible_to_all");
    expect(migration).toContain("e.user_id = auth.uid()");
    expect(migration).not.toContain("AND (expires_at IS NULL OR expires_at > now())");
  });

  it("validates checkout phone numbers in the order function and saves them to profiles", () => {
    expect(migration).toContain("NOT BETWEEN 7 AND 15");
    expect(migration).toContain("UPDATE public.profiles SET phone = TRIM(_phone)");
    expect(migration).toContain("Could not safely add server-side checkout phone validation");
  });
});
