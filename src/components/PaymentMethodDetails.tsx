import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type Props = {
  accountNumber: string | null;
  accountType: string | null;
  accountHolderName: string | null;
  instructions: string | null;
};

export function PaymentMethodDetails({
  accountNumber,
  accountType,
  accountHolderName,
  instructions,
}: Props) {
  const copyNumber = async () => {
    if (!accountNumber) return;
    try {
      if (!navigator.clipboard) throw new Error("Clipboard access is unavailable in this browser.");
      await navigator.clipboard.writeText(accountNumber);
      toast.success("Payment number copied");
    } catch (error) {
      console.error("Could not copy the payment account number.", error);
      toast.error("Could not copy the payment number. Please copy it manually.");
    }
  };

  return (
    <div className="space-y-3 rounded-lg bg-secondary/50 p-4 text-sm">
      {accountNumber ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Send payment to</p>
            <p className="break-all text-lg font-semibold" data-testid="payment-account-number">
              {accountNumber}
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => void copyNumber()}>
            <Copy />
            Copy number
          </Button>
        </div>
      ) : (
        <p className="font-medium">Payment account number has not been configured.</p>
      )}
      {accountType && (
        <p>
          Account type: <span className="font-medium capitalize">{accountType}</span>
        </p>
      )}
      {accountHolderName && (
        <p>
          Account holder: <span className="font-medium">{accountHolderName}</span>
        </p>
      )}
      <p className="whitespace-pre-wrap">
        {instructions || "Contact the shop for current payment instructions."}
      </p>
    </div>
  );
}
