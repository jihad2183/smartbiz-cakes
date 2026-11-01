import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { formatPrice, useCart } from "@/hooks/use-cart";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/hooks/use-language";
import { validateVoucher } from "@/lib/vouchers";

export const Route = createFileRoute("/vouchers")({
  head: () => ({
    meta: [
      { title: "Apply Voucher | Smart Cake Shop" },
      { name: "description", content: "Choose an eligible voucher or apply a voucher code." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: VouchersPage,
});

function VouchersPage() {
  const { user, loading } = useAuth();
  const { t } = useLanguage();
  const { total } = useCart();
  const navigate = useNavigate();
  const [manualCode, setManualCode] = useState("");
  const [applyingCode, setApplyingCode] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const {
    data: vouchers = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["customer-vouchers", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [
        { data: availableVouchers, error: voucherError },
        { data: redemptions, error: redemptionError },
        { data: eligibility, error: eligibilityError },
      ] = await Promise.all([
        supabase.from("vouchers").select("*").order("expires_at", { ascending: true }),
        supabase.from("voucher_redemptions").select("voucher_id").eq("user_id", user!.id),
        supabase.from("voucher_eligibility").select("voucher_id").eq("user_id", user!.id),
      ]);
      if (voucherError) throw voucherError;
      if (redemptionError) throw redemptionError;
      if (eligibilityError) throw eligibilityError;

      const usedIds = new Set((redemptions ?? []).map(({ voucher_id }) => voucher_id));
      const eligibleIds = new Set((eligibility ?? []).map(({ voucher_id }) => voucher_id));
      const now = Date.now();
      return (availableVouchers ?? []).map((voucher) => {
        const expired =
          !voucher.active ||
          (voucher.expires_at !== null && new Date(voucher.expires_at).getTime() <= now);
        const eligible = voucher.eligible_to_all || eligibleIds.has(voucher.id);
        return {
          ...voucher,
          status: usedIds.has(voucher.id)
            ? "used"
            : !eligible || expired
              ? "unavailable"
              : "available",
          statusMessage: usedIds.has(voucher.id)
            ? "Already redeemed"
            : !eligible
              ? "Not available to your account"
              : expired
                ? "Inactive or expired"
                : "Eligible for your account",
        };
      });
    },
  });

  const applyCode = async (code: string, voucherId?: string) => {
    if (!user) {
      toast.error("Sign in to apply a voucher.");
      return;
    }
    if (!code.trim()) {
      toast.error("Enter a voucher code.");
      return;
    }

    setApplyingCode(true);
    setSelectedId(voucherId ?? null);
    try {
      const voucher = await validateVoucher(code, total);
      sessionStorage.setItem("smartcake-selected-voucher", voucher.code);
      toast.success(`Voucher ${voucher.code} is eligible and ready to apply.`);
      await navigate({ to: "/checkout" });
    } catch (applyError) {
      toast.error(
        applyError instanceof Error ? applyError.message : "Voucher could not be applied.",
      );
    } finally {
      setApplyingCode(false);
      setSelectedId(null);
    }
  };

  if (loading) return <main className="mx-auto max-w-4xl px-4 py-10">{t("loadingAccount")}</main>;
  if (!user) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="font-display text-4xl">Apply Voucher</h1>
        <p className="mt-3 text-muted-foreground">{t("signInToContinue")}</p>
        <Button asChild className="mt-5">
          <Link to="/auth">{t("signIn")}</Link>
        </Button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Current cart: {formatPrice(total)}</p>
          <h1 className="font-display text-4xl">Apply Voucher</h1>
        </div>
        <Button asChild variant="outline">
          <Link to="/checkout">Back to checkout</Link>
        </Button>
      </div>

      <section className="mt-6 rounded-2xl bg-card p-5 shadow-soft sm:p-7">
        <h2 className="text-xl font-semibold">Select a Voucher</h2>
        {isLoading ? (
          <p className="mt-4" role="status">
            Loading your vouchers…
          </p>
        ) : error ? (
          <p className="mt-4 text-destructive" role="alert">
            Vouchers could not be loaded. Please try again.
          </p>
        ) : !vouchers.length ? (
          <p className="mt-4 text-sm text-muted-foreground">
            You do not have any vouchers available to view.
          </p>
        ) : (
          <div className="mt-4 grid gap-3">
            {vouchers.map((voucher) => (
              <article
                key={voucher.id}
                className="flex flex-col justify-between gap-4 rounded-xl border p-4 sm:flex-row sm:items-center"
                data-status={voucher.status}
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-mono text-lg font-bold tracking-wide">{voucher.code}</p>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        voucher.status === "available"
                          ? "bg-green-100 text-green-800"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {voucher.statusMessage}
                    </span>
                  </div>
                  <p className="mt-1 text-xl font-semibold">{voucher.discount_value}% off</p>
                  <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
                    <div className="flex gap-1">
                      <dt>Minimum order:</dt>
                      <dd>{formatPrice(voucher.min_order)}</dd>
                    </div>
                    {voucher.max_discount !== null && (
                      <div className="flex gap-1">
                        <dt>Maximum discount:</dt>
                        <dd>{formatPrice(voucher.max_discount)}</dd>
                      </div>
                    )}
                    <div className="flex gap-1">
                      <dt>Expires:</dt>
                      <dd>
                        {voucher.expires_at
                          ? new Date(voucher.expires_at).toLocaleDateString()
                          : "No expiry"}
                      </dd>
                    </div>
                  </dl>
                </div>
                <Button
                  disabled={voucher.status !== "available" || applyingCode}
                  onClick={() => void applyCode(voucher.code, voucher.id)}
                >
                  {selectedId === voucher.id ? "Checking…" : "Select Voucher"}
                </Button>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="mt-5 rounded-2xl bg-card p-5 shadow-soft sm:p-7">
        <h2 className="text-xl font-semibold">Enter Voucher Code</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Eligibility, expiry, minimum order, and previous redemption are verified securely.
        </p>
        <form
          className="mt-4 flex flex-col gap-3 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            void applyCode(manualCode);
          }}
        >
          <Input
            aria-label="Voucher code"
            autoComplete="off"
            placeholder="Enter voucher code"
            value={manualCode}
            onChange={(event) => setManualCode(event.target.value)}
          />
          <Button type="submit" disabled={!manualCode.trim() || applyingCode}>
            {applyingCode ? "Checking…" : "Apply Code"}
          </Button>
        </form>
      </section>
    </main>
  );
}
