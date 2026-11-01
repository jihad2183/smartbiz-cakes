import { createFileRoute, Outlet, useMatchRoute } from "@tanstack/react-router";
import { CakeCatalog } from "@/components/CakeCatalog";
import { useLanguage } from "@/hooks/use-language";

export const Route = createFileRoute("/cakes")({
  validateSearch: (s: Record<string, unknown>) => ({ q: typeof s["q"] === "string" ? s["q"] : "" }),
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "All Cakes | Smart Cake Shop" },
      { name: "description", content: "Browse and search all cakes at Smart Cake Shop." },
      { property: "og:title", content: "All Cakes | Smart Cake Shop" },
      { property: "og:description", content: "Browse and search all cakes at Smart Cake Shop." },
    ],
  }),
  component: CakesPage,
});

function CakesPage() {
  const { q } = Route.useSearch();
  const { t } = useLanguage();
  const isDetail = useMatchRoute()({ to: "/cakes/$id" });
  if (isDetail) return <Outlet />;
  return (
    <main className="all-cakes-page mx-auto max-w-6xl px-4 py-10">
      <h1 className="mb-6 text-4xl">{q.trim() ? `${t("resultsFor")} “${q}”` : t("allCakes")}</h1>
      <CakeCatalog title={t("browseCakes")} initialQuery={q} gridClassName="all-cakes-grid" />
    </main>
  );
}
