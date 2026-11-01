import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
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
  ShoppingBag,
  BadgePercent,
  CreditCard,
  Truck,
  CircleHelp,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/use-auth";
import { formatPrice } from "@/hooks/use-cart";
import { useSiteContent } from "@/hooks/use-site-content";
import { cakeImage } from "@/lib/cake-images";
import { generateUuid } from "@/lib/uuid";
import { isConfirmedOrder } from "@/lib/financial-report";
import { FinancialDashboard } from "@/components/admin/FinancialDashboard";
import { OrderPaymentEntry } from "@/components/admin/OrderPaymentEntry";
import { DeliveryLocationMap } from "@/components/DeliveryLocationMap";
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
  validateSearch: (search: Record<string, unknown>): { section?: Section } => {
    const section = search["section"];
    return nav.some(([id]) => id === section) ? { section: section as Section } : {};
  },
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

type Section =
  | "dashboard"
  | "orders"
  | "carts"
  | "vouchers"
  | "payments"
  | "delivery"
  | "support"
  | "cakes"
  | "expenses"
  | "inventory"
  | "customers"
  | "team"
  | "content";
const nav: [Section, string, typeof LayoutDashboard][] = [
  ["dashboard", "Dashboard", LayoutDashboard],
  ["orders", "Orders", ShoppingCart],
  ["carts", "Customer carts", ShoppingBag],
  ["vouchers", "Vouchers", BadgePercent],
  ["payments", "Payments", CreditCard],
  ["delivery", "Delivery management", Truck],
  ["support", "Support requests", CircleHelp],
  ["cakes", "Cakes", CakeIcon],
  ["customers", "Customers", Users],
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
const blankIng = { name: "", unit: "lb", quantity: 0, reorder_level: 0 };
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
  ["home_delivery_enabled", "Home delivery available"],
  ["self_pickup_enabled", "Self pick-up available"],
  ["delivery_charge", "Home delivery charge (৳)"],
  ["footer_text", "Footer text"],
] as const;
type Res = PromiseLike<{ error: { message: string } | null }>;
type VoucherForm = {
  code: string;
  discount_type: "percent";
  discount_value: number;
  min_order: number;
  max_discount: string;
  expires_at: string;
  active: boolean;
  eligible_to_all: boolean;
  eligible_user_ids: string[];
  is_welcome: boolean;
};
const blankVoucher: VoucherForm = {
  code: "",
  discount_type: "percent",
  discount_value: 10,
  min_order: 0,
  max_discount: "",
  expires_at: "",
  active: true,
  eligible_to_all: true,
  eligible_user_ids: [],
  is_welcome: false,
};
type WelcomeSettingsForm = {
  active: boolean;
  discount_type: "percent";
  discount_value: number;
  min_order: number;
  max_discount: string;
  validity_days: number;
};
const defaultWelcomeSettings: WelcomeSettingsForm = {
  active: true,
  discount_type: "percent" as const,
  discount_value: 10,
  min_order: 0,
  max_discount: "",
  validity_days: 30,
};

function useAdminQuery<T>(
  key: string,
  enabled: boolean,
  fn: () => PromiseLike<{ data: T | null; error: { message: string } | null }>,
  options: { refetchInterval?: number } = {},
) {
  return useQuery({
    queryKey: ["admin", key],
    enabled,
    queryFn: async () => {
      const { data, error } = await fn();
      if (error) throw new Error(error.message);
      return data as T;
    },
    ...options,
  });
}

