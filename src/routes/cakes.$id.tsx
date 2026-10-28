import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useCart, formatPrice } from "@/hooks/use-cart";
import type { Cake } from "@/components/CakeCard";
import { cakeImage } from "@/lib/cake-images";
import { useState } from "react";
import { PoundSelect } from "@/components/PoundSelect";

export const Route = createFileRoute("/cakes/$id")({
  head: () => ({
    meta: [
      { title: "Cake details | Smart Cake Shop" },
      { name: "description", content: "Cake details and prices at Smart Cake Shop." },
      { property: "og:title", content: "Cake details | Smart Cake Shop" },
      { property: "og:description", content: "Cake details and prices at Smart Cake Shop." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CakeDetail,
});

function CakeDetail() {
  const { id } = Route.useParams();
  const { add } = useCart();
  const [lb, setLb] = useState(1);
  const {
    data: cake,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["cake", id],
    queryFn: async () => {
      const { data, error: queryError } = await supabase
        .from("cakes")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (queryError) throw queryError;
      return data as Cake | null;
    },
  });
  if (isLoading) return <main className="mx-auto max-w-5xl px-4 py-10">Loading cake…</main>;
  if (error || !cake)
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <p role="alert" className="text-muted-foreground">
          This cake could not be found.
        </p>
      </main>
    );
  return (
    <main className="mx-auto grid max-w-5xl gap-6 px-4 py-8 sm:gap-10 sm:py-10 md:grid-cols-2">
      {cake.image_url ? (
        <img
          src={cakeImage(cake.image_url)}
          alt={cake.name}
          className="aspect-[4/3] w-full rounded-2xl bg-muted object-cover shadow-soft md:aspect-auto md:min-h-96"
          onError={(event) => {
            event.currentTarget.hidden = true;
          }}
        />
      ) : (
        <div className="aspect-[4/3] rounded-2xl bg-muted md:min-h-96" aria-hidden="true" />
      )}
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">{cake.category}</p>
        <h1 className="mt-2 break-words text-3xl sm:text-4xl">{cake.name}</h1>
        <p className="mt-4 text-2xl text-primary">
          {formatPrice(cake.price * lb)}{" "}
          <span className="text-sm text-muted-foreground">({formatPrice(cake.price)} per lb)</span>
        </p>
        <label className="mt-6 flex items-center gap-3 text-sm">
          Weight <PoundSelect value={lb} onChange={setLb} />
        </label>
        <p className="mt-4 text-muted-foreground">{cake.description}</p>
        <Button
          className="mt-8"
          size="lg"
          disabled={!cake.available}
          onClick={() => {
            const added = add({
              cake_id: cake.id,
              name: cake.name,
              price: Number(cake.price),
              image_url: cake.image_url,
              pounds: lb,
            });
            if (added) toast.success("Added to cart");
            else toast.error("A cart item cannot exceed 50 cakes.");
          }}
        >
          {cake.available ? "Add to cart" : "Unavailable"}
        </Button>
      </div>
    </main>
  );
}
