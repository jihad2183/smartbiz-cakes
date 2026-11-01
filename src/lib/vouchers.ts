import { supabase } from "@/integrations/supabase/client";

export type AppliedVoucher = { code: string; discount: number };

export async function validateVoucher(code: string, subtotal: number): Promise<AppliedVoucher> {
  const { data, error } = await supabase.rpc("validate_voucher", {
    _code: code.trim(),
    _subtotal: subtotal,
  });
  if (error) throw new Error(error.message);

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Voucher response was invalid.");
  }
  const returnedCode = data["code"];
  const returnedDiscount = data["discount"];
  if (typeof returnedCode !== "string" || typeof returnedDiscount !== "number") {
    throw new Error("Voucher response was invalid.");
  }
  return { code: returnedCode, discount: returnedDiscount };
}
