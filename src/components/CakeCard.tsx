import { Link } from "@tanstack/react-router";
import { formatPrice, useCart } from "@/hooks/use-cart";
import { Button } from "@/components/ui/button";
import { ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { cakeImage } from "@/lib/cake-images";
import { useState } from "react";
import { PoundSelect } from "@/components/PoundSelect";
import { useLanguage } from "@/hooks/use-language";

export type Cake = {
  id: string;
  name: string;
  description: string;
  price: number;
  image_url: string | null;
  category: string;
  tags: string;
  available: boolean;
};

export function CakeCard({ cake }: { cake: Cake }) {
  const { add } = useCart();
  const { t } = useLanguage();
  const [lb, setLb] = useState(1);
  return (
    <article className="mobile-cake-card group flex flex-col overflow-hidden rounded-2xl bg-card shadow-soft transition hover:-translate-y-1">
      <Link to="/cakes/$id" params={{ id: cake.id }} search={{ q: "" }}>
        <div className="mobile-cake-card-image aspect-[4/3] overflow-hidden bg-muted">
          {cake.image_url && (
            <img
              src={cakeImage(cake.image_url)}
              alt={cake.name}
              loading="lazy"
              width={1024}
              height={1024}
              className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
              onError={(event) => {
                event.currentTarget.hidden = true;
              }}
            />
          )}
        </div>
        <div className="mobile-cake-card-copy p-4">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">{cake.category}</p>
          <h3 className="mt-1 text-lg font-semibold">{cake.name}</h3>
          <div className="mt-2 flex items-center justify-between">
            <span className="font-medium text-primary">
              {formatPrice(cake.price * lb)}{" "}
              <span className="text-xs text-muted-foreground">
                {t("forPounds")} {lb} lb
              </span>
            </span>
            {!cake.available && (
              <span className="text-xs text-destructive">{t("unavailable")}</span>
            )}
          </div>
        </div>
      </Link>
      <div className="mobile-cake-card-actions mt-auto flex gap-2 px-4 pb-4">
        <PoundSelect value={lb} onChange={setLb} />
        <Button
          className="flex-1"
          disabled={!cake.available}
          aria-label={`${t("addToCart")} ${cake.name}`}
          onClick={() => {
            const added = add({
              cake_id: cake.id,
              name: cake.name,
              price: Number(cake.price),
              image_url: cake.image_url,
              pounds: lb,
            });
            if (added) toast.success(`${lb} lb ${cake.name} ${t("cakeAdded")}`);
            else toast.error("A cart item cannot exceed 50 cakes.");
          }}
        >
          <ShoppingBag className="h-4 w-4" />
          {cake.available ? t("addToCart") : t("unavailable")}
        </Button>
      </div>
    </article>
  );
}
