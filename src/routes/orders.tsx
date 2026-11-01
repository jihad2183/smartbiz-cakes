import { createFileRoute, Link, Outlet, useMatchRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { formatPrice } from "@/hooks/use-cart";
import { cakeImage } from "@/lib/cake-images";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/hooks/use-language";

export const Route = createFileRoute("/orders")({
  head: () => ({
    meta: [
      { title: "My orders | Smart Cake Shop" },
      { name: "description", content: "Track your cake orders at Smart Cake Shop." },
      { property: "og:title", content: "My orders | Smart Cake Shop" },
      { property: "og:description", content: "Track your cake orders at Smart Cake Shop." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OrdersPage,
});

function OrdersPage() {
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
  const isOrderDetail = useMatchRoute()({ to: "/orders/$id" });
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["my-orders", user?.id],
    enabled: !!user && !isOrderDetail,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*,order_items(*)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  if (isOrderDetail) return <Outlet />;
  if (loading) return <main className="mx-auto max-w-3xl px-4 py-10">{t("loading")}</main>;
  if (!user)
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-4xl">{t("myOrders")}</h1>
        <Button asChild className="mt-6">
          <Link to="/auth">{t("signInToSeeOrders")}</Link>
        </Button>
      </main>
    );
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-4xl">{t("myOrders")}</h1>
      {isLoading ? (
        <p className="mt-6">{t("loading")}</p>
      ) : orders.length === 0 ? (
        <p className="mt-6 text-muted-foreground">
          {t("noOrders")}{" "}
          <Link to="/cakes" search={{ q: "" }} className="text-primary">
            {t("browseCakes")}
          </Link>
        </p>
      ) : (
        <div className="mt-6 space-y-6">
          {orders.map((o) => {
            return (
              <Link
                key={o.id}
                to="/orders/$id"
                params={{ id: o.id }}
                aria-label={`View details for order ${o.id}`}
                className="block rounded-2xl bg-card p-4 shadow-soft transition hover:ring-1 hover:ring-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {t("orderNo")} #{o.id.slice(0, 8)} · {new Date(o.created_at).toLocaleString()}
                    </p>
                    <p className="mt-1 text-lg font-semibold">{formatPrice(o.total)}</p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-sm capitalize ${o.status === "cancelled" ? "bg-destructive/10 text-destructive" : "bg-secondary"}`}
                  >
                    {statusLabel(o.status)}
                  </span>
                </div>
                <ul className="mt-4 divide-y">
                  {o.order_items.map((it) => (
                    <li key={it.id} className="flex items-center gap-3 py-3">
                      {it.image_url ? (
                        <img
                          src={cakeImage(it.image_url)}
                          alt={it.cake_name}
                          className="h-14 w-14 rounded-md bg-muted object-cover"
                          onError={(event) => {
                            event.currentTarget.hidden = true;
                          }}
                        />
                      ) : (
                        <div className="h-14 w-14 rounded-md bg-muted" />
                      )}
                      <span className="flex-1">
                        {it.cake_name} · {it.pounds} lb
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {it.quantity_num ?? it.quantity} × {formatPrice(it.unit_price)}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-sm text-muted-foreground">
                  {o.fulfillment_type === "pickup" ? t("pickup") : t("delivery")}
                  {o.delivery_area ? ` · ${o.delivery_area}` : ""}
                  {o.address ? ` · ${o.address}` : ""}
                  {" · "}
                  {o.customer_name} · {o.phone}
                  {o.delivery_date ? ` · on ${o.delivery_date}` : ""}
                  {" · "}
                  {t("paymentStatus")}:{" "}
                  {o.payment_status === "paid"
                    ? t("verified")
                    : o.payment_status === "failed"
                      ? t("rejected")
                      : o.payment_status === "refunded"
                        ? t("refunded")
                        : t("pending")}
                </p>
                {(Number(o.discount) > 0 || Number(o.delivery_charge) > 0) && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("deliveryChargeLabel")} {formatPrice(o.delivery_charge)} · {t("discount")}{" "}
                    {formatPrice(o.discount)}
                  </p>
                )}
                {o.note && <p className="text-sm text-muted-foreground">Note: {o.note}</p>}
                <p className="mt-3 text-sm font-medium text-primary">{t("viewOrderDetails")}</p>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
