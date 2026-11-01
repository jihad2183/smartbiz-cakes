import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CakeCard, type Cake } from "@/components/CakeCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getCakePageCount, getCakePageRange } from "@/lib/cake-pagination";
import { useLanguage } from "@/hooks/use-language";

const sortOptions = {
  newest: { label: "Newest", column: "created_at", ascending: false },
  oldest: { label: "Oldest", column: "created_at", ascending: true },
  price_low: { label: "Price: low to high", column: "price", ascending: true },
  price_high: { label: "Price: high to low", column: "price", ascending: false },
  name: { label: "Name: A to Z", column: "name", ascending: true },
} as const;

type SortOption = keyof typeof sortOptions;

function safeSearchTerm(value: string) {
  return value
    .trim()
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pageNumbers(page: number, pageCount: number) {
  return [...new Set([1, 2, 3, 4, page - 1, page, page + 1, pageCount])]
    .filter((number) => number > 0 && number <= pageCount)
    .sort((a, b) => a - b);
}

export function CakeCatalog({
  title,
  initialQuery = "",
  gridClassName,
}: {
  title: string;
  initialQuery?: string;
  gridClassName?: string;
}) {
  const { t } = useLanguage();
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState<SortOption>("oldest");
  const [page, setPage] = useState(1);
  const term = safeSearchTerm(query);
  const { data: categories = [] } = useQuery({
    queryKey: ["cake-categories"],
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
  const { data, isLoading, error } = useQuery({
    queryKey: ["cake-catalog", page, term, category, sort],
    queryFn: async () => {
      const option = sortOptions[sort];
      let request = supabase
        .from("cakes")
        .select("*", { count: "exact" })
        .order(option.column, { ascending: option.ascending })
        .order("id", { ascending: true });
      const range = getCakePageRange(page);
      request = request.range(range.from, range.to);
      if (category !== "all") request = request.eq("category", category);
      if (term) {
        const pattern = `%${term}%`;
        request = request.or(
          `name.ilike.${pattern},description.ilike.${pattern},tags.ilike.${pattern},category.ilike.${pattern}`,
        );
      }
      const { data: cakes, count, error: queryError } = await request;
      if (queryError) throw queryError;
      return { cakes: (cakes ?? []) as Cake[], count: count ?? 0 };
    },
  });
  const pageCount = getCakePageCount(data?.count ?? 0);
  const sortLabels: Record<SortOption, string> = {
    newest: t("newest"),
    oldest: t("oldest"),
    price_low: t("priceLowHigh"),
    price_high: t("priceHighLow"),
    name: t("nameAZ"),
  };

  useEffect(() => {
    setQuery(initialQuery);
    setPage(1);
  }, [initialQuery]);

  const updateQuery = (value: string) => {
    setQuery(value);
    setPage(1);
  };

  return (
    <section>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <h2 className="text-3xl">{title}</h2>
        <div className="cake-catalog-controls grid gap-3 sm:grid-cols-3">
          <Input
            aria-label={t("searchCakes")}
            placeholder={t("searchCakes")}
            value={query}
            onChange={(event) => updateQuery(event.target.value)}
          />
          <select
            aria-label={t("allCategories")}
            className="h-10 min-w-0 rounded-md border border-input bg-card px-3 text-sm"
            value={category}
            onChange={(event) => {
              setCategory(event.target.value);
              setPage(1);
            }}
          >
            <option value="all">{t("allCategories")}</option>
            {categories.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <select
            aria-label={t("sortCakes")}
            className="h-10 min-w-0 rounded-md border border-input bg-card px-3 text-sm"
            value={sort}
            onChange={(event) => {
              setSort(event.target.value as SortOption);
              setPage(1);
            }}
          >
            {Object.entries(sortOptions).map(([value, option]) => (
              <option key={value} value={value}>
                {sortLabels[value as SortOption]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <p className="mt-6 text-muted-foreground">{t("loadingCakes")}</p>
      ) : error ? (
        <p role="alert" className="mt-6 text-destructive">
          {t("cakesLoadError")}
        </p>
      ) : !data?.cakes.length ? (
        <p className="mt-6 text-muted-foreground">{t("noCakesMatch")}</p>
      ) : (
        <div
          className={`${gridClassName ? `${gridClassName} ` : ""}cake-catalog-grid mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`}
        >
          {data.cakes.map((cake) => (
            <CakeCard key={cake.id} cake={cake} />
          ))}
        </div>
      )}

      {pageCount > 1 && (
        <nav
          aria-label={t("page")}
          className="mt-8 flex flex-wrap items-center justify-center gap-2"
        >
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1}
            onClick={() => setPage((current) => current - 1)}
          >
            {t("previous")}
          </Button>
          {pageNumbers(page, pageCount).map((number, index, pages) => (
            <span key={number} className="flex items-center gap-2">
              {index > 0 && pages[index - 1] !== undefined && number - pages[index - 1]! > 1 && (
                <span aria-hidden="true" className="px-1 text-muted-foreground">
                  …
                </span>
              )}
              <Button
                variant={page === number ? "default" : "outline"}
                size="sm"
                aria-current={page === number ? "page" : undefined}
                aria-label={`${t("page")} ${number}`}
                onClick={() => setPage(number)}
              >
                {number}
              </Button>
            </span>
          ))}
          <Button
            variant="outline"
            size="sm"
            disabled={page === pageCount}
            onClick={() => setPage((current) => current + 1)}
          >
            {t("next")}
          </Button>
        </nav>
      )}
    </section>
  );
}
