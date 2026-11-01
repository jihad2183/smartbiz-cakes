import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Minus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PoundSelect } from "@/components/PoundSelect";
import { useCart, formatPrice, lineKey, linePrice } from "@/hooks/use-cart";
import { cakeImage } from "@/lib/cake-images";
import { OrderProgress } from "@/components/OrderProgress";
import { useFulfillment } from "@/hooks/use-fulfillment";
import { useSiteContent } from "@/hooks/use-site-content";
import { useLanguage } from "@/hooks/use-language";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [
      { title: "Your cart | Smart Cake Shop" },
      { name: "description", content: "Review your selected cakes before checkout." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CartPage,
});

function CartPage() {
  const { items, setQty, setPounds, remove, total, count } = useCart();
  const { fulfillment, setFulfillment } = useFulfillment();
  const { user } = useAuth();
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const { data: content = {} } = useSiteContent();
  const { t } = useLanguage();
  const { data: addresses = [], error: addressesError } = useQuery({
    queryKey: ["customer-addresses", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_addresses")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const deliveryCharge =
    fulfillment === "delivery" ? Math.max(0, Number(content["delivery_charge"] || 0) || 0) : 0;
  const deliveryAvailable = content["home_delivery_enabled"] !== "false";
  const pickupAvailable = content["self_pickup_enabled"] !== "false";
  useEffect(() => {
    const savedAddressId = localStorage.getItem("smartcake-selected-address");
    if (savedAddressId) setSelectedAddressId(savedAddressId);
  }, []);
  useEffect(() => {
    if (selectedAddressId && !addresses.some((address) => address.id === selectedAddressId)) {
      setSelectedAddressId("");
    }
  }, [addresses, selectedAddressId]);
  useEffect(() => {
    if (fulfillment === "delivery" && !deliveryAvailable && pickupAvailable) {
      setFulfillment("pickup");
    } else if (fulfillment === "pickup" && !pickupAvailable && deliveryAvailable) {
      setFulfillment("delivery");
    }
  }, [deliveryAvailable, fulfillment, pickupAvailable, setFulfillment]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
      <OrderProgress step="cart" />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            {count} {t("items")}
          </p>
          <h1 className="font-display text-4xl">{t("cart")}</h1>
        </div>
        <Button asChild variant="outline">
          <Link to="/cakes" search={{ q: "" }}>
            {t("continueShopping")}
          </Link>
        </Button>
      </div>

      {items.length === 0 ? (
        <section className="mt-7 rounded-2xl bg-card p-8 text-center shadow-soft">
          <p className="text-lg font-medium">{t("emptyCart")}</p>
          <p className="mt-2 text-muted-foreground">{t("addCakeToStart")}</p>
          <Button asChild className="mt-5">
            <Link to="/cakes" search={{ q: "" }}>
              {t("browseCakes")}
            </Link>
          </Button>
        </section>
      ) : (
        <div className="mt-7 grid items-start gap-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)]">
          <div className="space-y-5">
            <section className="rounded-2xl bg-card p-4 shadow-soft sm:p-6">
              <h2 className="text-xl font-semibold">{t("fulfilmentChoice")}</h2>
              <fieldset className="mt-3 grid gap-3 sm:grid-cols-2">
                <legend className="sr-only">Choose order fulfilment</legend>
                {[
                  {
                    value: "delivery" as const,
                    label: t("delivery"),
                    available: deliveryAvailable,
                  },
                  { value: "pickup" as const, label: t("pickup"), available: pickupAvailable },
                ].map((option) => (
                  <label
                    key={option.value}
                    className={`rounded-xl border p-4 ${
                      !option.available ? "cursor-not-allowed opacity-50" : "cursor-pointer"
                    } ${
                      fulfillment === option.value ? "border-primary bg-primary/5" : "border-input"
                    }`}
                  >
                    <input
                      type="radio"
                      name="cart-fulfillment"
                      checked={fulfillment === option.value}
                      disabled={!option.available}
                      onChange={() => setFulfillment(option.value)}
                      className="mr-2 accent-primary"
                    />
                    <span className="font-medium">{option.label}</span>
                    {option.value === "pickup" ? (
                      <span className="mt-1 block text-sm text-muted-foreground">
                        {content["shop_address"] || t("pickup")}
                      </span>
                    ) : (
                      <span className="mt-1 block text-sm text-muted-foreground">
                        {t("deliveryCharge")}:{" "}
                        {deliveryCharge ? formatPrice(deliveryCharge) : t("free")}
                      </span>
                    )}
                  </label>
                ))}
              </fieldset>
              {fulfillment === "pickup" && (
                <p className="mt-3 text-sm text-muted-foreground">
                  {t("pickupDiscountNotConfigured")}
                </p>
              )}
              {fulfillment === "delivery" && (
                <div className="mt-3 space-y-2">
                  {user && addresses.length > 0 ? (
                    <label className="grid gap-1.5 text-sm font-medium">
                      {t("savedAddress")}
                      <select
                        className="h-10 rounded-md border border-input bg-background px-3"
                        value={selectedAddressId}
                        onChange={(event) => {
                          setSelectedAddressId(event.target.value);
                          localStorage.setItem("smartcake-selected-address", event.target.value);
                        }}
                      >
                        <option value="">{t("chooseAddress")}</option>
                        {addresses.map((address) => (
                          <option key={address.id} value={address.id}>
                            {address.recipient_name} · {address.address_line}, {address.area},{" "}
                            {address.city}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {t("chooseDeliveryAddressCheckout")}
                    </p>
                  )}
                  {addressesError && (
                    <p role="alert" className="text-sm text-destructive">
                      Saved addresses could not be loaded. You can still add one at checkout.
                    </p>
                  )}
                  {selectedAddressId &&
                    addresses.find((address) => address.id === selectedAddressId) && (
                      <p className="text-sm text-muted-foreground">
                        {(() => {
                          const address = addresses.find(
                            (entry) => entry.id === selectedAddressId,
                          )!;
                          return `${address.address_line}, ${address.area}, ${address.city}`;
                        })()}
                      </p>
                    )}
                </div>
              )}
            </section>
            <section className="rounded-2xl bg-card p-4 shadow-soft sm:p-6">
              <h2 className="text-xl font-semibold">{t("selectedCakes")}</h2>
              <ul className="mt-3 divide-y">
                {items.map((item) => {
                  const key = lineKey(item);
                  return (
                    <li key={key} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
                      <div className="flex min-w-0 items-center gap-3 sm:flex-1">
                        {item.image_url ? (
                          <img
                            src={cakeImage(item.image_url)}
                            alt={item.name}
                            className="h-16 w-16 shrink-0 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="h-16 w-16 shrink-0 rounded-lg bg-muted" />
                        )}
                        <div className="min-w-0">
                          <p className="break-words font-medium">{item.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {item.pounds} lb · {formatPrice(linePrice(item))} each
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <label className="flex items-center gap-2 text-sm">
                          {t("size")}
                          <PoundSelect
                            value={item.pounds}
                            onChange={(pounds) => {
                              if (!setPounds(key, pounds)) {
                                toast.error(
                                  "Changing this weight would exceed 50 cakes in one cart line.",
                                );
                              }
                            }}
                          />
                        </label>
                        <div
                          className="flex items-center gap-1"
                          aria-label={`Quantity for ${item.name}`}
                        >
                          <Button
                            variant="outline"
                            size="icon"
                            aria-label={`Decrease ${item.name} quantity`}
                            disabled={item.quantity <= 1}
                            onClick={() => setQty(key, item.quantity - 1)}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <span className="min-w-8 text-center" aria-live="polite">
                            {item.quantity}
                          </span>
                          <Button
                            variant="outline"
                            size="icon"
                            aria-label={`Increase ${item.name} quantity`}
                            disabled={item.quantity >= 50}
                            onClick={() => setQty(key, item.quantity + 1)}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                        <span className="min-w-20 text-right font-medium">
                          {formatPrice(linePrice(item) * item.quantity)}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`${t("remove")} ${item.name}`}
                          onClick={() => remove(key)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-28">
            <section className="rounded-2xl bg-card p-4 shadow-soft sm:p-6">
              <h2 className="text-xl font-semibold">{t("orderSummary")}</h2>
              <div className="mt-4 flex justify-between gap-3 text-sm">
                <span>
                  {t("subtotal")} ({count})
                </span>
                <span>{formatPrice(total)}</span>
              </div>
              <div className="mt-3 flex justify-between gap-3 text-sm">
                <span>{fulfillment === "pickup" ? t("pickup") : t("deliveryCharge")}</span>
                <span>{deliveryCharge ? formatPrice(deliveryCharge) : t("free")}</span>
              </div>
              <div className="mt-3 flex justify-between gap-3 border-t pt-3 font-semibold">
                <span>{t("totalPayable")}</span>
                <span>{formatPrice(total + deliveryCharge)}</span>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                Voucher discount is validated and applied at checkout.
              </p>
              <Button asChild variant="outline" className="mt-4 w-full">
                <Link to="/vouchers">Apply Voucher</Link>
              </Button>
              <Button asChild size="lg" className="mt-5 w-full">
                <Link to="/checkout">{t("continueCheckout")}</Link>
              </Button>
            </section>
          </aside>
        </div>
      )}
    </main>
  );
}
