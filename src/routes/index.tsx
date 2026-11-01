import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CakeSlice } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { CakeCatalog } from "@/components/CakeCatalog";
import { CakeCard, type Cake } from "@/components/CakeCard";
import hero from "@/assets/hero-cake.jpg";
import { useSiteContent } from "@/hooks/use-site-content";
import { useLanguage } from "@/hooks/use-language";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Smart Cake Shop | Fresh cakes delivered" },
      {
        name: "description",
        content: "Order handmade celebration cakes online from Smart Cake Shop.",
      },
      { property: "og:title", content: "Smart Cake Shop" },
      { property: "og:description", content: "Order handmade celebration cakes online." },
    ],
  }),
  component: Index,
});

function Index() {
  const { data: content = {} } = useSiteContent();
  const { t } = useLanguage();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 639px)");
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const { data: categories = [], error: categoriesError } = useQuery({
    queryKey: ["cake-categories"],
    enabled: isMobile,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cakes")
        .select("category")
        .order("category")
        .limit(1000);
      if (error) throw error;
      return [...new Set((data ?? []).map((cake) => cake.category).filter(Boolean))];
    },
  });
  const {
    data: newArrivals = [],
    isLoading: arrivalsLoading,
    error: arrivalsError,
  } = useQuery({
    queryKey: ["home-new-arrivals"],
    enabled: isMobile,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cakes")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(4);
      if (error) throw error;
      return (data ?? []) as Cake[];
    },
  });

  return (
    <main>
      <section className="relative">
        <img
          src={content["hero_image"] || hero}
          alt="Smart Cake Shop celebration cake"
          width={1600}
          height={1008}
          className="home-hero-image h-[50vh] min-h-80 max-h-[42rem] w-full object-cover sm:h-[65vh]"
        />
        <div className="home-hero-copy absolute inset-0 mx-auto flex max-w-6xl flex-col justify-center px-4">
          <h1 className="max-w-lg text-4xl text-cocoa sm:text-5xl md:text-6xl">
            {content["hero_title"] || t("homeTitle")}
          </h1>
          <p className="mt-4 max-w-md text-muted-foreground">
            {content["hero_subtitle"] || t("homeSubtitle")}
          </p>
          <Button asChild size="lg" className="mt-6 w-fit">
            <Link to="/cakes" search={{ q: "" }}>
              {t("browseCakes")}
            </Link>
          </Button>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
        <CakeCatalog title={content["featured_title"] || t("featured")} />
      </section>
      <section className="mobile-home-discovery mx-auto max-w-6xl px-4 pb-6">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Explore
            </p>
            <h2 className="mt-1 text-2xl">Shop by category</h2>
          </div>
          <Link to="/cakes" search={{ q: "" }} className="text-sm font-medium text-primary">
            {t("allCakes")}
          </Link>
        </div>
        {categoriesError ? (
          <p role="alert" className="text-sm text-destructive">
            Cake categories could not be loaded.
          </p>
        ) : (
          <div className="mobile-category-list">
            {categories.map((category) => (
              <Link
                key={category}
                to="/cakes"
                search={{ q: category }}
                className="mobile-category-card"
              >
                <span className="mobile-category-icon">
                  <CakeSlice aria-hidden="true" />
                </span>
                <span>{category}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
      <section className="mobile-home-discovery mx-auto max-w-6xl px-4 pb-10">
        <div className="mb-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Fresh from the bakery
          </p>
          <h2 className="mt-1 text-2xl">New arrivals</h2>
        </div>
        {arrivalsLoading ? (
          <p className="text-sm text-muted-foreground">{t("loadingCakes")}</p>
        ) : arrivalsError ? (
          <p role="alert" className="text-sm text-destructive">
            New cakes could not be loaded.
          </p>
        ) : newArrivals.length > 0 ? (
          <div className="cake-catalog-grid grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {newArrivals.map((cake) => (
              <CakeCard key={cake.id} cake={cake} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t("noCakesMatch")}</p>
        )}
      </section>
    </main>
  );
}
