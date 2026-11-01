import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { formatPrice } from "@/hooks/use-cart";
import { cakeImage } from "@/lib/cake-images";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/hooks/use-language";

export const Route = createFileRoute("/orders/$id")({
  head: () => ({
    meta: [{ title: "Order details | Smart Cake Shop" }, { name: "robots", content: "noindex" }],
  }),
  component: OrderDetailsPage,
});

function OrderDetailsPage() {
  const { id } = Route.useParams();
  const { user, loading } = useAuth();
  const { t } = useLanguage();
  const statusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: t("pending"),
      confirmed: t("confirmed"),
      preparing: t("preparing"),
      out_for_delivery: t("outForDelivery"),
      delivered: t("delivered"),
      cancelled: t("cancelled"),
    };
    return labels[status] ?? status.replaceAll("_", " ");
  };
  const {
    data: order,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["my-order", user?.id, id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error: queryError } = await supabase
        .from("orders")
        .select("*,order_items(*)")
        .eq("id", id)
        .eq("user_id", user!.id)
        .maybeSingle();
      if (queryError) throw queryError;
      return data;
    },
  });

  if (loading) return <main className="mx-auto max-w-3xl px-4 py-10">{t("loadingAccount")}</main>;
  if (!user) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-3xl">{t("orderDetails")}</h1>
        <p className="mt-3 text-muted-foreground">{t("signInToViewOrder")}</p>
        <Button asChild className="mt-5">
          <Link to="/auth">{t("signIn")}</Link>
        </Button>
      </main>
    );
  }
  if (isLoading) return <main className="mx-auto max-w-3xl px-4 py-10">{t("loading")}</main>;
  if (error) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <p role="alert" className="text-destructive">
          {t("couldNotLoadOrder")}
        </p>
        <Button asChild variant="outline" className="mt-5">
          <Link to="/orders">{t("backToOrders")}</Link>
        </Button>
      </main>
    );
  }
  if (!order) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-3xl">{t("orderNotFound")}</h1>
        <p className="mt-3 text-muted-foreground">{t("orderUnavailable")}</p>
        <Button asChild variant="outline" className="mt-5">
          <Link to="/orders">{t("backToOrders")}</Link>
        </Button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:py-10">
      <Button asChild variant="outline">
        <Link to="/orders">← {t("backToOrders")}</Link>
      </Button>
      <section className="mt-5 rounded-2xl bg-card p-4 shadow-soft sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">
              {t("orderNo")} #{order.id}
            </p>
            <h1 className="mt-1 text-3xl">{t("orderDetails")}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("placed")} {new Date(order.created_at).toLocaleString()}
            </p>
          </div>
          <span className="rounded-full bg-secondary px-3 py-1 text-sm capitalize">
            {statusLabel(order.status)}
          </span>
        </div>

        <h2 className="mt-7 text-xl">{t("itemsHeading")}</h2>
        <ul className="mt-3 divide-y">
          {order.order_items.map((item) => {
            const quantity = item.quantity_num ?? item.quantity;
            const lineTotal = Number(item.unit_price) * Number(quantity);
            return (
              <li key={item.id} className="flex flex-wrap items-center gap-3 py-4">
                {item.image_url ? (
                  <img
                    src={cakeImage(item.image_url)}
                    alt={item.cake_name}
                    className="h-16 w-16 shrink-0 rounded-lg bg-muted object-cover"
                    onError={(event) => {
                      event.currentTarget.hidden = true;
                    }}
                  />
                ) : (
                  <div className="h-16 w-16 shrink-0 rounded-lg bg-muted" aria-hidden="true" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="break-words font-medium">{item.cake_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {item.pounds} lb · Quantity {quantity}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium">{formatPrice(lineTotal)}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatPrice(item.unit_price)} per cake
                  </p>
                </div>
              </li>
            );
          })}
        </ul>

        <dl className="mt-5 grid gap-3 border-t pt-5 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-muted-foreground">{t("totalPayableLabel")}</dt>
            <dd className="font-semibold">{formatPrice(order.total)}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">{t("paymentStatus")}</dt>
            <dd className="capitalize">
              {order.payment_status === "paid"
                ? t("verified")
                : order.payment_status === "failed"
                  ? t("rejected")
                  : order.payment_status === "refunded"
                    ? t("refunded")
                    : t("pending")}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">{t("paymentMethod")}</dt>
            <dd className="capitalize">{order.payment_method.replaceAll("_", " ")}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">{t("fulfilment")}</dt>
            <dd>{order.fulfillment_type === "pickup" ? t("pickup") : t("delivery")}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">{t("orderStatusUpper")}</dt>
            <dd className="capitalize">{statusLabel(order.status)}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">{t("deliveryDate")}</dt>
            <dd>{order.delivery_date || "Not specified"}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">{t("deliveryChargeLabel")}</dt>
            <dd>{formatPrice(order.delivery_charge)}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">{t("discount")}</dt>
            <dd>{formatPrice(order.discount)}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-sm text-muted-foreground">{t("deliveryAreaAddress")}</dt>
            <dd className="break-words">
              {[order.delivery_area, order.address].filter(Boolean).join(" · ") || t("pickup")}
            </dd>
          </div>
          {order.transaction_reference && (
            <div className="sm:col-span-2">
              <dt className="text-sm text-muted-foreground">{t("paymentReference")}</dt>
              <dd className="break-all">{order.transaction_reference}</dd>
            </div>
          )}
          <div>
            <dt className="text-sm text-muted-foreground">{t("contactName")}</dt>
            <dd>{order.customer_name || "Not provided"}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">{t("phone")}</dt>
            <dd>{order.phone || "Not provided"}</dd>
          </div>
          {order.note && (
            <div className="sm:col-span-2">
              <dt className="text-sm text-muted-foreground">{t("orderNote")}</dt>
              <dd className="break-words">{order.note}</dd>
            </div>
          )}
        </dl>
      </section>
    </main>
  );
}
