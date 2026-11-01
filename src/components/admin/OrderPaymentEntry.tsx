import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPrice } from "@/hooks/use-cart";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type PaymentEntry = Tables<"order_payment_entries">;

export function OrderPaymentEntry({
  order,
  entries,
}: {
  order: Pick<Tables<"orders">, "id" | "total" | "status">;
  entries: PaymentEntry[];
}) {
  const queryClient = useQueryClient();
  const [entryType, setEntryType] = useState<"received" | "refunded">("received");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [saving, setSaving] = useState(false);

  const orderEntries = entries.filter((entry) => entry.order_id === order.id);
  const amountReceived = orderEntries.reduce(
    (sum, entry) => sum + (entry.entry_type === "received" ? Number(entry.amount) : 0),
    0,
  );
  const amountRefunded = orderEntries.reduce(
    (sum, entry) => sum + (entry.entry_type === "refunded" ? Number(entry.amount) : 0),
    0,
  );
  const netReceived = Math.max(0, amountReceived - amountRefunded);
  const due = Math.max(0, Number(order.total) - netReceived);
  const availableRefund = Math.max(0, netReceived);
  const maxAmount = entryType === "received" ? due : availableRefund;

  const savePayment = async (event: FormEvent) => {
    event.preventDefault();
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0 || !/^\d+(\.\d{1,2})?$/.test(amount)) {
      toast.error("Enter a positive amount with at most two decimal places.");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.rpc("record_order_payment", {
        _order_id: order.id,
        _entry_type: entryType,
        _amount: parsedAmount,
        _reference: reference.trim() || null,
        _note: "",
      });
      if (error) throw new Error(error.message);
      setAmount("");
      setReference("");
      toast.success(entryType === "received" ? "Payment recorded." : "Refund recorded.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin", "order-payments"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "orders"] }),
      ]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The payment entry could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const canReceive =
    order.status === "confirmed" ||
    order.status === "preparing" ||
    order.status === "out_for_delivery" ||
    order.status === "delivered";
  const actionDisabled =
    saving ||
    maxAmount <= 0 ||
    !amount ||
    Number(amount) > maxAmount ||
    (entryType === "received" && !canReceive);

  return (
    <div className="mt-3 rounded-lg border p-3">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>Received: {formatPrice(amountReceived)}</span>
        <span>Refunded: {formatPrice(amountRefunded)}</span>
        <span>Net received: {formatPrice(netReceived)}</span>
        <span>Outstanding: {formatPrice(due)}</span>
      </div>
      {!canReceive && order.status !== "cancelled" && (
        <p className="mt-2 text-xs text-muted-foreground">
          Confirm the order before recording a payment.
        </p>
      )}
      <form
        className="mt-3 grid gap-2 sm:grid-cols-[150px_minmax(110px,1fr)_minmax(120px,1fr)_auto]"
        onSubmit={savePayment}
      >
        <label className="sr-only" htmlFor={`payment-type-${order.id}`}>
          Payment entry type
        </label>
        <select
          id={`payment-type-${order.id}`}
          value={entryType}
          onChange={(event) => {
            setEntryType(event.target.value === "refunded" ? "refunded" : "received");
            setAmount("");
          }}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="received">Received payment</option>
          <option value="refunded">Refund</option>
        </select>
        <Input
          aria-label={`Amount to ${entryType === "received" ? "receive" : "refund"} for order ${order.id}`}
          inputMode="decimal"
          min="0.01"
          max={maxAmount}
          step="0.01"
          type="number"
          placeholder="Amount"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
        <Input
          aria-label={`Payment reference for order ${order.id}`}
          placeholder="Reference (optional)"
          value={reference}
          onChange={(event) => setReference(event.target.value)}
        />
        <Button type="submit" variant="outline" disabled={actionDisabled}>
          {saving ? "Saving…" : entryType === "received" ? "Record payment" : "Record refund"}
        </Button>
      </form>
      {amount && Number(amount) > maxAmount && (
        <p className="mt-2 text-xs text-destructive" role="alert">
          Amount cannot exceed {formatPrice(maxAmount)}.
        </p>
      )}
      {orderEntries.length > 0 && (
        <details className="mt-3 text-xs">
          <summary className="cursor-pointer font-medium">
            Payment history ({orderEntries.length})
          </summary>
          <ul className="mt-2 space-y-1 text-muted-foreground">
            {orderEntries.map((entry) => (
              <li key={entry.id}>
                {new Date(entry.created_at).toLocaleString()} · {entry.entry_type} ·{" "}
                {formatPrice(Number(entry.amount))}
                {entry.reference ? ` · ${entry.reference}` : ""}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