function AdminPage() {
  const { user, isAdmin, loading, roleError } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const section = Route.useSearch().section ?? "dashboard";
  const goToSection = (nextSection: Section) =>
    navigate({ to: "/admin", search: { section: nextSection } });
  const [busy, setBusy] = useState(false);
  const [cakeEdit, setCakeEdit] = useState<string | null>(null);
  const [cakeForm, setCakeForm] = useState(blankCake);
  const [expEdit, setExpEdit] = useState<string | null>(null);
  const [expForm, setExpForm] = useState(blankExpense);
  const [ingEdit, setIngEdit] = useState<string | null>(null);
  const [ingForm, setIngForm] = useState(blankIng);
  const [contentDraft, setContentDraft] = useState<Record<string, string>>({});
  const [orderFilter, setOrderFilter] = useState("all");
  const [orderDateRange, setOrderDateRange] = useState<{ start: string; end: string } | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [cakeSearch, setCakeSearch] = useState("");
  const [voucherEdit, setVoucherEdit] = useState<string | null>(null);
  const [voucherForm, setVoucherForm] = useState<VoucherForm>(blankVoucher);
  const [welcomeForm, setWelcomeForm] = useState<WelcomeSettingsForm>(defaultWelcomeSettings);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedCakeId, setSelectedCakeId] = useState<string | null>(null);
  const { data: content = {} } = useSiteContent();

  const cakes =
    useAdminQuery("cakes", isAdmin, () => supabase.from("cakes").select("*").order("created_at"), {
      refetchInterval: 30_000,
    }).data ?? [];
  const orders =
    useAdminQuery(
      "orders",
      isAdmin,
      () =>
        supabase
          .from("orders")
          .select("*,order_items(*)")
          .order("created_at", { ascending: false }),
      { refetchInterval: 30_000 },
    ).data ?? [];
  const profiles =
    useAdminQuery(
      "profiles",
      isAdmin,
      () => supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      { refetchInterval: 30_000 },
    ).data ?? [];
  const roles =
    useAdminQuery("roles", isAdmin, () => supabase.from("user_roles").select("*"), {
      refetchInterval: 30_000,
    }).data ?? [];
  const expenses =
    useAdminQuery("expenses", isAdmin, () =>
      supabase.from("expenses").select("*").order("spent_on", { ascending: false }),
    ).data ?? [];
  const paymentEntries =
    useAdminQuery("order-payments", isAdmin, () =>
      supabase.from("order_payment_entries").select("*").order("created_at", { ascending: false }),
    ).data ?? [];
  const ingredients =
    useAdminQuery("ingredients", isAdmin, () =>
      supabase.from("ingredients").select("*").order("name"),
    ).data ?? [];
  const cartItems =
    useAdminQuery(
      "cart-items",
      isAdmin,
      () => supabase.from("cart_items").select("*").order("updated_at", { ascending: false }),
      { refetchInterval: 30_000 },
    ).data ?? [];
  const vouchers =
    useAdminQuery(
      "vouchers",
      isAdmin,
      () => supabase.from("vouchers").select("*").order("created_at", { ascending: false }),
      { refetchInterval: 30_000 },
    ).data ?? [];
  const paymentMethods =
    useAdminQuery(
      "payment-methods",
      isAdmin,
      () => supabase.from("payment_methods").select("*").order("id"),
      { refetchInterval: 30_000 },
    ).data ?? [];
  const supportRequests =
    useAdminQuery(
      "support-requests",
      isAdmin,
      () => supabase.from("support_requests").select("*").order("created_at", { ascending: false }),
      { refetchInterval: 30_000 },
    ).data ?? [];
  const voucherEligibility =
    useAdminQuery(
      "voucher-eligibility",
      isAdmin,
      () => supabase.from("voucher_eligibility").select("*"),
      { refetchInterval: 30_000 },
    ).data ?? [];
  const welcomeSettings = useAdminQuery<Tables<"welcome_voucher_settings">>(
    "welcome-voucher-settings",
    isAdmin,
    () => supabase.from("welcome_voucher_settings").select("*").eq("id", 1).maybeSingle(),
    { refetchInterval: 30_000 },
  ).data;
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

  useEffect(() => {
    if (!isAdmin) return;
    const channel = supabase
      .channel("admin-dashboard-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        void qc.invalidateQueries({ queryKey: ["admin", "orders"] });
      })
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "order_payment_entries" },
        () => {
          void qc.invalidateQueries({ queryKey: ["admin", "order-payments"] });
          void qc.invalidateQueries({ queryKey: ["admin", "orders"] });
        },
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "expenses" }, () => {
        void qc.invalidateQueries({ queryKey: ["admin", "expenses"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, () => {
        void qc.invalidateQueries({ queryKey: ["admin", "orders"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => {
        void qc.invalidateQueries({ queryKey: ["admin", "profiles"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "cakes" }, () => {
        void qc.invalidateQueries({ queryKey: ["admin", "cakes"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "user_roles" }, () => {
        void qc.invalidateQueries({ queryKey: ["admin", "roles"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "cart_items" }, () => {
        void qc.invalidateQueries({ queryKey: ["admin", "cart-items"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "vouchers" }, () => {
        void qc.invalidateQueries({ queryKey: ["admin", "vouchers"] });
        void qc.invalidateQueries({ queryKey: ["admin", "voucher-eligibility"] });
      })
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "voucher_eligibility" },
        () => {
          void qc.invalidateQueries({ queryKey: ["admin", "voucher-eligibility"] });
        },
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "payment_methods" }, () => {
        void qc.invalidateQueries({ queryKey: ["admin", "payment-methods"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "support_requests" }, () => {
        void qc.invalidateQueries({ queryKey: ["admin", "support-requests"] });
      })
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          toast.error("Live admin updates are unavailable. Refresh to see the latest data.");
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [isAdmin, qc]);

  useEffect(() => {
    if (!welcomeSettings) return;
    setWelcomeForm({
      active: welcomeSettings.active,
      discount_type: "percent",
      discount_value: welcomeSettings.discount_value,
      min_order: welcomeSettings.min_order,
      max_discount:
        welcomeSettings.max_discount == null ? "" : String(welcomeSettings.max_discount),
      validity_days: welcomeSettings.validity_days,
    });
  }, [welcomeSettings]);

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

  const updateOrderStatus = async (orderId: string, nextStatus: string, successMessage: string) => {
    let cancellationNote: string | null = null;
    if (nextStatus === "cancelled") {
      const enteredNote = window.prompt("Optional cancellation reason:");
      if (enteredNote === null) return;
      cancellationNote = enteredNote.trim() || null;
    }
    await act(
      () =>
        supabase
          .from("orders")
          .update({
            status: nextStatus,
            ...(nextStatus === "cancelled" ? { cancellation_note: cancellationNote } : {}),
          })
          .eq("id", orderId),
      successMessage,
    );
  };

  const saveVoucher = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!voucherForm.eligible_to_all && voucherForm.eligible_user_ids.length === 0) {
      toast.error(
        "Choose at least one eligible customer or make this voucher available to everyone.",
      );
      return;
    }
    setBusy(true);
    try {
      const payload = {
        code: voucherForm.code.trim().toUpperCase(),
        discount_type: voucherForm.discount_type,
        discount_value: Number(voucherForm.discount_value),
        min_order: Number(voucherForm.min_order),
        max_discount: voucherForm.max_discount === "" ? null : Number(voucherForm.max_discount),
        expires_at: voucherForm.expires_at ? new Date(voucherForm.expires_at).toISOString() : null,
        active: voucherForm.active,
        eligible_to_all: voucherForm.eligible_to_all,
        is_welcome: voucherForm.is_welcome,
      };
      const result =
        voucherEdit === "new"
          ? await supabase.from("vouchers").insert(payload).select("id").single()
          : await supabase
              .from("vouchers")
              .update(payload)
              .eq("id", voucherEdit!)
              .select("id")
              .single();
      if (result.error) throw new Error(result.error.message);
      const voucherId = result.data.id;
      const { error: deleteError } = await supabase
        .from("voucher_eligibility")
        .delete()
        .eq("voucher_id", voucherId);
      if (deleteError) throw new Error(deleteError.message);
      if (!voucherForm.eligible_to_all && voucherForm.eligible_user_ids.length > 0) {
        const { error: assignmentError } = await supabase
          .from("voucher_eligibility")
          .insert(
            voucherForm.eligible_user_ids.map((user_id) => ({ voucher_id: voucherId, user_id })),
          );
        if (assignmentError) throw new Error(assignmentError.message);
      }
      toast.success("Voucher saved");
      setVoucherEdit(null);
      setVoucherForm(blankVoucher);
      await qc.invalidateQueries({ queryKey: ["admin"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Voucher could not be saved.");
    } finally {
      setBusy(false);
    }
  };

  const saveWelcomeSettings = async (event: React.FormEvent) => {
    event.preventDefault();
    await act(
      () =>
        supabase
          .from("welcome_voucher_settings")
          .update({
            active: welcomeForm.active,
            discount_type: welcomeForm.discount_type,
            discount_value: Number(welcomeForm.discount_value),
            min_order: Number(welcomeForm.min_order),
            max_discount: welcomeForm.max_discount === "" ? null : Number(welcomeForm.max_discount),
            validity_days: Number(welcomeForm.validity_days),
            updated_at: new Date().toISOString(),
          })
          .eq("id", 1),
      "Welcome voucher settings saved",
    );
  };

  const uploadPhoto = async (file: File) => {
    setBusy(true);
    const path = `${generateUuid()}-${file.name.replace(/[^a-zA-Z0-9.]/g, "_")}`;
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
          {roleError
            ? `Administrator access could not be verified: ${roleError}`
            : "This area is restricted. Administrators must sign in through the admin login page."}
        </p>
        <Button asChild className="mt-6">
          <Link to="/admin-login">Go to admin login</Link>
        </Button>
      </main>
    );

  const spent = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const today = new Date().toDateString();
  const lowStock = ingredients.filter((i) => Number(i.quantity) <= Number(i.reorder_level));
  const adminIds = new Set(roles.filter((r) => r.role === "admin").map((r) => r.user_id));
  const customers = profiles.filter((profile) => !adminIds.has(profile.id));
  const pending = requests.filter((r) => r.status === "pending");
  const shownOrders = orders.filter((order) => {
    if (orderDateRange) {
      const createdAt = new Date(order.created_at);
      if (
        createdAt < new Date(`${orderDateRange.start}T00:00:00`) ||
        createdAt > new Date(`${orderDateRange.end}T23:59:59.999`)
      ) {
        return false;
      }
    }
    if (orderFilter === "today") return new Date(order.created_at).toDateString() === today;
    if (orderFilter === "all") return true;
    if (orderFilter === "confirmed_sales") return isConfirmedOrder(order.status);
    if (orderFilter === "payment_received" || orderFilter === "payment_pending") {
      if (!isConfirmedOrder(order.status)) return false;
      const received = paymentEntries
        .filter((entry) => entry.order_id === order.id)
        .reduce(
          (sum, entry) =>
            sum + (entry.entry_type === "received" ? Number(entry.amount) : -Number(entry.amount)),
          0,
        );
      return orderFilter === "payment_received" ? received > 0 : received < Number(order.total);
    }
    return order.status === orderFilter;
  });
  const filteredCustomers = customers.filter((profile) => {
    const search = customerSearch.trim().toLowerCase();
    return (
      !search ||
      [profile.full_name, profile.email, profile.phone].some((value) =>
        value?.toLowerCase().includes(search),
      )
    );
  });
  const filteredCakes = cakes.filter((cake) => {
    const search = cakeSearch.trim().toLowerCase();
    return (
      !search ||
      cake.name.toLowerCase().includes(search) ||
      cake.category.toLowerCase().includes(search)
    );
  });
  const selectedCustomer = profiles.find((profile) => profile.id === selectedCustomerId);
  const selectedCustomerOrders = orders.filter((order) => order.user_id === selectedCustomerId);
  const selectedCustomerTotal = selectedCustomerOrders.reduce(
    (sum, order) => sum + Number(order.total),
    0,
  );
  const selectedOrder = orders.find((order) => order.id === selectedOrderId);
  const selectedOrderProfile = profiles.find((profile) => profile.id === selectedOrder?.user_id);
  const selectedCake = cakes.find((cake) => cake.id === selectedCakeId);

  const Stat = ({
    label,
    value,
    onClick,
  }: {
    label: string;
    value: string | number;
    onClick?: () => void;
  }) => {
    const content = (
      <>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold">{value}</p>
      </>
    );
    const className = `rounded-2xl bg-card p-5 text-left shadow-soft ${onClick ? "w-full cursor-pointer transition hover:ring-1 hover:ring-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" : ""}`;
    return onClick ? (
      <button type="button" className={className} onClick={onClick}>
        {content}
      </button>
    ) : (
      <div className={className}>{content}</div>
    );
  };

  return (
    <div className="admin-layout mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 md:flex-row">
      <aside className="admin-sidebar md:w-56 md:shrink-0">
        <p className="mb-3 font-display text-xl">Admin portal</p>
        <nav className="admin-nav flex flex-wrap gap-1 md:flex-col">
          {nav.map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => goToSection(id)}
              className={`admin-nav-link flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm ${section === id ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
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
            className="admin-nav-link flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted"
          >
            <Store className="h-4 w-4" />
            View shop
          </a>
        </nav>
      </aside>
      <main className="admin-main min-w-0 flex-1">
        {section === "dashboard" && (
          <div className="space-y-6">
            <FinancialDashboard
              orders={orders}
              expenses={expenses}
              paymentEntries={paymentEntries}
              onOpenOrders={(filter, start, end) => {
                setOrderFilter(filter);
                setOrderDateRange({ start, end });
                goToSection("orders");
              }}
              onOpenExpenses={() => goToSection("expenses")}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Stat
                label="Customers"
                value={customers.length}
                onClick={() => goToSection("customers")}
              />
              <Stat
                label="Cakes Listed"
                value={cakes.length}
                onClick={() => goToSection("cakes")}
              />
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
                    <button
                      type="button"
                      className="font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => setSelectedOrderId(o.id)}
                    >
                      {o.customer_name || "Customer"}
                    </button>
                    {" · "}
                    {new Date(o.created_at).toLocaleDateString()}
                  </span>
                  <span className="capitalize">
                    {o.status.replaceAll("_", " ")} · {formatPrice(o.total)}
                  </span>
                </div>
              ))}
              {orders.length === 0 && <p className="py-3 text-muted-foreground">No orders yet.</p>}
            </div>
          </div>
        )}

        {section === "orders" && (
          <section>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-3xl">
                  {orderFilter === "today"
                    ? "Today's Orders"
                    : orderFilter === "pending"
                      ? "Pending Orders"
                      : orderFilter === "delivered"
                        ? "Completed Orders"
                        : orderFilter === "cancelled"
                          ? "Cancelled Orders"
                          : orderFilter === "confirmed_sales"
                            ? "Confirmed Sales Orders"
                            : orderFilter === "payment_received"
                              ? "Orders with Payments Received"
                              : orderFilter === "payment_pending"
                                ? "Orders with Payments Pending"
                                : "Orders"}
                </h1>
                {orderDateRange && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    Dashboard date range: {orderDateRange.start} to {orderDateRange.end}
                    <button
                      type="button"
                      className="ml-2 text-primary underline"
                      onClick={() => setOrderDateRange(null)}
                    >
                      Clear date range
                    </button>
                  </p>
                )}
              </div>
              <select
                aria-label="Filter orders"
                className="rounded-md border bg-background px-3 py-2 text-sm"
                value={orderFilter}
                onChange={(e) => {
                  setOrderFilter(e.target.value);
                  setOrderDateRange(null);
                }}
              >
                <option value="all">All statuses</option>
                <option value="today">Today</option>
                <option value="confirmed_sales">Confirmed sales</option>
                <option value="payment_received">Payments received</option>
                <option value="payment_pending">Payments pending</option>
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
                        <button
                          type="button"
                          className="text-left text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          onClick={() => setSelectedOrderId(o.id)}
                        >
                          {o.customer_name || "Customer"}
                        </button>
                        {" · "}
                        {formatPrice(o.total)}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        #{o.id} · {new Date(o.created_at).toLocaleString()}
                      </p>
                      <p className="break-all text-xs text-muted-foreground">
                        Customer ID: {o.user_id}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <select
                        aria-label={`Status for order ${o.id}`}
                        className="rounded-md border bg-background px-3 py-2 text-sm"
                        value={o.status}
                        disabled={busy}
                        onChange={(e) =>
                          void updateOrderStatus(o.id, e.target.value, "Order updated")
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
                    {o.phone} · {o.fulfillment_type === "pickup" ? "Self pick-up" : "Home delivery"}
                    {o.delivery_area ? ` · ${o.delivery_area}` : ""}
                    {o.address ? ` · ${o.address}` : ""}
                    {o.delivery_date ? ` · ${o.delivery_date}` : ""}
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
                  <p className="mt-2 text-sm text-muted-foreground">
                    Payment: {o.payment_method.replaceAll("_", " ")} · {o.payment_status}
                    {o.transaction_reference ? ` · Ref: ${o.transaction_reference}` : ""}
                    {" · "}Delivery {formatPrice(o.delivery_charge)} · Discount{" "}
                    {formatPrice(o.discount)}
                  </p>
                  {o.status === "cancelled" && (
                    <p className="mt-2 text-sm text-destructive">
                      Cancelled{" "}
                      {o.cancelled_at
                        ? new Date(o.cancelled_at).toLocaleString()
                        : "date not recorded"}
                      {o.cancellation_note ? ` · ${o.cancellation_note}` : " · No reason recorded"}
                    </p>
                  )}
                  <OrderPaymentEntry order={o} entries={paymentEntries} />
                </article>
              ))}
            </div>
          </section>
        )}

        {section === "delivery" && (
          <section>
            <h1 className="mb-2 text-3xl">Delivery management</h1>
            <p className="mb-5 text-sm text-muted-foreground">
              Review delivery addresses and shop collection orders, then update fulfilment status.
              Current home-delivery charge:{" "}
              {formatPrice(Number(content["delivery_charge"] || 0) || 0)}.
            </p>
            <div className="divide-y rounded-2xl bg-card px-4 shadow-soft sm:px-6">
              {orders
                .filter(
                  (order) =>
                    order.fulfillment_type === "delivery" || order.fulfillment_type === "pickup",
                )
                .map((order) => (
                  <article
                    key={order.id}
                    className="flex flex-wrap items-start justify-between gap-4 py-5"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold">
                        {order.fulfillment_type === "pickup" ? "Self pick-up" : "Home delivery"} ·{" "}
                        {order.customer_name || "Customer"}
                      </p>
                      <p className="mt-1 break-words text-sm text-muted-foreground">
                        {order.phone}
                        {order.delivery_area ? ` · ${order.delivery_area}` : ""}
                        {order.address ? ` · ${order.address}` : ""}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Order #{order.id.slice(0, 8)} ·{" "}
                        {order.delivery_date || "Date not specified"} · Delivery charge{" "}
                        {formatPrice(order.delivery_charge)}
                      </p>
                    </div>
                    <select
                      aria-label={`Fulfilment status for order ${order.id}`}
                      className="rounded-md border bg-background px-3 py-2 text-sm"
                      value={order.status}
                      disabled={busy}
                      onChange={(event) =>
                        void updateOrderStatus(
                          order.id,
                          event.target.value,
                          "Fulfilment status updated",
                        )
                      }
                    >
                      {statuses.map((status) => (
                        <option key={status} value={status}>
                          {status.replaceAll("_", " ")}
                        </option>
                      ))}
                    </select>
                  </article>
                ))}
              {orders.length === 0 && (
                <p className="py-5 text-muted-foreground">No delivery or collection orders yet.</p>
              )}
            </div>
          </section>
        )}

        {section === "carts" && (
          <section>
            <h1 className="mb-5 text-3xl">Customer carts</h1>
            {cartItems.length === 0 ? (
              <p className="text-muted-foreground">No saved customer carts.</p>
            ) : (
              <div className="divide-y">
                {cartItems.map((item) => {
                  const customer = profiles.find((profile) => profile.id === item.user_id);
                  return (
                    <article
                      key={`${item.user_id}:${item.cake_id}:${item.pounds}`}
                      className="flex flex-wrap items-center gap-3 py-4"
                    >
                      {item.image_url ? (
                        <img
                          src={cakeImage(item.image_url)}
                          alt={item.cake_name}
                          className="h-14 w-14 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="h-14 w-14 rounded-lg bg-muted" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">
                          {item.cake_name} · {item.pounds} lb
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {customer?.full_name || customer?.email || "Customer"} ·{" "}
                          {formatPrice(item.unit_price * item.pounds * item.quantity)}
                        </p>
                      </div>
                      <Input
                        aria-label={`Quantity for ${item.cake_name}`}
                        type="number"
                        min={1}
                        max={50}
                        step={1}
                        className="w-24"
                        defaultValue={item.quantity}
                        onBlur={(event) => {
                          const quantity = Number(event.target.value);
                          if (!Number.isInteger(quantity) || quantity < 1 || quantity > 50) {
                            event.target.value = String(item.quantity);
                            toast.error("Quantity must be a whole number from 1 to 50.");
                            return;
                          }
                          if (quantity !== item.quantity) {
                            act(
                              () =>
                                supabase
                                  .from("cart_items")
                                  .update({ quantity })
                                  .eq("user_id", item.user_id)
                                  .eq("cake_id", item.cake_id)
                                  .eq("pounds", item.pounds),
                              "Customer cart updated",
                            );
                          }
                        }}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove ${item.cake_name} from customer cart`}
                        disabled={busy}
                        onClick={() =>
                          act(
                            () =>
                              supabase
                                .from("cart_items")
                                .delete()
                                .eq("user_id", item.user_id)
                                .eq("cake_id", item.cake_id)
                                .eq("pounds", item.pounds),
                            "Cart item removed",
                          )
                        }
                      >
                        <Trash2 className="text-destructive" />
                      </Button>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {section === "vouchers" && (
          <section className="space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-3xl">Vouchers and discounts</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Manage customer-specific codes, promotions, and automatic welcome rewards.
                </p>
              </div>
              <Button
                onClick={() => {
                  setVoucherEdit("new");
                  setVoucherForm(blankVoucher);
                }}
              >
                <Plus />
                Create voucher
              </Button>
            </div>

            {voucherEdit && (
              <form
                onSubmit={saveVoucher}
                className="grid gap-4 rounded-2xl border p-4 sm:grid-cols-2 sm:p-6"
              >
                <h2 className="text-xl font-semibold sm:col-span-2">
                  {voucherEdit === "new" ? "New promotional voucher" : "Edit voucher"}
                </h2>
                <label className="grid gap-1.5 text-sm font-medium">
                  Unique discount code
                  <Input
                    required
                    value={voucherForm.code}
                    onChange={(event) =>
                      setVoucherForm({ ...voucherForm, code: event.target.value.toUpperCase() })
                    }
                  />
                </label>
                <label className="grid gap-1.5 text-sm font-medium">
                  Discount (%)
                  <Input
                    required
                    type="number"
                    min="0.01"
                    max="100"
                    step="0.01"
                    value={voucherForm.discount_value}
                    onChange={(event) =>
                      setVoucherForm({ ...voucherForm, discount_value: Number(event.target.value) })
                    }
                  />
                </label>
                <label className="grid gap-1.5 text-sm font-medium">
                  Minimum order (৳)
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={voucherForm.min_order}
                    onChange={(event) =>
                      setVoucherForm({ ...voucherForm, min_order: Number(event.target.value) })
                    }
                  />
                </label>
                <label className="grid gap-1.5 text-sm font-medium">
                  Maximum discount (optional, ৳)
                  <Input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={voucherForm.max_discount}
                    onChange={(event) =>
                      setVoucherForm({ ...voucherForm, max_discount: event.target.value })
                    }
                  />
                </label>
                <label className="grid gap-1.5 text-sm font-medium">
                  Expiry date (optional)
                  <Input
                    type="datetime-local"
                    value={voucherForm.expires_at}
                    onChange={(event) =>
                      setVoucherForm({ ...voucherForm, expires_at: event.target.value })
                    }
                  />
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={voucherForm.active}
                    onChange={(event) =>
                      setVoucherForm({ ...voucherForm, active: event.target.checked })
                    }
                  />
                  Active and redeemable
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={voucherForm.eligible_to_all}
                    onChange={(event) =>
                      setVoucherForm({ ...voucherForm, eligible_to_all: event.target.checked })
                    }
                  />
                  Available to all customers
                </label>
                {!voucherForm.eligible_to_all && (
                  <label className="grid gap-1.5 text-sm font-medium sm:col-span-2">
                    Eligible customers (Ctrl/Cmd-click to select multiple)
                    <select
                      multiple
                      required
                      className="min-h-36 rounded-md border border-input bg-background p-2"
                      value={voucherForm.eligible_user_ids}
                      onChange={(event) =>
                        setVoucherForm({
                          ...voucherForm,
                          eligible_user_ids: Array.from(
                            event.target.selectedOptions,
                            (option) => option.value,
                          ),
                        })
                      }
                    >
                      {customers.map((customer) => (
                        <option key={customer.id} value={customer.id}>
                          {customer.full_name || customer.email || customer.id}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <div className="flex gap-2 sm:col-span-2">
                  <Button type="submit" disabled={busy}>
                    <Save />
                    Save voucher
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setVoucherEdit(null)}>
                    Cancel
                  </Button>
                </div>
              </form>
            )}

            <div className="space-y-3">
              {vouchers.map((voucher) => {
                const eligibleIds = voucherEligibility
                  .filter((row) => row.voucher_id === voucher.id)
                  .map((row) => row.user_id);
                return (
                  <article
                    key={voucher.id}
                    className="flex flex-wrap items-center gap-3 rounded-xl border p-4"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">
                        {voucher.code}
                        {voucher.is_welcome ? " · Welcome" : ""}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {voucher.discount_value}% off
                        {" · "}Minimum {formatPrice(voucher.min_order)}
                        {voucher.max_discount ? ` · Max ${formatPrice(voucher.max_discount)}` : ""}
                        {" · "}
                        {voucher.eligible_to_all
                          ? "All customers"
                          : `${eligibleIds.length} selected customer(s)`}
                        {" · "}Expires{" "}
                        {voucher.expires_at
                          ? new Date(voucher.expires_at).toLocaleDateString()
                          : "never"}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs ${voucher.active ? "bg-green-100 text-green-800" : "bg-muted text-muted-foreground"}`}
                    >
                      {voucher.active ? "Active" : "Inactive"}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => {
                        setVoucherEdit(voucher.id);
                        setVoucherForm({
                          code: voucher.code,
                          discount_type: "percent",
                          discount_value: voucher.discount_value,
                          min_order: voucher.min_order,
                          max_discount:
                            voucher.max_discount == null ? "" : String(voucher.max_discount),
                          expires_at: voucher.expires_at
                            ? new Date(voucher.expires_at).toISOString().slice(0, 16)
                            : "",
                          active: voucher.active,
                          eligible_to_all: voucher.eligible_to_all,
                          eligible_user_ids: eligibleIds,
                          is_welcome: voucher.is_welcome,
                        });
                      }}
                    >
                      <Pencil />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete voucher ${voucher.code}`}
                      disabled={busy}
                      onClick={() => {
                        if (window.confirm(`Delete voucher ${voucher.code}?`)) {
                          act(
                            () => supabase.from("vouchers").delete().eq("id", voucher.id),
                            "Voucher deleted",
                          );
                        }
                      }}
                    >
                      <Trash2 className="text-destructive" />
                    </Button>
                  </article>
                );
              })}
              {vouchers.length === 0 && (
                <p className="text-muted-foreground">No vouchers created yet.</p>
              )}
            </div>

            <form
              onSubmit={saveWelcomeSettings}
              className="space-y-4 rounded-2xl bg-card p-4 shadow-soft sm:p-6"
            >
              <div>
                <h2 className="text-xl font-semibold">Automatic welcome voucher</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  New customer accounts receive a unique code with these terms.
                </p>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={welcomeForm.active}
                  onChange={(event) =>
                    setWelcomeForm({ ...welcomeForm, active: event.target.checked })
                  }
                />
                Issue a welcome voucher on registration
              </label>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <label className="grid gap-1.5 text-sm font-medium">
                  Discount (%)
                  <Input
                    type="number"
                    min="0.01"
                    max="100"
                    step="0.01"
                    value={welcomeForm.discount_value}
                    onChange={(event) =>
                      setWelcomeForm({ ...welcomeForm, discount_value: Number(event.target.value) })
                    }
                  />
                </label>
                <label className="grid gap-1.5 text-sm font-medium">
                  Minimum order (৳)
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={welcomeForm.min_order}
                    onChange={(event) =>
                      setWelcomeForm({ ...welcomeForm, min_order: Number(event.target.value) })
                    }
                  />
                </label>
                <label className="grid gap-1.5 text-sm font-medium">
                  Maximum discount (optional, ৳)
                  <Input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={welcomeForm.max_discount}
                    onChange={(event) =>
                      setWelcomeForm({ ...welcomeForm, max_discount: event.target.value })
                    }
                  />
                </label>
                <label className="grid gap-1.5 text-sm font-medium">
                  Validity (days)
                  <Input
                    type="number"
                    min="1"
                    max="3650"
                    step="1"
                    value={welcomeForm.validity_days}
                    onChange={(event) =>
                      setWelcomeForm({ ...welcomeForm, validity_days: Number(event.target.value) })
                    }
                  />
                </label>
              </div>
              <Button type="submit" disabled={busy}>
                <Save />
                Save welcome voucher settings
              </Button>
            </form>
          </section>
        )}

        {section === "payments" && (
          <section>
            <h1 className="mb-2 text-3xl">Payments and receipts</h1>
            <p className="mb-5 text-sm text-muted-foreground">
              Record each received payment or refund against its order. Partial payments update the
              outstanding balance automatically; transaction references are retained for audit.
            </p>
            <h2 className="mb-3 text-xl font-semibold">Order payment ledger</h2>
            <div className="mb-8 divide-y rounded-2xl bg-card px-4 shadow-soft sm:px-6">
              {orders.map((order) => (
                <article key={order.id} className="py-4">
                  <div className="flex flex-wrap justify-between gap-2">
                    <div>
                      <p className="font-medium">
                        {order.payment_method} · {order.customer_name || "Customer"} ·{" "}
                        {formatPrice(order.total)}
                      </p>
                      <p className="break-all text-sm text-muted-foreground">
                        Order #{order.id} · Customer ID: {order.user_id} ·{" "}
                        {order.status.replaceAll("_", " ")} · Transaction reference:{" "}
                        {order.transaction_reference || "Not provided"}
                      </p>
                    </div>
                  </div>
                  <OrderPaymentEntry order={order} entries={paymentEntries} />
                </article>
              ))}
              {orders.length === 0 && (
                <p className="py-4 text-sm text-muted-foreground">No orders to reconcile.</p>
              )}
            </div>
            <h2 className="mb-3 text-xl font-semibold">Payment method settings</h2>
            <div className="divide-y rounded-2xl bg-card px-4 shadow-soft sm:px-6">
              {paymentMethods.map((method) => (
                <article
                  key={method.id}
                  className="grid gap-3 py-5 sm:grid-cols-[minmax(150px,0.6fr)_minmax(0,1.4fr)_auto] sm:items-center"
                >
                  <div>
                    <p className="font-semibold">{method.label}</p>
                    <p className="text-xs uppercase text-muted-foreground">
                      {method.id.replaceAll("_", " ")}
                    </p>
                  </div>
                  <Input
                    aria-label={`${method.label} payment instructions`}
                    placeholder="Instructions shown at checkout"
                    defaultValue={method.instructions}
                    onBlur={(event) => {
                      if (event.target.value !== method.instructions) {
                        act(
                          () =>
                            supabase
                              .from("payment_methods")
                              .update({
                                instructions: event.target.value,
                                updated_at: new Date().toISOString(),
                              })
                              .eq("id", method.id),
                          "Payment instructions saved",
                        );
                      }
                    }}
                  />
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={method.enabled}
                      disabled={busy}
                      onChange={(event) =>
                        act(
                          () =>
                            supabase
                              .from("payment_methods")
                              .update({
                                enabled: event.target.checked,
                                updated_at: new Date().toISOString(),
                              })
                              .eq("id", method.id),
                          "Payment method updated",
                        )
                      }
                    />
                    Enabled
                  </label>
                </article>
              ))}
            </div>
          </section>
        )}

        {section === "support" && (
          <section>
            <h1 className="mb-2 text-3xl">Customer support requests</h1>
            <p className="mb-5 text-sm text-muted-foreground">
              Review requests submitted by customers and keep each status current.
            </p>
            <div className="divide-y rounded-2xl bg-card px-4 shadow-soft sm:px-6">
              {supportRequests.map((request) => {
                const customer = profiles.find((profile) => profile.id === request.user_id);
                return (
                  <article key={request.id} className="py-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="font-semibold">{request.subject}</h2>
                        <p className="text-xs text-muted-foreground">
                          #{request.id.slice(0, 8)} ·{" "}
                          {customer?.full_name || customer?.email || request.user_id}
                          {" · "}
                          {request.category}
                          {request.order_id ? ` · Order #${request.order_id.slice(0, 8)}` : ""}
                          {" · "}
                          {new Date(request.created_at).toLocaleString()}
                        </p>
                      </div>
                      <select
                        aria-label={`Status for support request ${request.id}`}
                        className="rounded-md border bg-background px-3 py-2 text-sm"
                        value={request.status}
                        disabled={busy}
                        onChange={(event) =>
                          act(
                            () =>
                              supabase
                                .from("support_requests")
                                .update({ status: event.target.value })
                                .eq("id", request.id),
                            "Support request status updated",
                          )
                        }
                      >
                        <option value="submitted">Submitted</option>
                        <option value="in_progress">In progress</option>
                        <option value="resolved">Resolved</option>
                      </select>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm">{request.description}</p>
                  </article>
                );
              })}
              {supportRequests.length === 0 && (
                <p className="py-5 text-sm text-muted-foreground">
                  No support requests have been submitted.
                </p>
              )}
            </div>
          </section>
        )}

        {section === "cakes" && (
          <section>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <h1 className="text-3xl">{cakeSearch ? "Cakes" : "Cakes Listed"}</h1>
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
            <Input
              aria-label="Search cakes"
              placeholder="Search cakes by name or category"
              className="mb-5 max-w-md"
              value={cakeSearch}
              onChange={(event) => setCakeSearch(event.target.value)}
            />
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
              {filteredCakes.map((c) => (
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
                    <Button
                      variant="link"
                      className="h-auto whitespace-normal p-0 text-left font-semibold"
                      onClick={() => setSelectedCakeId(c.id)}
                    >
                      {c.name}
                    </Button>
                    <p className="text-sm text-muted-foreground">
                      {c.category} · {formatPrice(c.price)} / lb ·{" "}
                      {c.available ? "Available" : "Unavailable"} · Stock:{" "}
                      {c.stock_num ?? "Unlimited"}
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
              {filteredCakes.length === 0 && (
                <p className="py-4 text-muted-foreground">
                  {cakes.length === 0 ? "No cakes listed." : "No cakes match your search."}
                </p>
              )}
            </div>
          </section>
        )}

        {section === "customers" && (
          <section>
            <h1 className="mb-5 text-3xl">Customers</h1>
            <Input
              aria-label="Search customers"
              placeholder="Search by name, email, or phone"
              className="mb-5 max-w-md"
              value={customerSearch}
              onChange={(event) => setCustomerSearch(event.target.value)}
            />
            <div className="divide-y">
              {filteredCustomers.map((customer) => (
                <div
                  key={customer.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-4"
                >
                  <div className="min-w-0 flex-1">
                    <Button
                      variant="link"
                      className="h-auto whitespace-normal p-0 text-left font-medium"
                      onClick={() => setSelectedCustomerId(customer.id)}
                    >
                      {customer.full_name || "Customer"}
                    </Button>
                    <p className="break-all text-sm text-muted-foreground">
                      {customer.email || "Email not provided"} ·{" "}
                      {customer.phone || "Phone not provided"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {orders.filter((order) => order.user_id === customer.id).length} orders ·
                      Registered {new Date(customer.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
              {filteredCustomers.length === 0 && (
                <p className="py-4 text-muted-foreground">
                  {customers.length === 0
                    ? "No customers registered."
                    : "No customers match your search."}
                </p>
              )}
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
                    step="0.00001"
                    min="0"
                    value={ingForm.quantity}
                    onChange={(e) => setIngForm({ ...ingForm, quantity: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label htmlFor="ing-unit">Unit of measure</Label>
                  <Input
                    id="ing-unit"
                    value={ingForm.unit}
                    disabled
                    aria-label="Inventory unit of measure"
                  />
                </div>
                <div>
                  <Label htmlFor="ing-reorder">Reorder at</Label>
                  <Input
                    id="ing-reorder"
                    type="number"
                    step="0.00001"
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
                        {Number(i.quantity).toLocaleString(undefined, { maximumFractionDigits: 5 })}{" "}
                        {i.unit}
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
                  {key.endsWith("_enabled") ? (
                    <label className="mt-2 flex items-center gap-2 text-sm">
                      <input
                        id={key}
                        type="checkbox"
                        checked={(contentDraft[key] ?? content[key] ?? "true") === "true"}
                        onChange={(event) =>
                          setContentDraft({
                            ...contentDraft,
                            [key]: String(event.target.checked),
                          })
                        }
                      />
                      Enabled
                    </label>
                  ) : (
                    <Input
                      id={key}
                      type={key === "delivery_charge" ? "number" : "text"}
                      min={key === "delivery_charge" ? "0" : undefined}
                      step={key === "delivery_charge" ? "0.01" : undefined}
                      value={contentDraft[key] ?? content[key] ?? ""}
                      onChange={(e) => setContentDraft({ ...contentDraft, [key]: e.target.value })}
                    />
                  )}
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
                <DialogDescription>Customer profile and complete order history.</DialogDescription>
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
                  <dd className="break-words">{selectedCustomer.address || "Not provided"}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Registered</dt>
                  <dd>{new Date(selectedCustomer.created_at).toLocaleDateString()}</dd>
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
                          #{order.id} · {new Date(order.created_at).toLocaleString()}
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
                              {item.quantity_num ?? item.quantity} × {formatPrice(item.unit_price)}
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
      <Dialog
        open={selectedCakeId !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedCakeId(null);
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          {selectedCake && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedCake.name}</DialogTitle>
                <DialogDescription>{selectedCake.category}</DialogDescription>
              </DialogHeader>
              {selectedCake.image_url && (
                <img
                  src={cakeImage(selectedCake.image_url)}
                  alt={selectedCake.name}
                  className="max-h-64 w-full rounded-lg object-cover"
                />
              )}
              <p className="break-words text-sm text-muted-foreground">
                {selectedCake.description || "No description available."}
              </p>
              <dl className="grid gap-3 rounded-lg bg-muted/50 p-4 sm:grid-cols-2">
                <div>
                  <dt className="text-sm text-muted-foreground">Category</dt>
                  <dd>{selectedCake.category}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Price</dt>
                  <dd>{formatPrice(selectedCake.price)} / lb</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Available stock</dt>
                  <dd>{selectedCake.stock_num ?? "Unlimited"}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Listing status</dt>
                  <dd>{selectedCake.available ? "Available" : "Unavailable"}</dd>
                </div>
              </dl>
              <Button
                onClick={() => {
                  setCakeEdit(selectedCake.id);
                  setCakeForm({
                    name: selectedCake.name,
                    description: selectedCake.description,
                    price: selectedCake.price,
                    image_url: selectedCake.image_url ?? "",
                    category: selectedCake.category,
                    tags: selectedCake.tags,
                    available: selectedCake.available,
                    stock: selectedCake.stock_num == null ? "" : String(selectedCake.stock_num),
                  });
                  setSelectedCakeId(null);
                }}
              >
                <Pencil />
                Edit cake
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={selectedOrderId !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedOrderId(null);
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          {selectedOrder && (
            <>
              <DialogHeader>
                <DialogTitle>Order details</DialogTitle>
                <DialogDescription className="break-all">
                  Order #{selectedOrder.id} · {new Date(selectedOrder.created_at).toLocaleString()}
                </DialogDescription>
              </DialogHeader>
              <dl className="grid gap-3 rounded-lg bg-muted/50 p-4 sm:grid-cols-2">
                <div>
                  <dt className="text-sm text-muted-foreground">Customer</dt>
                  <dd>
                    {selectedOrder.customer_name ||
                      selectedOrderProfile?.full_name ||
                      "Not provided"}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-sm text-muted-foreground">Customer / user ID</dt>
                  <dd className="break-all font-mono text-xs">{selectedOrder.user_id}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Phone</dt>
                  <dd>{selectedOrder.phone || selectedOrderProfile?.phone || "Not provided"}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Email</dt>
                  <dd className="break-all">{selectedOrderProfile?.email || "Not available"}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Order status</dt>
                  <dd className="capitalize">{selectedOrder.status.replaceAll("_", " ")}</dd>
                </div>
                {selectedOrder.status === "cancelled" && (
                  <>
                    <div>
                      <dt className="text-sm text-muted-foreground">Cancellation date</dt>
                      <dd>
                        {selectedOrder.cancelled_at
                          ? new Date(selectedOrder.cancelled_at).toLocaleString()
                          : "Not recorded"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm text-muted-foreground">Cancellation reason</dt>
                      <dd>{selectedOrder.cancellation_note || "No reason recorded"}</dd>
                    </div>
                  </>
                )}
                <div>
                  <dt className="text-sm text-muted-foreground">Fulfilment</dt>
                  <dd>
                    {selectedOrder.fulfillment_type === "pickup" ? "Self pick-up" : "Home delivery"}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-sm text-muted-foreground">House and road / collection</dt>
                  <dd className="break-words">
                    {selectedOrder.address ||
                      (selectedOrder.fulfillment_type === "pickup"
                        ? content["shop_address"] || "Shop collection"
                        : selectedOrderProfile?.address || "Not provided")}
                  </dd>
                </div>
                {selectedOrder.fulfillment_type === "delivery" && (
                  <>
                    <div className="sm:col-span-2">
                      <dt className="text-sm text-muted-foreground">Readable map address</dt>
                      <dd className="break-words">
                        {selectedOrder.delivery_map_address || "No readable address was saved"}
                      </dd>
                    </div>
                    {selectedOrder.delivery_latitude !== null &&
                      selectedOrder.delivery_longitude !== null && (
                        <div className="sm:col-span-2 space-y-3">
                          <div>
                            <dt className="text-sm text-muted-foreground">Selected coordinates</dt>
                            <dd className="font-mono text-sm">
                              {selectedOrder.delivery_latitude}, {selectedOrder.delivery_longitude}
                            </dd>
                          </div>
                          <DeliveryLocationMap
                            point={{
                              latitude: selectedOrder.delivery_latitude,
                              longitude: selectedOrder.delivery_longitude,
                            }}
                            interactive={false}
                          />
                          <a
                            className="inline-flex text-sm font-medium text-primary underline"
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${selectedOrder.delivery_latitude},${selectedOrder.delivery_longitude}`)}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open in Google Maps
                          </a>
                        </div>
                      )}
                  </>
                )}
                <div>
                  <dt className="text-sm text-muted-foreground">Payment method</dt>
                  <dd className="capitalize">
                    {selectedOrder.payment_method.replaceAll("_", " ")}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Payment status</dt>
                  <dd className="capitalize">{selectedOrder.payment_status}</dd>
                </div>
                {selectedOrder.transaction_reference && (
                  <div className="sm:col-span-2">
                    <dt className="text-sm text-muted-foreground">Transaction reference</dt>
                    <dd className="break-all">{selectedOrder.transaction_reference}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-sm text-muted-foreground">Delivery date</dt>
                  <dd>{selectedOrder.delivery_date || "Not specified"}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Delivery charge</dt>
                  <dd>{formatPrice(selectedOrder.delivery_charge)}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Discount</dt>
                  <dd>{formatPrice(selectedOrder.discount)}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Total payable</dt>
                  <dd className="font-semibold">{formatPrice(selectedOrder.total)}</dd>
                </div>
              </dl>
              <OrderPaymentEntry order={selectedOrder} entries={paymentEntries} />
              <section>
                <h2 className="font-semibold">Ordered products</h2>
                <ul className="mt-2 divide-y">
                  {selectedOrder.order_items.map((item) => {
                    const quantity = item.quantity_num ?? item.quantity;
                    return (
                      <li key={item.id} className="flex flex-wrap items-center gap-3 py-3">
                        {item.image_url && (
                          <img
                            src={cakeImage(item.image_url)}
                            alt={item.cake_name}
                            className="h-12 w-12 shrink-0 rounded object-cover"
                            onError={(event) => {
                              event.currentTarget.hidden = true;
                            }}
                          />
                        )}
                        <span className="min-w-0 flex-1">
                          {item.cake_name} · {item.pounds} lb · {quantity} ×{" "}
                          {formatPrice(item.unit_price)}
                        </span>
                        <span className="font-medium">
                          {formatPrice(Number(item.unit_price) * Number(quantity))}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
              {selectedOrder.note && (
                <p className="text-sm text-muted-foreground">Note: {selectedOrder.note}</p>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
