import { useEffect, useState, type FormEvent } from "react";
import { Save, Trash2 } from "lucide-react";
import type { Tables, TablesUpdate } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type PaymentMethod = Tables<"payment_methods">;

type Props = {
  method: PaymentMethod;
  busy: boolean;
  onSave: (updates: TablesUpdate<"payment_methods">) => Promise<boolean>;
  onDelete: () => Promise<boolean>;
};

export function PaymentMethodSettings({ method, busy, onSave, onDelete }: Props) {
  const [accountNumber, setAccountNumber] = useState(method.account_number ?? "");
  const [accountType, setAccountType] = useState(method.account_type ?? "");
  const [accountHolderName, setAccountHolderName] = useState(method.account_holder_name ?? "");
  const [instructions, setInstructions] = useState(method.instructions);
  const [enabled, setEnabled] = useState(method.enabled);

  useEffect(() => {
    setAccountNumber(method.account_number ?? "");
    setAccountType(method.account_type ?? "");
    setAccountHolderName(method.account_holder_name ?? "");
    setInstructions(method.instructions);
    setEnabled(method.enabled);
  }, [method]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onSave({
      account_number: accountNumber.trim() || null,
      account_type: accountType || null,
      account_holder_name: accountHolderName.trim() || null,
      instructions: instructions.trim(),
      enabled,
    });
  };

  return (
    <form
      onSubmit={(event) => {
        void submit(event);
      }}
      className="grid gap-4 rounded-2xl bg-card p-4 shadow-soft sm:p-6"
    >
      <div>
        <h2 className="text-lg font-semibold">{method.label}</h2>
        <p className="text-xs uppercase text-muted-foreground">{method.id}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm font-medium">
          Account number
          <Input
            aria-label={`${method.label} account number`}
            autoComplete="off"
            value={accountNumber}
            onChange={(event) => setAccountNumber(event.target.value)}
            placeholder="Enter payment account number"
          />
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          Payment type
          <select
            aria-label={`${method.label} payment type`}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={accountType}
            onChange={(event) => setAccountType(event.target.value)}
          >
            <option value="">Not specified</option>
            <option value="personal">Personal</option>
            <option value="merchant">Merchant</option>
            <option value="agent">Agent</option>
          </select>
        </label>
        <label className="grid gap-1.5 text-sm font-medium sm:col-span-2">
          Account holder name (optional)
          <Input
            aria-label={`${method.label} account holder name`}
            value={accountHolderName}
            onChange={(event) => setAccountHolderName(event.target.value)}
            placeholder="Account holder name"
          />
        </label>
        <label className="grid gap-1.5 text-sm font-medium sm:col-span-2">
          Payment instructions (optional)
          <Textarea
            aria-label={`${method.label} payment instructions`}
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
            placeholder="Instructions shown during checkout"
            rows={3}
          />
        </label>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
          />
          Enabled at checkout
        </label>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="destructive"
            disabled={busy}
            onClick={() => void onDelete()}
          >
            <Trash2 />
            Delete {method.label}
          </Button>
          <Button type="submit" disabled={busy}>
            <Save />
            Save {method.label}
          </Button>
        </div>
      </div>
    </form>
  );
}
