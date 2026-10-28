import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ShoppingBag, Search } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { useCart } from "@/hooks/use-cart";
import { supabase } from "@/integrations/supabase/client";
import { useSiteContent } from "@/hooks/use-site-content";

export function SiteHeader() {
  const { data: content = {} } = useSiteContent();
  const { user, isAdmin } = useAuth();
  const { count } = useCart();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [q, setQ] = useState("");

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
      {content["announcement"] && (
        <p className="bg-secondary px-4 py-2 text-center text-sm">{content["announcement"]}</p>
      )}
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3 sm:gap-4">
        <Link to="/" className="shrink-0 font-display text-xl font-semibold text-cocoa sm:text-2xl">
          {content["shop_name"] || "Smart Cake"}
        </Link>
        <nav className="hidden gap-5 text-sm md:flex">
          <Link to="/cakes" search={{ q: "" }} className="hover:text-primary">
            All cakes
          </Link>
          {user && (
            <Link to="/orders" className="hover:text-primary">
              My orders
            </Link>
          )}
          {isAdmin && (
            <Link to="/admin" className="font-medium text-primary">
              Admin panel
            </Link>
          )}
        </nav>
        <form
          className="relative order-3 w-full sm:order-none sm:ml-auto sm:w-56 md:w-64"
          onSubmit={(e) => {
            e.preventDefault();
            navigate({ to: "/cakes", search: { q } });
          }}
        >
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search cakes…"
            className="pl-9"
          />
        </form>
        <Link
          to="/cart"
          className="relative shrink-0 rounded-full p-2 hover:bg-muted"
          aria-label="Cart"
        >
          <ShoppingBag className="h-5 w-5" />
          {count > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid h-5 w-5 place-items-center rounded-full bg-primary text-[10px] text-primary-foreground">
              {count}
            </span>
          )}
        </Link>
        {user ? (
          <Button variant="outline" size="sm" className="shrink-0" onClick={signOut}>
            Sign out
          </Button>
        ) : (
          <Button asChild size="sm" className="shrink-0">
            <Link to="/auth">Sign in</Link>
          </Button>
        )}
      </div>
      <nav className="flex gap-4 px-4 pb-2 text-sm md:hidden">
        <Link to="/cakes" search={{ q: "" }}>
          All cakes
        </Link>
        {user && <Link to="/orders">My orders</Link>}
        {isAdmin && (
          <Link to="/admin" className="text-primary">
            Admin
          </Link>
        )}
      </nav>
    </header>
  );
}
