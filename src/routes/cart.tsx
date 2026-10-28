import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCart, formatPrice, lineKey, linePrice } from "@/hooks/use-cart";
import { isValidQuantity } from "@/lib/order-quantity";
import { PoundSelect } from "@/components/PoundSelect";
import { useAuth } from "@/hooks/use-auth";
import { cakeImage } from "@/lib/cake-images";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [
      { title: "Your cart | Smart Cake Shop" },
      { name: "description", content: "Review your cakes and place a Smart Cake Shop order." },
      { property: "og:title", content: "Your cart | Smart Cake Shop" },
      {
        property: "og:description",
        content: "Review your cakes and place a Smart Cake Shop order.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CartPage,
});

function CartPage() {
  const { items, setPounds, setQty, remove, total, clear } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [f, setF] = useState({ name: "", phone: "", address: "", date: "", note: "" });

  const order = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.some((item) => !isValidQuantity(item.quantity))) {
      toast.error("Cake quantity must be a whole number between 1 and 50.");
      return;
    }
    const { error } = await supabase.rpc("place_order", {
      _items: items.map((i) => ({ cake_id: i.cake_id, quantity: i.quantity, pounds: i.pounds })),
      _name: f.name,
      _phone: f.phone,
      _address: f.address,
      _delivery_date: f.date || null,
      _note: f.note,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    clear();
    toast.success("Order placed! You can track it in My orders.");
    navigate({ to: "/orders" });
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-4xl">Your cart</h1>
      {items.length === 0 ? (
        <p className="mt-6 text-muted-foreground">Your cart is empty.</p>
      ) : (
        <>
          <ul className="mt-6 divide-y">
            {items.map((i) => (
              <li key={lineKey(i)} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
                <div className="flex min-w-0 items-center gap-3 sm:flex-1">
                  {i.image_url ? (
                    <img
                      src={cakeImage(i.image_url)}
                      alt={i.name}
                      className="h-16 w-16 shrink-0 rounded-md object-cover"
                      onError={(event) => {
                        event.currentTarget.hidden = true;
                      }}
                    />
                  ) : (
                    <div className="h-16 w-16 shrink-0 rounded-md bg-muted" />
                  )}
                  <div className="min-w-0">
                    <p className="break-words font-medium">{i.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatPrice(linePrice(i))} per cake
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 text-sm">
                    Weight{" "}
                    <PoundSelect
                      value={i.pounds}
                      onChange={(p) => {
                        if (!setPounds(lineKey(i), p)) {
                          toast.error(
                            "Changing this weight would exceed 50 cakes in one cart line.",
                          );
                        }
                      }}
                    />
                  </label>
                  <QtyStepper value={i.quantity} onChange={(q) => setQty(lineKey(i), q)} />
                  <span className="min-w-20 text-right font-medium">
                    {formatPrice(linePrice(i) * i.quantity)}
                  </span>
                  <Button variant="outline" size="sm" onClick={() => remove(lineKey(i))}>
                    Remove
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-right text-xl">Total: {formatPrice(total)}</p>
          {user ? (
            <form onSubmit={order} className="mt-6 grid gap-3">
              <Input
                placeholder="Name"
                required
                value={f.name}
                onChange={(e) => setF({ ...f, name: e.target.value })}
              />
              <Input
                placeholder="Phone"
                required
                value={f.phone}
                onChange={(e) => setF({ ...f, phone: e.target.value })}
              />
              <Input
                placeholder="Delivery address"
                required
                value={f.address}
                onChange={(e) => setF({ ...f, address: e.target.value })}
              />
              <Input
                type="date"
                value={f.date}
                onChange={(e) => setF({ ...f, date: e.target.value })}
              />
              <Input
                placeholder="Note (message on cake…)"
                value={f.note}
                onChange={(e) => setF({ ...f, note: e.target.value })}
              />
              <Button type="submit" size="lg">
                Place order
              </Button>
            </form>
          ) : (
            <Button asChild className="mt-6">
              <Link to="/auth">Sign in to place your order</Link>
            </Button>
          )}
        </>
      )}
    </main>
  );
}

function QtyStepper({ value, onChange }: { value: number; onChange: (q: number) => void }) {
  const [text, setText] = useState(String(value));
  const [error, setError] = useState("");
  useEffect(() => {
    setText(String(value));
  }, [value]);

  const commit = (raw: string) => {
    const n = Number(raw);
    if (!raw || !isValidQuantity(n)) {
      setText(String(value));
      setError("Enter a whole number between 1 and 50.");
      return;
    }
    setError("");
    setText(String(n));
    onChange(n);
  };

  const bump = (delta: number) => {
    const quantity = value + delta;
    if (!isValidQuantity(quantity)) return;
    setError("");
    setText(String(quantity));
    onChange(quantity);
  };

  return (
    <div>
      <div
        className={`flex w-28 items-stretch overflow-hidden rounded-md border bg-card ${error ? "border-destructive" : "border-input"}`}
      >
        <input
          aria-label="Quantity"
          type="number"
          min={1}
          max={50}
          step={1}
          inputMode="numeric"
          className="min-w-0 flex-1 bg-transparent px-2 py-1.5 text-sm outline-none"
          value={text}
          onChange={(e) => {
            const raw = e.target.value;
            setText(raw);
            if (raw && isValidQuantity(Number(raw))) {
              setError("");
              onChange(Number(raw));
            } else if (raw) {
              setError("Enter a whole number between 1 and 50.");
            }
          }}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit(text);
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              bump(1);
            }
            if (e.key === "ArrowDown") {
              e.preventDefault();
              bump(-1);
            }
          }}
          aria-invalid={!!error}
        />
        <div className="flex flex-col border-l border-input">
          <button
            type="button"
            aria-label="Increase quantity"
            className="flex h-1/2 items-center justify-center px-2 transition-colors hover:bg-muted"
            onClick={() => bump(1)}
          >
            <ChevronUp className="h-3 w-3" />
          </button>
          <button
            type="button"
            aria-label="Decrease quantity"
            className="flex h-1/2 items-center justify-center px-2 transition-colors hover:bg-muted"
            onClick={() => bump(-1)}
          >
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>
      </div>
      {error && (
        <p role="alert" className="mt-1 max-w-36 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
