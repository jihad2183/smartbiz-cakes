import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Save,
  X,
  ShieldCheck,
  LayoutDashboard,
  ShoppingCart,
  Cake as CakeIcon,
  Wallet,
  Boxes,
  Users,
  Store,
  Settings,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { formatPrice } from "@/hooks/use-cart";
import { useSiteContent } from "@/hooks/use-site-content";
import { cakeImage } from "@/lib/cake-images";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin portal | Smart Cake Shop" },
      {
        name: "description",
        content:
          "Manage Smart Cake Shop sales, orders, cakes, expenses, inventory and team access.",
      },
      { property: "og:title", content: "Admin portal | Smart Cake Shop" },
      { property: "og:description", content: "Smart Cake Shop administration." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

type Section = "dashboard" | "orders" | "cakes" | "expenses" | "inventory" | "team" | "content";
const nav: [Section, string, typeof LayoutDashboard][] = [
  ["dashboard", "Dashboard", LayoutDashboard],
  ["orders", "Orders", ShoppingCart],
  ["cakes", "Cakes", CakeIcon],
  ["expenses", "Expenses", Wallet],
  ["inventory", "Inventory", Boxes],
  ["team", "Teams & Access", Users],
  ["content", "Website content", Settings],
];
const statuses = [
  "pending",
  "confirmed",
  "preparing",
  "out_for_delivery",
  "delivered",
  "cancelled",
];
const blankCake = {
  name: "",
  description: "",
  price: 0,
  image_url: "",
  category: "Classic",
  tags: "",
  available: true,
  stock: "" as string,
};
const blankExpense = {
  title: "",
  category: "Ingredients",
  amount: 0,
  spent_on: new Date().toISOString().slice(0, 10),
  note: "",
};
const blankIng = { name: "", unit: "kg", quantity: 0, reorder_level: 0 };
const contentFields = [
  ["shop_name", "Shop name"],
  ["announcement", "Announcement bar"],
  ["hero_title", "Homepage heading"],
  ["hero_subtitle", "Homepage description"],
  ["hero_image", "Homepage image URL"],
  ["featured_title", "Featured section title"],
  ["contact_email", "Contact email"],
  ["contact_phone", "Contact phone"],
  ["shop_address", "Shop address"],
  ["footer_text", "Footer text"],
] as const;
type Res = PromiseLike<{ error: { message: string } | null }>;

function useAdminQuery<T>(
  key: string,
  enabled: boolean,
  fn: () => PromiseLike<{ data: T | null; error: { message: string } | null }>,
) {
  return useQuery({
    queryKey: ["admin", key],
    enabled,
    queryFn: async () => {
      const { data, error } = await fn();
      if (error) throw new Error(error.message);
      return data as T;
    },
  });
}

function AdminPage() {
  const { user, isAdmin, loading } = useAuth();
  const qc = useQueryClient();
  const [section, setSection] = useState<Section>("dashboard");
  const [busy, setBusy] = useState(false);
  const [cakeEdit, setCakeEdit] = useState<string | null>(null);
  const [cakeForm, setCakeForm] = useState(blankCake);
  const [expEdit, setExpEdit] = useState<string | null>(null);
  const [expForm, setExpForm] = useState(blankExpense);
  const [ingEdit, setIngEdit] = useState<string | null>(null);
  const [ingForm, setIngForm] = useState(blankIng);
  const [contentDraft, setContentDraft] = useState<Record<string, string>>({});
  const [orderFilter, setOrderFilter] = useState("all");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const { data: content = {} } = useSiteContent();

  const cakes =
    useAdminQuery("cakes", isAdmin, () => supabase.from("cakes").select("*").order("created_at"))
      .data ?? [];
  const orders =
    useAdminQuery("orders", isAdmin, () =>
      supabase.from("orders").select("*,order_items(*)").order("created_at", { ascending: false }),
    ).data ?? [];
  const profiles =
    useAdminQuery("profiles", isAdmin, () =>
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
    ).data ?? [];
  const roles =
    useAdminQuery("roles", isAdmin, () => supabase.from("user_roles").select("*")).data ?? [];
  const expenses =
    useAdminQuery("expenses", isAdmin, () =>
      supabase.from("expenses").select("*").order("spent_on", { ascending: false }),
    ).data ?? [];
  const ingredients =
    useAdminQuery("ingredients", isAdmin, () =>
      supabase.from("ingredients").select("*").order("name"),
    ).data ?? [];
  const { data: requests = [] } = useQuery({
    queryKey: ["admin-requests", user?.id],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const act = async (op: () => Res, msg: string) => {
    setBusy(true);
    try {
      const { error } = await op();
      if (error) throw new Error(error.message);
      toast.success(msg);
      await qc.invalidateQueries();
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const uploadPhoto = async (file: File) => {
    setBusy(true);
    const path = `${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9.]/g, "_")}`;
    const up = await supabase.storage
      .from("cake-photos")
      .upload(path, file, { contentType: file.type });
    if (up.error) {
      setBusy(false);
      toast.error(up.error.message);
      return;
    }
    const signed = await supabase.storage
      .from("cake-photos")
      .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
    setBusy(false);
    if (signed.error) {
      toast.error(signed.error.message);
      return;
    }
    setCakeForm((f) => ({ ...f, image_url: signed.data.signedUrl }));
    toast.success("Photo uploaded");
  };

  if (loading) return <main className="mx-auto max-w-6xl px-4 py-10">Loading…</main>;
  if (!user || !isAdmin)
    return (
      <main className="mx-auto max-w-lg px-4 py-16">
        <ShieldCheck className="mb-4 h-9 w-9 text-primary" />
        <h1 className="text-3xl">Administrators only</h1>
        <p className="mt-4 text-muted-foreground">
          This area is restricted. Administrators must sign in through the admin login page.
        </p>
        <Button asChild className="mt-6">
          <Link to="/admin-login">Go to admin login</Link>
        </Button>
      </main>
    );

  const active = orders.filter((o) => o.status !== "cancelled");
  const revenue = active.reduce((s, o) => s + Number(o.total), 0);
  const spent = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const today = new Date().toDateString();
  const lowStock = ingredients.filter((i) => Number(i.quantity) <= Number(i.reorder_level));
  const adminIds = new Set(roles.filter((r) => r.role === "admin").map((r) => r.user_id));
  const pending = requests.filter((r) => r.status === "pending");
  const shownOrders =
    orderFilter === "all" ? orders : orders.filter((o) => o.status === orderFilter);
  const selectedCustomer = profiles.find((profile) => profile.id === selectedCustomerId);
  const selectedCustomerOrders = orders.filter((order) => order.user_id === selectedCustomerId);
  const selectedCustomerTotal = selectedCustomerOrders.reduce(
    (sum, order) => sum + Number(order.total),
    0,
  );

  const Stat = ({ label, value }: { label: string; value: string | number }) => (
    <div className="rounded-2xl bg-card p-5 shadow-soft">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 md:flex-row">
      <aside className="md:w-56 md:shrink-0">
        <p className="mb-3 font-display text-xl">Admin portal</p>
        <nav className="flex flex-wrap gap-1 md:flex-col">
          {nav.map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => setSection(id)}
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm ${section === id ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            >
              <Icon className="h-4 w-4" />
              {label}
              {id === "team" && pending.length > 0 && (
                <span className="ml-auto rounded-full bg-destructive px-2 text-xs text-destructive-foreground">
                  {pending.length}
                </span>
              )}
            </button>
          ))}
          <a
            href="/"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted"
          >
            <Store className="h-4 w-4" />
            View shop
          </a>
        </nav>
      </aside>
      <main className="min-w-0 flex-1">
        {section === "dashboard" && (
          <section>
            <h1 className="mb-6 text-3xl">Dashboard</h1>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Revenue" value={formatPrice(revenue)} />
              <Stat label="Expenses" value={formatPrice(spent)} />
              <Stat label="Profit" value={formatPrice(revenue - spent)} />
              <Stat label="Total orders" value={orders.length} />
              <Stat
                label="Orders today"
                value={orders.filter((o) => new Date(o.created_at).toDateString() === today).length}
              />
              <Stat
                label="Pending orders"
                value={orders.filter((o) => o.status === "pending").length}
              />
              <Stat label="Customers" value={profiles.length} />
              <Stat label="Cakes listed" value={cakes.length} />
            </div>
            {lowStock.length > 0 && (
              <p
                role="alert"
                className="mt-6 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
              >
                Low stock: {lowStock.map((i) => i.name).join(", ")}
              </p>
            )}
            <h2 className="mt-8 text-xl">Recent orders</h2>
            <div className="divide-y">
              {orders.slice(0, 5).map((o) => (
                <div key={o.id} className="flex justify-between py-3 text-sm">
                  <span>
                    {o.customer_name || "Customer"} · {new Date(o.created_at).toLocaleDateString()}
                  </span>
                  <span className="capitalize">
                    {o.status.replaceAll("_", " ")} · {formatPrice(o.total)}
                  </span>
                </div>
              ))}
              {orders.length === 0 && <p className="py-3 text-muted-foreground">No orders yet.</p>}
            </div>
          </section>
        )}

        {section === "orders" && (
          <section>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <h1 className="text-3xl">Orders</h1>
              <select
                aria-label="Filter orders"
                className="rounded-md border bg-background px-3 py-2 text-sm"
                value={orderFilter}
                onChange={(e) => setOrderFilter(e.target.value)}
              >
                <option value="all">All statuses</option>
                {statuses.map((s) => (
                  <option key={s} value={s}>
                    {s.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </div>
            {shownOrders.length === 0 && <p className="text-muted-foreground">No orders.</p>}
            <div className="divide-y">
              {shownOrders.map((o) => (
                <article key={o.id} className="py-5">
                  <div className="flex flex-wrap justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">
                        {o.customer_name || "Customer"} · {formatPrice(o.total)}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        #{o.id.slice(0, 8)} · {new Date(o.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <select
                        aria-label={`Status for order ${o.id}`}
                        className="rounded-md border bg-background px-3 py-2 text-sm"
                        value={o.status}
                        disabled={busy}
                        onChange={(e) =>
                          act(
                            () =>
                              supabase
                                .from("orders")
                                .update({ status: e.target.value })
                                .eq("id", o.id),
                            "Order updated",
                          )
                        }
                      >
                        {statuses.map((s) => (
                          <option key={s} value={s}>
                            {s.replaceAll("_", " ")}
                          </option>
                        ))}
                      </select>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Delete order"
                        onClick={() => {
                          if (window.confirm("Delete this order?"))
                            act(
                              () => supabase.from("orders").delete().eq("id", o.id),
                              "Order deleted",
                            );
                        }}
                      >
                        <Trash2 className="text-destructive" />
                      </Button>
                    </div>
                  </div>
                  <p className="mt-2 text-sm">
                    {o.phone} · {o.address} · Delivery: {o.delivery_date || "Not specified"}
                  </p>
                  {o.note && <p className="text-sm">Note: {o.note}</p>}
                  <ul className="mt-2 flex flex-wrap gap-3">
                    {o.order_items.map((it) => (
                      <li key={it.id} className="flex items-center gap-2 text-sm">
                        {it.image_url && (
                          <img
                            src={cakeImage(it.image_url)}
                            alt={it.cake_name}
                            className="h-10 w-10 rounded object-cover"
                            onError={(event) => {
                              event.currentTarget.hidden = true;
                            }}
                          />
                        )}
                        {it.quantity_num ?? it.quantity} × {it.pounds} lb {it.cake_name} (
                        {formatPrice(it.unit_price)})
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </section>
        )}

        {section === "cakes" && (
          <section>
            <div className="mb-5 flex items-center justify-between">
              <h1 className="text-3xl">Cakes</h1>
              <Button
                onClick={() => {
                  setCakeEdit("new");
                  setCakeForm(blankCake);
                }}
              >
                <Plus />
                Add cake
              </Button>
            </div>
            {cakeEdit && (
              <form
                className="mb-8 grid gap-4 border-y py-6 sm:grid-cols-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const payload = {
                    ...(({ stock: _s, ...r }) => r)(cakeForm),
                    image_url: cakeForm.image_url || null,
                    stock_num: cakeForm.stock === "" ? null : Number(cakeForm.stock),
                  };
                  if (
                    await act(
                      () =>
                        cakeEdit === "new"
                          ? supabase.from("cakes").insert(payload)
                          : supabase.from("cakes").update(payload).eq("id", cakeEdit),
                      "Cake saved",
                    )
                  )
                    setCakeEdit(null);
                }}
              >
                <h3 className="text-xl sm:col-span-2">
                  {cakeEdit === "new" ? "New cake" : "Edit cake"}
                </h3>
                <div>
                  <Label htmlFor="cake-name">Name</Label>
                  <Input
                    id="cake-name"
                    required
                    value={cakeForm.name}
                    onChange={(e) => setCakeForm({ ...cakeForm, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="cake-price">Price (৳)</Label>
                  <Input
                    id="cake-price"
                    type="number"
                    min="0"
                    required
                    value={cakeForm.price}
                    onChange={(e) => setCakeForm({ ...cakeForm, price: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label htmlFor="cake-category">Category</Label>
                  <Input
                    id="cake-category"
                    required
                    value={cakeForm.category}
                    onChange={(e) => setCakeForm({ ...cakeForm, category: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="cake-stock">Stock (leave empty for unlimited)</Label>
                  <Input
                    id="cake-stock"
                    type="number"
                    min="0"
                    step="0.5"
                    value={cakeForm.stock}
                    onChange={(e) => setCakeForm({ ...cakeForm, stock: e.target.value })}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="cake-tags">Search keywords</Label>
                  <Input
                    id="cake-tags"
                    value={cakeForm.tags}
                    onChange={(e) => setCakeForm({ ...cakeForm, tags: e.target.value })}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="cake-photo">Photo</Label>
                  <div className="flex items-center gap-3">
                    {cakeForm.image_url && (
                      <img
                        src={cakeImage(cakeForm.image_url)}
                        alt=""
                        className="h-16 w-16 rounded object-cover"
                      />
                    )}
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted">
                      <Upload className="h-4 w-4" />
                      Upload photo
                      <input
                        id="cake-photo"
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) uploadPhoto(f);
                        }}
                      />
                    </label>
                    <Input
                      aria-label="Image URL"
                      placeholder="…or paste an image URL"
                      value={cakeForm.image_url}
                      onChange={(e) => setCakeForm({ ...cakeForm, image_url: e.target.value })}
                    />
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="cake-description">Description</Label>
                  <Textarea
                    id="cake-description"
                    value={cakeForm.description}
                    onChange={(e) => setCakeForm({ ...cakeForm, description: e.target.value })}
                  />
                </div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={cakeForm.available}
                    onChange={(e) => setCakeForm({ ...cakeForm, available: e.target.checked })}
                  />
                  Available for ordering
                </label>
                <div className="flex gap-2 sm:col-span-2">
                  <Button type="submit" disabled={busy}>
                    <Save />
                    Save cake
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setCakeEdit(null)}>
                    <X />
                    Cancel
                  </Button>
                </div>
              </form>
            )}
            <div className="divide-y">
              {cakes.map((c) => (
                <div key={c.id} className="flex items-center gap-3 py-4">
                  {c.image_url ? (
                    <img
                      src={cakeImage(c.image_url)}
                      alt={c.name}
                      className="h-16 w-16 rounded-md object-cover"
                    />
                  ) : (
                    <div className="h-16 w-16 rounded-md bg-muted" />
                  )}
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold">{c.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {formatPrice(c.price)} / lb · {c.available ? "Available" : "Unavailable"} ·
                      Stock: {c.stock_num ?? "unlimited"}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label={`Edit ${c.name}`}
                    onClick={() => {
                      setCakeEdit(c.id);
                      setCakeForm({
                        name: c.name,
                        description: c.description,
                        price: c.price,
                        image_url: c.image_url ?? "",
                        category: c.category,
                        tags: c.tags,
                        available: c.available,
                        stock: c.stock_num == null ? "" : String(c.stock_num),
                      });
                    }}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete ${c.name}`}
                    disabled={busy}
                    onClick={() => {
                      if (window.confirm(`Delete ${c.name}?`))
                        act(() => supabase.from("cakes").delete().eq("id", c.id), "Cake deleted");
                    }}
                  >
                    <Trash2 className="text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </section>
        )}

        {section === "expenses" && (
          <section>
            <div className="mb-5 flex items-center justify-between">
              <h1 className="text-3xl">
                Expenses{" "}
                <span className="text-lg text-muted-foreground">({formatPrice(spent)})</span>
              </h1>
              <Button
                onClick={() => {
                  setExpEdit("new");
                  setExpForm(blankExpense);
                }}
              >
                <Plus />
                Add expense
              </Button>
            </div>
            {expEdit && (
              <form
                className="mb-8 grid gap-4 border-y py-6 sm:grid-cols-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (
                    await act(
                      () =>
                        expEdit === "new"
                          ? supabase.from("expenses").insert(expForm)
                          : supabase.from("expenses").update(expForm).eq("id", expEdit),
                      "Expense saved",
                    )
                  )
                    setExpEdit(null);
                }}
              >
                <div>
                  <Label htmlFor="exp-title">Title</Label>
                  <Input
                    id="exp-title"
                    required
                    value={expForm.title}
                    onChange={(e) => setExpForm({ ...expForm, title: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="exp-amount">Amount (৳)</Label>
                  <Input
                    id="exp-amount"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={expForm.amount}
                    onChange={(e) => setExpForm({ ...expForm, amount: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label htmlFor="exp-cat">Category</Label>
                  <Input
                    id="exp-cat"
                    value={expForm.category}
                    onChange={(e) => setExpForm({ ...expForm, category: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="exp-date">Date</Label>
                  <Input
                    id="exp-date"
                    type="date"
                    required
                    value={expForm.spent_on}
                    onChange={(e) => setExpForm({ ...expForm, spent_on: e.target.value })}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="exp-note">Note</Label>
                  <Input
                    id="exp-note"
                    value={expForm.note}
                    onChange={(e) => setExpForm({ ...expForm, note: e.target.value })}
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={busy}>
                    <Save />
                    Save
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setExpEdit(null)}>
                    Cancel
                  </Button>
                </div>
              </form>
            )}
            {expenses.length === 0 && (
              <p className="text-muted-foreground">No expenses recorded.</p>
            )}
            <div className="divide-y">
              {expenses.map((x) => (
                <div key={x.id} className="flex items-center gap-3 py-3">
                  <div className="flex-1">
                    <p className="font-medium">{x.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {x.category} · {x.spent_on}
                      {x.note ? ` · ${x.note}` : ""}
                    </p>
                  </div>
                  <span>{formatPrice(x.amount)}</span>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label={`Edit ${x.title}`}
                    onClick={() => {
                      setExpEdit(x.id);
                      setExpForm({
                        title: x.title,
                        category: x.category,
                        amount: x.amount,
                        spent_on: x.spent_on,
                        note: x.note,
                      });
                    }}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete ${x.title}`}
                    onClick={() => {
                      if (window.confirm("Delete expense?"))
                        act(
                          () => supabase.from("expenses").delete().eq("id", x.id),
                          "Expense deleted",
                        );
                    }}
                  >
                    <Trash2 className="text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </section>
        )}

        {section === "inventory" && (
          <section>
            <div className="mb-5 flex items-center justify-between">
              <h1 className="text-3xl">Inventory</h1>
              <Button
                onClick={() => {
                  setIngEdit("new");
                  setIngForm(blankIng);
                }}
              >
                <Plus />
                Add ingredient
              </Button>
            </div>
            {ingEdit && (
              <form
                className="mb-8 grid gap-4 border-y py-6 sm:grid-cols-4"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (
                    await act(
                      () =>
                        ingEdit === "new"
                          ? supabase.from("ingredients").insert(ingForm)
                          : supabase.from("ingredients").update(ingForm).eq("id", ingEdit),
                      "Ingredient saved",
                    )
                  )
                    setIngEdit(null);
                }}
              >
                <div>
                  <Label htmlFor="ing-name">Ingredient</Label>
                  <Input
                    id="ing-name"
                    required
                    value={ingForm.name}
                    onChange={(e) => setIngForm({ ...ingForm, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="ing-qty">Quantity</Label>
                  <Input
                    id="ing-qty"
                    type="number"
                    step="0.01"
                    min="0"
                    value={ingForm.quantity}
                    onChange={(e) => setIngForm({ ...ingForm, quantity: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label htmlFor="ing-unit">Unit</Label>
                  <Input
                    id="ing-unit"
                    value={ingForm.unit}
                    onChange={(e) => setIngForm({ ...ingForm, unit: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="ing-reorder">Reorder at</Label>
                  <Input
                    id="ing-reorder"
                    type="number"
                    step="0.01"
                    min="0"
                    value={ingForm.reorder_level}
                    onChange={(e) =>
                      setIngForm({ ...ingForm, reorder_level: Number(e.target.value) })
                    }
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={busy}>
                    <Save />
                    Save
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setIngEdit(null)}>
                    Cancel
                  </Button>
                </div>
              </form>
            )}
            <h2 className="text-xl">Ingredients</h2>
            {ingredients.length === 0 && (
              <p className="py-3 text-muted-foreground">No ingredients yet.</p>
            )}
            <div className="divide-y">
              {ingredients.map((i) => {
                const low = Number(i.quantity) <= Number(i.reorder_level);
                return (
                  <div key={i.id} className="flex items-center gap-3 py-3">
                    <div className="flex-1">
                      <p className="font-medium">{i.name}</p>
                      <p
                        className={`text-sm ${low ? "text-destructive" : "text-muted-foreground"}`}
                      >
                        {i.quantity} {i.unit}
                        {low ? " · Low stock" : ""}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        act(
                          () =>
                            supabase
                              .from("ingredients")
                              .update({ quantity: Number(i.quantity) + 1 })
                              .eq("id", i.id),
                          "Stock updated",
                        )
                      }
                    >
                      +1
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        act(
                          () =>
                            supabase
                              .from("ingredients")
                              .update({ quantity: Math.max(0, Number(i.quantity) - 1) })
                              .eq("id", i.id),
                          "Stock updated",
                        )
                      }
                    >
                      −1
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label={`Edit ${i.name}`}
                      onClick={() => {
                        setIngEdit(i.id);
                        setIngForm({
                          name: i.name,
                          unit: i.unit,
                          quantity: i.quantity,
                          reorder_level: i.reorder_level,
                        });
                      }}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete ${i.name}`}
                      onClick={() => {
                        if (window.confirm("Delete ingredient?"))
                          act(
                            () => supabase.from("ingredients").delete().eq("id", i.id),
                            "Ingredient deleted",
                          );
                      }}
                    >
                      <Trash2 className="text-destructive" />
                    </Button>
                  </div>
                );
              })}
            </div>
            <h2 className="mt-8 text-xl">Cake availability</h2>
            <div className="divide-y">
              {cakes.map((c) => (
                <div key={c.id} className="flex items-center gap-3 py-3">
                  <span className="flex-1">{c.name}</span>
                  <Input
                    aria-label={`Stock for ${c.name}`}
                    type="number"
                    min="0"
                    step="0.5"
                    className="w-28"
                    placeholder="Unlimited"
                    defaultValue={c.stock_num ?? ""}
                    onBlur={(e) => {
                      const v = e.target.value === "" ? null : Number(e.target.value);
                      if (v !== c.stock_num)
                        act(
                          () =>
                            supabase
                              .from("cakes")
                              .update({ stock_num: v, available: v === null ? c.available : v > 0 })
                              .eq("id", c.id),
                          "Stock updated",
                        );
                    }}
                  />
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={c.available}
                      onChange={(e) =>
                        act(
                          () =>
                            supabase
                              .from("cakes")
                              .update({ available: e.target.checked })
                              .eq("id", c.id),
                          "Availability updated",
                        )
                      }
                    />
                    Available
                  </label>
                </div>
              ))}
            </div>
          </section>
        )}

        {section === "team" && (
          <section>
            <h1 className="mb-5 text-3xl">Teams & Access</h1>
            <h2 className="text-xl">Pending admin requests</h2>
            {pending.length === 0 && (
              <p className="py-3 text-muted-foreground">No pending requests.</p>
            )}
            {pending.map((r) => (
              <div
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-3 border-b py-4"
              >
                <div>
                  <p>{r.email}</p>
                  <p className="text-sm text-muted-foreground">{r.message}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    disabled={busy}
                    onClick={() =>
                      act(
                        () =>
                          supabase.rpc("decide_admin_request", {
                            _request_id: r.id,
                            _approve: true,
                          }),
                        "Administrator approved",
                      )
                    }
                  >
                    Approve
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      act(
                        () =>
                          supabase.rpc("decide_admin_request", {
                            _request_id: r.id,
                            _approve: false,
                          }),
                        "Request rejected",
                      )
                    }
                  >
                    Reject
                  </Button>
                </div>
              </div>
            ))}
            <h2 className="mt-8 text-xl">All accounts</h2>
            <div className="divide-y">
              {profiles.map((p) => {
                const admin = adminIds.has(p.id);
                const roleRow = roles.find((r) => r.user_id === p.id && r.role === "admin");
                return (
                  <div key={p.id} className="flex flex-wrap items-center gap-3 py-4">
                    <div className="min-w-0 flex-1">
                      <Button
                        variant="link"
                        className="h-auto whitespace-normal p-0 text-left font-medium"
                        onClick={() => setSelectedCustomerId(p.id)}
                      >
                        {p.full_name || "Customer"}
                        {p.id === user.id ? " (you)" : ""}
                      </Button>
                      <p className="break-all text-sm text-muted-foreground">
                        {p.email || "Email not provided"} {p.phone ? `· ${p.phone}` : ""}{" "}
                        {p.address ? `· ${p.address}` : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {orders.filter((o) => o.user_id === p.id).length} orders
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs ${admin ? "bg-primary text-primary-foreground" : "bg-secondary"}`}
                    >
                      {admin ? "Administrator" : "Customer"}
                    </span>
                    {p.id !== user.id &&
                      (admin ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={busy}
                          onClick={() => {
                            if (roleRow && window.confirm("Revoke administrator access?"))
                              act(
                                () => supabase.from("user_roles").delete().eq("id", roleRow.id),
                                "Administrator access revoked",
                              );
                          }}
                        >
                          Revoke admin
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          disabled={busy}
                          onClick={() => {
                            if (window.confirm(`Make ${p.email} an administrator?`))
                              act(
                                () =>
                                  supabase
                                    .from("user_roles")
                                    .insert({ user_id: p.id, role: "admin" }),
                                "Administrator added",
                              );
                          }}
                        >
                          Make admin
                        </Button>
                      ))}
                  </div>
                );
              })}
            </div>
            <Dialog
              open={selectedCustomerId !== null}
              onOpenChange={(open) => {
                if (!open) setSelectedCustomerId(null);
              }}
            >
              <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
                {selectedCustomer && (
                  <>
                    <DialogHeader>
                      <DialogTitle>{selectedCustomer.full_name || "Customer details"}</DialogTitle>
                      <DialogDescription>
                        Account information and order history. Private details are only available to
                        administrators.
                      </DialogDescription>
                    </DialogHeader>
                    <dl className="grid gap-3 rounded-lg bg-muted/50 p-4 sm:grid-cols-2">
                      <div>
                        <dt className="text-sm text-muted-foreground">Email</dt>
                        <dd className="break-all">{selectedCustomer.email || "Not provided"}</dd>
                      </div>
                      <div>
                        <dt className="text-sm text-muted-foreground">Phone</dt>
                        <dd>{selectedCustomer.phone || "Not provided"}</dd>
                      </div>
                      <div className="sm:col-span-2">
                        <dt className="text-sm text-muted-foreground">Address</dt>
                        <dd className="break-words">
                          {selectedCustomer.address || "Not provided"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm text-muted-foreground">Total orders</dt>
                        <dd>{selectedCustomerOrders.length}</dd>
                      </div>
                      <div>
                        <dt className="text-sm text-muted-foreground">Total order value</dt>
                        <dd>{formatPrice(selectedCustomerTotal)}</dd>
                      </div>
                    </dl>
                    <h2 className="text-lg font-semibold">Order history</h2>
                    {selectedCustomerOrders.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No orders found.</p>
                    ) : (
                      <ul className="divide-y">
                        {selectedCustomerOrders.map((order) => (
                          <li key={order.id} className="py-3">
                            <div className="flex flex-wrap justify-between gap-2">
                              <p className="break-all text-sm font-medium">
                                #{order.id.slice(0, 8)} ·{" "}
                                {new Date(order.created_at).toLocaleDateString()}
                              </p>
                              <p className="text-sm capitalize">
                                {order.status.replaceAll("_", " ")} · {formatPrice(order.total)}
                              </p>
                            </div>
                            <ul className="mt-2 space-y-1">
                              {order.order_items.map((item) => (
                                <li
                                  key={item.id}
                                  className="flex items-center gap-2 text-sm text-muted-foreground"
                                >
                                  {item.image_url && (
                                    <img
                                      src={cakeImage(item.image_url)}
                                      alt=""
                                      className="h-8 w-8 rounded object-cover"
                                    />
                                  )}
                                  <span className="break-words">
                                    {item.cake_name} · {item.pounds} lb ·{" "}
                                    {item.quantity_num ?? item.quantity} ×{" "}
                                    {formatPrice(item.unit_price)}
                                  </span>
                                </li>
                              ))}
                            </ul>
                            <p className="mt-2 break-words text-xs text-muted-foreground">
                              {order.address || "No delivery address recorded"}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </DialogContent>
            </Dialog>
          </section>
        )}

        {section === "content" && (
          <section>
            <h1 className="mb-6 text-3xl">Website content</h1>
            <form
              className="grid gap-5 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                const values = { ...content, ...contentDraft };
                act(
                  () =>
                    supabase.from("site_content").upsert(
                      Object.entries(values).map(([key, value]) => ({
                        key,
                        value,
                        updated_at: new Date().toISOString(),
                      })),
                    ),
                  "Website settings saved",
                );
              }}
            >
              {contentFields.map(([key, label]) => (
                <div key={key}>
                  <Label htmlFor={key}>{label}</Label>
                  <Input
                    id={key}
                    value={contentDraft[key] ?? content[key] ?? ""}
                    onChange={(e) => setContentDraft({ ...contentDraft, [key]: e.target.value })}
                  />
                </div>
              ))}
              {Object.keys(content)
                .filter(
                  (key) => !contentFields.some(([k]) => k === key) && key !== "ordering_enabled",
                )
                .map((key) => (
                  <div key={key}>
                    <Label htmlFor={key}>{key.replaceAll("_", " ")}</Label>
                    <Input
                      id={key}
                      value={contentDraft[key] ?? content[key]}
                      onChange={(e) => setContentDraft({ ...contentDraft, [key]: e.target.value })}
                    />
                  </div>
                ))}
              <Button type="submit" disabled={busy} className="w-fit sm:col-span-2">
                <Save />
                Save website settings
              </Button>
            </form>
          </section>
        )}
      </main>
    </div>
  );
}
