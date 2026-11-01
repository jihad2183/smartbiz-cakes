import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCart, formatPrice, lineKey, linePrice } from "@/hooks/use-cart";
import { isValidQuantity } from "@/lib/order-quantity";
import { generateUuid } from "@/lib/uuid";
import { PoundSelect } from "@/components/PoundSelect";
import { useAuth } from "@/hooks/use-auth";
import { cakeImage } from "@/lib/cake-images";
import { useNavigate } from "@tanstack/react-router";
import { useSiteContent } from "@/hooks/use-site-content";
import { useFulfillment, type Fulfillment } from "@/hooks/use-fulfillment";
import { OrderProgress } from "@/components/OrderProgress";
import { useLanguage } from "@/hooks/use-language";
import { isValidPhoneNumber } from "@/lib/phone";
import { validateVoucher, type AppliedVoucher } from "@/lib/vouchers";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Checkout | Smart Cake Shop" },
      { name: "description", content: "Review your cakes and place a Smart Cake Shop order." },
      { property: "og:title", content: "Checkout | Smart Cake Shop" },
      {
        property: "og:description",
        content: "Review your cakes and place a Smart Cake Shop order.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CheckoutPage,
});

function CheckoutPage() {
  const { items, setPounds, setQty, remove, total, clear } = useCart();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { fulfillment, setFulfillment } = useFulfillment();
  const { t } = useLanguage();
  const { data: content = {} } = useSiteContent();
  const idempotencyKey = useRef<string | null>(null);
  const [f, setF] = useState({
    name: "",
    phone: "",
    address: "",
    area: "",
    deliveryInstructions: "",
    date: "",
    note: "",
    fulfillment,
    location: "Dhaka",
    postalCode: "",
    payment: "cod",
    reference: "",
    voucherCode: "",
  });
  const [appliedVoucher, setAppliedVoucher] = useState<AppliedVoucher | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [draftOwnerId, setDraftOwnerId] = useState<string | null>(null);
  const pendingVoucherApplied = useRef(false);
  const deliveryCharge =
    f.fulfillment === "delivery"
      ? Math.max(0, Number.parseFloat(content["delivery_charge"] || "0") || 0)
      : 0;
  const checkoutDetails = JSON.stringify({ ...f, appliedVoucher, deliveryCharge });
  const previousCheckoutDetails = useRef(checkoutDetails);
  const { data: profile } = useQuery({
    queryKey: ["checkout-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name,phone,address")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const {
    data: savedAddresses = [],
    error: addressesError,
    isLoading: addressesLoading,
  } = useQuery({
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
  const { data: paymentMethods = [], isLoading: paymentMethodsLoading } = useQuery({
    queryKey: ["payment-methods"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_methods")
        .select("id,label,enabled,instructions")
        .eq("enabled", true)
        .order("label");
      if (error) throw error;
      return data;
    },
  });
  const availablePaymentMethods = paymentMethods.filter(
    (method) =>
      (method.id !== "cod" || f.fulfillment === "delivery") &&
      (method.id !== "cash_pickup" || f.fulfillment === "pickup"),
  );
  const deliveryAvailable = content["home_delivery_enabled"] !== "false";
  const pickupAvailable = content["self_pickup_enabled"] !== "false";
  const fulfillmentOptions: {
    value: Fulfillment;
    title: string;
    description: string;
    available: boolean;
  }[] = [
    {
      value: "delivery" as const,
      title: t("delivery"),
      description: "Delivered to your address",
      available: deliveryAvailable,
    },
    {
      value: "pickup" as const,
      title: t("pickup"),
      description: "Collect your order from our shop",
      available: pickupAvailable,
    },
  ].filter((option) => option.available);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setDraftOwnerId(null);
      return;
    }

    try {
      const saved = sessionStorage.getItem(`smartcake-checkout-draft:${user.id}`);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          const draft = parsed as Record<string, unknown>;
          setF((current) => ({
            ...current,
            name: typeof draft["name"] === "string" ? draft["name"] : current.name,
            phone: typeof draft["phone"] === "string" ? draft["phone"] : current.phone,
            address: typeof draft["address"] === "string" ? draft["address"] : current.address,
            area: typeof draft["area"] === "string" ? draft["area"] : current.area,
            deliveryInstructions:
              typeof draft["deliveryInstructions"] === "string"
                ? draft["deliveryInstructions"]
                : current.deliveryInstructions,
            date: typeof draft["date"] === "string" ? draft["date"] : current.date,
            note: typeof draft["note"] === "string" ? draft["note"] : current.note,
            fulfillment:
              draft["fulfillment"] === "pickup" || draft["fulfillment"] === "delivery"
                ? draft["fulfillment"]
                : current.fulfillment,
            location: typeof draft["location"] === "string" ? draft["location"] : current.location,
            postalCode:
              typeof draft["postalCode"] === "string" ? draft["postalCode"] : current.postalCode,
            payment: typeof draft["payment"] === "string" ? draft["payment"] : current.payment,
            reference:
              typeof draft["reference"] === "string" ? draft["reference"] : current.reference,
            voucherCode:
              typeof draft["voucherCode"] === "string" ? draft["voucherCode"] : current.voucherCode,
          }));
        }
      }
    } catch (draftError) {
      console.error("Could not restore checkout details.", draftError);
      toast.error("Your checkout details could not be restored.");
    }
    setDraftOwnerId(user.id);
  }, [loading, user]);

  useEffect(() => {
    if (!user || draftOwnerId !== user.id) return;
    try {
      sessionStorage.setItem(`smartcake-checkout-draft:${user.id}`, JSON.stringify(f));
    } catch (draftError) {
      console.error("Could not save checkout details.", draftError);
      toast.error("Your checkout details could not be saved for later.");
    }
  }, [draftOwnerId, f, user]);

  useEffect(() => {
    setF((current) => ({ ...current, fulfillment }));
  }, [fulfillment]);
  useEffect(() => {
    if (!profile) return;
    setF((current) => ({
      ...current,
      name: current.name || profile.full_name || "",
      phone: current.phone || profile.phone || "",
      address: current.address || profile.address || "",
    }));
  }, [profile]);
  useEffect(() => {
    const storedAddressId = localStorage.getItem("smartcake-selected-address");
    if (storedAddressId) setSelectedAddressId(storedAddressId);
  }, []);
  useEffect(() => {
    if (!savedAddresses.length) return;
    const address =
      savedAddresses.find((entry) => entry.id === selectedAddressId) ?? savedAddresses[0];
    if (!address) return;
    if (address.id !== selectedAddressId) setSelectedAddressId(address.id);
    localStorage.setItem("smartcake-selected-address", address.id);
    setF((current) => ({
      ...current,
      name: current.name || address.recipient_name,
      phone: current.phone || address.phone,
      address: address.address_line,
      area: address.area,
      location: address.city,
      postalCode: address.postal_code ?? "",
    }));
  }, [savedAddresses, selectedAddressId]);
  useEffect(() => {
    setAppliedVoucher(null);
    setReviewed(false);
    pendingVoucherApplied.current = false;
  }, [total]);
  useEffect(() => {
    if (!user || total <= 0 || pendingVoucherApplied.current) return;
    const pendingCode =
      sessionStorage.getItem("smartcake-selected-voucher") || f.voucherCode.trim();
    if (!pendingCode) return;
    pendingVoucherApplied.current = true;
    let active = true;
    void validateVoucher(pendingCode, total)
      .then((voucher) => {
        if (!active) return;
        setAppliedVoucher(voucher);
        setF((current) => ({ ...current, voucherCode: voucher.code }));
      })
      .catch((voucherError: unknown) => {
        if (!active) return;
        setAppliedVoucher(null);
        setF((current) => ({ ...current, voucherCode: "" }));
        toast.error(
          voucherError instanceof Error ? voucherError.message : "Voucher could not be applied.",
        );
      })
      .finally(() => {
        try {
          sessionStorage.removeItem("smartcake-selected-voucher");
        } catch (storageError) {
          console.error("Could not clear the selected voucher from this browser.", storageError);
        }
      });
    return () => {
      active = false;
    };
  }, [f.voucherCode, total, user]);
  useEffect(() => {
    if (previousCheckoutDetails.current === checkoutDetails) return;
    previousCheckoutDetails.current = checkoutDetails;
    setReviewed(false);
  }, [checkoutDetails]);
  useEffect(() => {
    if (availablePaymentMethods.length === 0) return;
    if (availablePaymentMethods.some((method) => method.id === f.payment)) return;
    setF((current) => ({ ...current, payment: availablePaymentMethods[0]?.id ?? "" }));
  }, [availablePaymentMethods, f.payment]);
  useEffect(() => {
    if (f.fulfillment === "delivery" && !deliveryAvailable && pickupAvailable) {
      setF((current) => ({ ...current, fulfillment: "pickup" }));
    } else if (f.fulfillment === "pickup" && !pickupAvailable && deliveryAvailable) {
      setF((current) => ({ ...current, fulfillment: "delivery" }));
    }
  }, [deliveryAvailable, f.fulfillment, pickupAvailable]);

  const discount = appliedVoucher ? Math.min(total, appliedVoucher.discount) : 0;
  const payable = Math.max(0, total - discount + deliveryCharge);
  const selectedPayment = paymentMethods.find((method) => method.id === f.payment);
  const mobilePayment = ["bkash", "nagad", "rocket", "upay"].includes(f.payment);

  const order = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error("Sign in to place your order.");
      return;
    }
    if (items.some((item) => !isValidQuantity(item.quantity))) {
      toast.error("Cake quantity must be a whole number between 1 and 50.");
      return;
    }
    if (!isValidPhoneNumber(f.phone)) {
      sessionStorage.setItem("smartcake-checkout-return", "1");
      toast.error(
        "A valid phone number is required before placing an order. Add one to your profile.",
      );
      navigate({ to: "/edit-profile" });
      return;
    }
    if (!f.name.trim()) {
      toast.error("Enter your name before placing the order.");
      return;
    }
    if (
      f.fulfillment === "delivery" &&
      (!f.address.trim() || !f.area.trim() || !f.location.trim())
    ) {
      toast.error("Enter your house, road, area, and city for home delivery.");
      return;
    }
    if (!reviewed) {
      toast.error("Review and confirm your order details before placing the order.");
      return;
    }
    setSubmitting(true);
    try {
      idempotencyKey.current ??= generateUuid();
      const { data: orderId, error } = await supabase.rpc("place_order_once", {
        _idempotency_key: idempotencyKey.current,
        _items: items.map((i) => ({ cake_id: i.cake_id, quantity: i.quantity, pounds: i.pounds })),
        _name: f.name,
        _phone: f.phone,
        _address: f.fulfillment === "delivery" ? f.address : "",
        _delivery_date: f.date || null,
        _note: [
          f.note.trim(),
          f.fulfillment === "delivery" && f.deliveryInstructions.trim()
            ? `Delivery instructions: ${f.deliveryInstructions.trim()}`
            : "",
        ]
          .filter(Boolean)
          .join("\n"),
        _fulfillment_type: f.fulfillment,
        _delivery_area:
          f.fulfillment === "delivery"
            ? `${f.location} · ${f.area}${f.postalCode.trim() ? ` · ${f.postalCode.trim()}` : ""}`
            : "",
        _payment_method: f.payment,
        _transaction_reference: f.reference,
        _voucher_code: appliedVoucher?.code ?? "",
      });
      if (error) throw new Error(error.message);
      if (typeof orderId !== "string") {
        throw new Error("Order could not be confirmed. Your cart is still available to retry.");
      }
      clear();
      idempotencyKey.current = null;
      sessionStorage.removeItem(`smartcake-checkout-draft:${user.id}`);
      sessionStorage.removeItem("smartcake-selected-voucher");
      toast.success(
        mobilePayment
          ? "Order submitted. Mobile payment remains pending until the shop verifies it."
          : "Order placed. You can track its status in your account.",
      );
      navigate({ to: "/orders/$id", params: { id: orderId } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Your order could not be placed.");
    } finally {
      setSubmitting(false);
    }
  };

  const saveAddress = async () => {
    if (!user) return;
    if (
      !f.name.trim() ||
      !f.phone.trim() ||
      !f.address.trim() ||
      !f.area.trim() ||
      !f.location.trim()
    ) {
      toast.error(
        "Enter your name, valid phone number, house and road, area, and city before saving.",
      );
      return;
    }
    if (!isValidPhoneNumber(f.phone)) {
      toast.error("Enter a valid phone number.");
      return;
    }
    const addressPayload = {
      user_id: user.id,
      recipient_name: f.name.trim(),
      phone: f.phone.trim(),
      address_line: f.address.trim(),
      area: f.area.trim(),
      city: f.location.trim(),
      postal_code: f.postalCode.trim() || null,
    };
    const { data, error } = selectedAddressId
      ? await supabase
          .from("customer_addresses")
          .update(addressPayload)
          .eq("user_id", user.id)
          .eq("id", selectedAddressId)
          .select("*")
          .single()
      : await supabase.from("customer_addresses").insert(addressPayload).select("*").single();
    if (error) {
      toast.error(error.message);
      return;
    }
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        full_name: f.name.trim(),
        phone: f.phone.trim(),
        address: f.address.trim(),
      })
      .eq("id", user.id);
    if (profileError) {
      toast.error(
        `Address saved, but profile details could not be updated: ${profileError.message}`,
      );
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["customer-addresses", user.id] });
    await queryClient.invalidateQueries({ queryKey: ["my-profile", user.id] });
    await queryClient.invalidateQueries({ queryKey: ["checkout-profile", user.id] });
    setSelectedAddressId(data.id);
    localStorage.setItem("smartcake-selected-address", data.id);
    toast.success("Delivery address saved to your account.");
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
      <OrderProgress step="checkout" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-4xl">{t("reviewPaymentAddress")}</h1>
        <Button asChild variant="outline">
          <Link to="/cart">{t("backToCart")}</Link>
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
        <div className="mt-7 grid items-start gap-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
          <div className="space-y-7">
            <section className="rounded-2xl bg-card p-4 shadow-soft sm:p-6">
              <h2 className="text-xl font-semibold">{t("orderItems")}</h2>
              <ul className="mt-3 divide-y">
                {items.map((i) => (
                  <li
                    key={lineKey(i)}
                    className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center"
                  >
                    <div className="flex min-w-0 items-center gap-3 sm:flex-1">
                      {i.image_url ? (
                        <img
                          src={cakeImage(i.image_url)}
                          alt={i.name}
                          className="h-16 w-16 shrink-0 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="h-16 w-16 shrink-0 rounded-lg bg-muted" />
                      )}
                      <div className="min-w-0">
                        <p className="break-words font-medium">{i.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {i.pounds} lb · {formatPrice(linePrice(i))} each
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="flex items-center gap-2 text-sm">
                        {t("size")}
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
                        {t("remove")}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            {loading ? (
              <p className="text-muted-foreground">{t("loadingAccount")}</p>
            ) : user ? (
              <form id="checkout-form" noValidate onSubmit={order} className="space-y-6">
                <section className="rounded-2xl bg-card p-4 shadow-soft sm:p-6">
                  <h2 className="text-xl font-semibold">{t("contactFulfilment")}</h2>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <label className="grid gap-1.5 text-sm font-medium">
                      {t("customerName")}
                      <Input
                        required
                        value={f.name}
                        onChange={(e) => setF({ ...f, name: e.target.value })}
                      />
                    </label>
                    <label className="grid gap-1.5 text-sm font-medium">
                      {t("emailAddress")}
                      <Input type="email" value={user?.email ?? ""} readOnly />
                    </label>
                    <label className="grid gap-1.5 text-sm font-medium">
                      {t("phoneNumber")}
                      <Input
                        type="tel"
                        autoComplete="tel"
                        value={f.phone}
                        onChange={(e) => setF({ ...f, phone: e.target.value })}
                      />
                    </label>
                  </div>
                  <fieldset className="mt-5">
                    <legend className="text-sm font-medium">
                      {t("delivery")} / {t("pickup")}
                    </legend>
                    <div className="mt-2 grid gap-3 sm:grid-cols-2">
                      {fulfillmentOptions.map(({ value, title, description }) => (
                        <label
                          key={value}
                          className={`cursor-pointer rounded-xl border p-4 ${f.fulfillment === value ? "border-primary bg-primary/5" : "border-input"}`}
                        >
                          <input
                            type="radio"
                            name="fulfillment"
                            value={value}
                            checked={f.fulfillment === value}
                            onChange={() => {
                              const payment =
                                value === "pickup" && f.payment === "cod"
                                  ? "cash_pickup"
                                  : value === "delivery" && f.payment === "cash_pickup"
                                    ? "cod"
                                    : f.payment;
                              setF({ ...f, fulfillment: value, payment });
                              setFulfillment(value);
                            }}
                            className="sr-only"
                          />
                          <span className="font-medium">{title}</span>
                          <span className="mt-1 block text-sm text-muted-foreground">
                            {description}
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  {fulfillmentOptions.length === 0 && (
                    <p role="alert" className="mt-3 text-sm text-destructive">
                      Online delivery and pick-up are temporarily unavailable. Please contact the
                      shop.
                    </p>
                  )}
                  {f.fulfillment === "delivery" && (
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <label className="grid gap-1.5 text-sm font-medium">
                        {t("cityDistrict")}
                        <Input
                          required
                          autoComplete="address-level2"
                          value={f.location}
                          onChange={(e) => setF({ ...f, location: e.target.value })}
                        />
                      </label>
                      <label className="grid gap-1.5 text-sm font-medium">
                        {t("areaNeighbourhood")}
                        <Input
                          required
                          autoComplete="address-level3"
                          value={f.area}
                          placeholder="e.g. Dhanmondi"
                          onChange={(e) => setF({ ...f, area: e.target.value })}
                        />
                      </label>
                      <label className="grid gap-1.5 text-sm font-medium sm:col-span-2">
                        {t("houseRoad")}
                        <Input
                          required
                          autoComplete="street-address"
                          value={f.address}
                          placeholder="House, road, and any delivery directions"
                          onChange={(e) => setF({ ...f, address: e.target.value })}
                        />
                      </label>
                      <label className="grid gap-1.5 text-sm font-medium sm:col-span-2">
                        Delivery instructions (optional)
                        <Input
                          value={f.deliveryInstructions}
                          placeholder="Gate, floor, or other delivery details"
                          onChange={(e) => setF({ ...f, deliveryInstructions: e.target.value })}
                        />
                      </label>
                      <label className="grid gap-1.5 text-sm font-medium">
                        {t("postalCode")}
                        <Input
                          autoComplete="postal-code"
                          value={f.postalCode}
                          onChange={(e) => setF({ ...f, postalCode: e.target.value })}
                        />
                      </label>
                      {savedAddresses.length > 0 && (
                        <label className="grid gap-1.5 text-sm font-medium sm:col-span-2">
                          {t("savedAddress")}
                          <select
                            className="h-10 rounded-md border border-input bg-background px-3"
                            value={selectedAddressId}
                            onChange={(event) => {
                              const address = savedAddresses.find(
                                (entry) => entry.id === event.target.value,
                              );
                              setSelectedAddressId(event.target.value);
                              if (event.target.value) {
                                localStorage.setItem(
                                  "smartcake-selected-address",
                                  event.target.value,
                                );
                              } else {
                                localStorage.removeItem("smartcake-selected-address");
                              }
                              if (address) {
                                setF((current) => ({
                                  ...current,
                                  name: address.recipient_name,
                                  phone: address.phone,
                                  address: address.address_line,
                                  area: address.area,
                                  location: address.city,
                                  postalCode: address.postal_code ?? "",
                                }));
                              } else {
                                setF((current) => ({
                                  ...current,
                                  address: "",
                                  area: "",
                                  location: "",
                                  postalCode: "",
                                }));
                              }
                            }}
                          >
                            <option value="">{t("addNewAddress")}</option>
                            {savedAddresses.map((address) => (
                              <option key={address.id} value={address.id}>
                                {address.recipient_name} · {address.address_line}, {address.area},{" "}
                                {address.city}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                      {addressesError && (
                        <p role="alert" className="text-sm text-destructive sm:col-span-2">
                          Saved addresses could not be loaded. You can still enter an address for
                          this order.
                        </p>
                      )}
                      <div className="sm:col-span-2">
                        <Button
                          type="button"
                          variant="outline"
                          disabled={addressesLoading}
                          onClick={() => void saveAddress()}
                        >
                          {addressesLoading
                            ? t("loading")
                            : selectedAddressId
                              ? t("saveChanges")
                              : t("saveAddress")}
                        </Button>
                      </div>
                    </div>
                  )}
                  {f.fulfillment === "pickup" && (
                    <p className="mt-4 rounded-lg bg-secondary/60 p-3 text-sm text-muted-foreground">
                      {content["shop_address"] || t("pickupAddressMissing")}
                    </p>
                  )}
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <label className="grid gap-1.5 text-sm font-medium">
                      {f.fulfillment === "pickup" ? "Pickup Date" : t("deliveryDate")}
                      <Input
                        type="date"
                        min={new Date().toISOString().slice(0, 10)}
                        value={f.date}
                        onChange={(e) => setF({ ...f, date: e.target.value })}
                      />
                    </label>
                    <label className="grid gap-1.5 text-sm font-medium">
                      {t("orderNote")}
                      <Input
                        value={f.note}
                        placeholder="Message on cake or special instructions"
                        onChange={(e) => setF({ ...f, note: e.target.value })}
                      />
                    </label>
                  </div>
                </section>

                <section className="rounded-2xl bg-card p-4 shadow-soft sm:p-6">
                  <h2 className="text-xl font-semibold">{t("paymentMethod")}</h2>
                  {availablePaymentMethods.length > 0 ? (
                    <div className="mt-4">
                      <p className="text-sm font-medium">{t("paymentMethod")}</p>
                      <div className="mt-2 grid gap-2">
                        {availablePaymentMethods.map((method) => (
                          <label
                            key={method.id}
                            className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 ${
                              f.payment === method.id
                                ? "border-primary bg-primary/5"
                                : "border-input"
                            }`}
                          >
                            <input
                              type="radio"
                              name="payment-method"
                              value={method.id}
                              checked={f.payment === method.id}
                              onChange={() => setF({ ...f, payment: method.id, reference: "" })}
                            />
                            <span className="grid h-9 min-w-12 place-items-center rounded-md bg-secondary px-2 text-xs font-bold uppercase text-cocoa">
                              {method.id === "bkash"
                                ? "bKash"
                                : method.id === "nagad"
                                  ? "Nagad"
                                  : method.id === "rocket"
                                    ? "Rocket"
                                    : method.id === "upay"
                                      ? "upay"
                                      : method.label.slice(0, 2)}
                            </span>
                            <span className="font-medium">{method.label}</span>
                          </label>
                        ))}
                      </div>
                      {!availablePaymentMethods.some((method) => method.id === "upay") && (
                        <div
                          className="mt-2 flex items-center gap-3 rounded-xl border border-dashed p-3 text-muted-foreground"
                          aria-disabled="true"
                        >
                          <input type="radio" name="payment-method" disabled />
                          <span className="grid h-9 min-w-12 place-items-center rounded-md bg-muted px-2 text-xs font-bold uppercase">
                            upay
                          </span>
                          <span className="text-sm">upay · {t("paymentSetupRequired")}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p role="alert" className="mt-4 text-sm text-destructive">
                      {paymentMethodsLoading
                        ? t("loading")
                        : "No payment methods are currently available. Please contact the shop."}
                    </p>
                  )}
                  {mobilePayment && (
                    <div className="mt-4 space-y-3 rounded-lg bg-secondary/50 p-4 text-sm">
                      <p className="font-medium">Manual payment reference</p>
                      <p className="text-xs font-medium text-amber-800">
                        {t("manualVerification")}
                      </p>
                      <p className="text-muted-foreground">
                        {selectedPayment?.instructions ||
                          "Contact the shop for current payment instructions."}
                      </p>
                      <label className="grid gap-1.5 font-medium">
                        Transaction ID / reference
                        <Input
                          required
                          value={f.reference}
                          onChange={(e) => setF({ ...f, reference: e.target.value })}
                          placeholder="Enter your payment reference"
                        />
                      </label>
                    </div>
                  )}
                  {f.payment === "upay" && (
                    <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                      upay payment references require manual review; no gateway verification is
                      configured. The order remains pending until the shop verifies payment.
                    </p>
                  )}
                </section>
              </form>
            ) : (
              <section className="rounded-2xl bg-card p-5 shadow-soft">
                <p className="font-medium">{t("signInToContinue")}</p>
                <Button asChild className="mt-4">
                  <Link to="/auth">{t("signIn")}</Link>
                </Button>
              </section>
            )}
          </div>

          <aside className="space-y-4 lg:sticky lg:top-28">
            <section className="rounded-2xl bg-card p-4 shadow-soft sm:p-6">
              <h2 className="text-xl font-semibold">{t("voucherCode")}</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Choose an eligible voucher or enter a code on the voucher page.
              </p>
              <Button asChild type="button" variant="outline" className="mt-3 w-full">
                <Link to="/vouchers">Apply Voucher</Link>
              </Button>
              {appliedVoucher && (
                <p className="mt-2 text-sm text-green-700">
                  {appliedVoucher.code} applied · {formatPrice(discount)} off
                </p>
              )}
            </section>
            <section className="rounded-2xl bg-card p-4 shadow-soft sm:p-6">
              <h2 className="text-xl font-semibold">{t("orderSummary")}</h2>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between gap-3">
                  <dt>
                    {t("items")} ({items.reduce((sum, item) => sum + item.quantity, 0)})
                  </dt>
                  <dd>{formatPrice(total)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt>{f.fulfillment === "pickup" ? t("pickup") : t("deliveryCharge")}</dt>
                  <dd>{deliveryCharge ? formatPrice(deliveryCharge) : "Free"}</dd>
                </div>
                <div className="flex justify-between gap-3 text-green-700">
                  <dt>Discount</dt>
                  <dd>−{formatPrice(discount)}</dd>
                </div>
                <div className="flex justify-between gap-3 border-t pt-3 text-lg font-semibold">
                  <dt>{t("totalPayable")}</dt>
                  <dd>{formatPrice(payable)}</dd>
                </div>
              </dl>
              {user && (
                <label className="mt-5 flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={reviewed}
                    onChange={(e) => setReviewed(e.target.checked)}
                    className="mt-1"
                  />
                  <span>{t("reviewConfirmation")}</span>
                </label>
              )}
              {user ? (
                <Button
                  type="submit"
                  form="checkout-form"
                  size="lg"
                  className="mt-5 w-full"
                  disabled={
                    submitting ||
                    !reviewed ||
                    loading ||
                    !selectedPayment ||
                    fulfillmentOptions.length === 0
                  }
                >
                  {submitting ? "Placing order…" : t("confirmAddressPlaceOrder")}
                </Button>
              ) : (
                <Button asChild className="mt-5 w-full">
                  <Link to="/auth">Sign in to place order</Link>
                </Button>
              )}
              <p className="mt-3 text-xs text-muted-foreground">{t("orderStatusAvailable")}</p>
            </section>
          </aside>
        </div>
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
