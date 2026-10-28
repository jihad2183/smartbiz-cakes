import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { formatPrice } from "@/hooks/use-cart";
import { cakeImage } from "@/lib/cake-images";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/orders/$id")({
  head: () => ({
    meta: [{ title: "Order details | Smart Cake Shop" }, { name: "robots", content: "noindex" }],
  }),
  component: OrderDetailsPage,
});

function OrderDetailsPage() {
  const { id } = Route.useParams();
  const { user, loading } = useAuth();
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

  if (loading) return <main className="mx-auto max-w-3xl px-4 py-10">Loading account…</main>;
  if (!user) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-3xl">Order details</h1>
        <p className="mt-3 text-muted-foreground">Sign in to view your order.</p>
        <Button asChild className="mt-5">
          <Link to="/auth">Sign in</Link>
        </Button>
      </main>
    );
  }
  if (isLoading) return <main className="mx-auto max-w-3xl px-4 py-10">Loading order…</main>;
  if (error) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <p role="alert" className="text-destructive">
          We could not load this order. Please try again.
        </p>
        <Button asChild variant="outline" className="mt-5">
          <Link to="/orders">Back to My orders</Link>
        </Button>
      </main>
    );
  }
  if (!order) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-3xl">Order not found</h1>
        <p className="mt-3 text-muted-foreground">
          This order is unavailable or does not belong to your account.
        </p>
        <Button asChild variant="outline" className="mt-5">
          <Link to="/orders">Back to My orders</Link>
        </Button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:py-10">
      <Button asChild variant="outline">
        <Link to="/orders">← Back to My orders</Link>
      </Button>
      <section className="mt-5 rounded-2xl bg-card p-4 shadow-soft sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">Order #{order.id}</p>
            <h1 className="mt-1 text-3xl">Order details</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Placed {new Date(order.created_at).toLocaleString()}
            </p>
          </div>
          <span className="rounded-full bg-secondary px-3 py-1 text-sm capitalize">
            {order.status.replaceAll("_", " ")}
          </span>
        </div>

        <h2 className="mt-7 text-xl">Items</h2>
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
            <dt className="text-sm text-muted-foreground">Order total</dt>
            <dd className="font-semibold">{formatPrice(order.total)}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Payment status</dt>
            <dd>Not recorded</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Order status</dt>
            <dd className="capitalize">{order.status.replaceAll("_", " ")}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Delivery date</dt>
            <dd>{order.delivery_date || "Not specified"}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-sm text-muted-foreground">Delivery address</dt>
            <dd className="break-words">{order.address || "Not provided"}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Contact name</dt>
            <dd>{order.customer_name || "Not provided"}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Phone</dt>
            <dd>{order.phone || "Not provided"}</dd>
          </div>
          {order.note && (
            <div className="sm:col-span-2">
              <dt className="text-sm text-muted-foreground">Order note</dt>
              <dd className="break-words">{order.note}</dd>
            </div>
          )}
        </dl>
      </section>
    </main>
  );
}
