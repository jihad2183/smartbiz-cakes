import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PaymentMethodSettings } from "@/components/admin/PaymentMethodSettings";
import { PaymentMethodDetails } from "@/components/PaymentMethodDetails";
import { readFileSync } from "node:fs";
import type { Tables } from "@/integrations/supabase/types";

const paymentMethod: Tables<"payment_methods"> = {
  id: "bkash",
  label: "bKash",
  enabled: false,
  instructions: "",
  account_number: null,
  account_type: null,
  account_holder_name: null,
  updated_at: "2026-01-01T00:00:00.000Z",
};

describe("Payment method configuration", () => {
  it("saves the account details, instructions, and enabled state from the admin editor", async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    render(
      <PaymentMethodSettings
        method={paymentMethod}
        busy={false}
        onSave={onSave}
        onDelete={vi.fn().mockResolvedValue(true)}
      />,
    );

    fireEvent.change(screen.getByLabelText("bKash account number"), {
      target: { value: "01712345678" },
    });
    fireEvent.change(screen.getByLabelText("bKash payment type"), {
      target: { value: "merchant" },
    });
    fireEvent.change(screen.getByLabelText("bKash account holder name"), {
      target: { value: "Smart Cake Shop" },
    });
    fireEvent.change(screen.getByLabelText("bKash payment instructions"), {
      target: { value: "Use Send Money." },
    });
    fireEvent.click(screen.getByLabelText("Enabled at checkout"));
    fireEvent.click(screen.getByRole("button", { name: "Save bKash" }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({
        account_number: "01712345678",
        account_type: "merchant",
        account_holder_name: "Smart Cake Shop",
        instructions: "Use Send Money.",
        enabled: true,
      });
    });
  });

  it("allows an administrator to delete a configured payment method", async () => {
    const onDelete = vi.fn().mockResolvedValue(true);
    render(
      <PaymentMethodSettings
        method={paymentMethod}
        busy={false}
        onSave={vi.fn().mockResolvedValue(true)}
        onDelete={onDelete}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete bKash" }));
    await waitFor(() => expect(onDelete).toHaveBeenCalledOnce());
  });
});

describe("Checkout payment details", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it("displays configured details and copies the selected account number", async () => {
    render(
      <PaymentMethodDetails
        accountNumber="01712345678"
        accountType="personal"
        accountHolderName="Shop Owner"
        instructions="Use Send Money."
      />,
    );

    expect(screen.getByTestId("payment-account-number")).toHaveTextContent("01712345678");
    expect(screen.getByText("personal")).toBeInTheDocument();
    expect(screen.getByText("Shop Owner")).toBeInTheDocument();
    expect(screen.getByText("Use Send Money.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Copy number" }));
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith("01712345678");
    });
  });

  it("keeps the existing RLS rules and limits checkout to enabled methods", () => {
    const paymentsMigration = readFileSync(
      "drizzle/migrations/0008_checkout_vouchers_payments.sql",
      "utf8",
    );
    const accountDetailsMigration = readFileSync(
      "drizzle/migrations/0016_payment_method_account_details.sql",
      "utf8",
    );
    const checkout = readFileSync("src/routes/checkout.tsx", "utf8");
    const admin = readFileSync("src/routes/admin.tsx", "utf8");

    expect(paymentsMigration).toContain('"read enabled payment methods"');
    expect(paymentsMigration).toContain('"admins manage payment methods"');
    expect(accountDetailsMigration).toContain("ADD COLUMN IF NOT EXISTS account_number text");
    expect(accountDetailsMigration).toContain("ADD COLUMN IF NOT EXISTS account_holder_name text");
    expect(accountDetailsMigration).toContain("ADD COLUMN IF NOT EXISTS account_type text");
    expect(accountDetailsMigration).toContain("account_type IN ('personal', 'merchant', 'agent')");
    expect(accountDetailsMigration).toContain("NOTIFY pgrst, 'reload schema'");
    expect(checkout).toContain('.eq("enabled", true)');
    expect(checkout).toContain("account_number,account_type,account_holder_name");
    expect(admin).toContain('.from("payment_methods").insert({');
    expect(admin).toContain('.from("payment_methods").delete()');
  });
});
