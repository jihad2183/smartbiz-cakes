import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { CakeCatalog } from "@/components/CakeCatalog";
import hero from "@/assets/hero-cake.jpg";
import { useSiteContent } from "@/hooks/use-site-content";

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
  return (
    <main>
      <section className="relative">
        <img
          src={content["hero_image"] || hero}
          alt="Smart Cake Shop celebration cake"
          width={1600}
          height={1008}
          className="h-[50vh] min-h-80 max-h-[42rem] w-full object-cover sm:h-[65vh]"
        />
        <div className="absolute inset-0 mx-auto flex max-w-6xl flex-col justify-center px-4">
          <h1 className="max-w-lg text-4xl text-cocoa sm:text-5xl md:text-6xl">
            {content["hero_title"] || "Cakes baked for the moments that matter"}
          </h1>
          <p className="mt-4 max-w-md text-muted-foreground">
            {content["hero_subtitle"] || "Hand-finished cakes, made fresh every morning."}
          </p>
          <Button asChild size="lg" className="mt-6 w-fit">
            <Link to="/cakes" search={{ q: "" }}>
              Browse cakes
            </Link>
          </Button>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
        <CakeCatalog title={content["featured_title"] || "Favourites"} />
      </section>
    </main>
  );
}
