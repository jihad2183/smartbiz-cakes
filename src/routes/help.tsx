import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/hooks/use-language";
import { supabase } from "@/integrations/supabase/client";

type SupportCategory = "order" | "general" | "complaint" | "other";

export const Route = createFileRoute("/help")({
  head: () => ({
    meta: [
      { title: "Help center | Smart Cake Shop" },
      { name: "description", content: "Contact Smart Cake Shop support and track your requests." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: HelpPage,
});

function HelpPage() {
  const { user, loading } = useAuth();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [category, setCategory] = useState<SupportCategory>("order");
  const [orderId, setOrderId] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { data: orders = [] } = useQuery({
    queryKey: ["support-orders", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id,created_at,status,total")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const {
    data: requests = [],
    isLoading: requestsLoading,
    error: requestsError,
  } = useQuery({
    queryKey: ["my-support-requests", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_requests")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  if (loading) return <main className="mx-auto max-w-3xl px-4 py-10">{t("loadingAccount")}</main>;
  if (!user) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="font-display text-4xl">{t("helpCenter")}</h1>
        <p className="mt-3 text-muted-foreground">{t("signInToContinue")}</p>
        <Button asChild className="mt-5">
          <Link to="/auth">{t("signIn")}</Link>
        </Button>
      </main>
    );
  }

  const submitRequest = async (event: FormEvent) => {
    event.preventDefault();
    if (category === "order" && !orderId) {
      toast.error("Choose the order you need help with.");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from("support_requests").insert({
        user_id: user.id,
        order_id: category === "order" ? orderId : null,
        category,
        subject: subject.trim(),
        description: description.trim(),
      });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["my-support-requests", user.id] });
      setSubject("");
      setDescription("");
      toast.success("Your support request was submitted.");
    } catch (submitError) {
      toast.error(
        submitError instanceof Error
          ? submitError.message
          : "The support request could not be saved.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const statusLabel = (status: string) => {
    if (status === "resolved") return t("resolved");
    if (status === "in_progress") return t("inProgress");
    return t("requestSubmitted");
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:py-10">
      <Button asChild variant="outline">
        <Link to="/account">← {t("myAccount")}</Link>
      </Button>
      <p className="mt-5 text-sm text-muted-foreground">Order questions and customer support</p>
      <h1 className="font-display text-4xl">{t("helpCenter")}</h1>

      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        <a
          href="#help-form"
          className="rounded-2xl border bg-card p-5 transition hover:border-primary"
        >
          <h2 className="font-semibold">{t("helpOrders")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">Ask about an order you have placed.</p>
        </a>
        <a
          href="#help-form"
          className="rounded-2xl border bg-card p-5 transition hover:border-primary"
        >
          <h2 className="font-semibold">{t("helpSomethingElse")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Send a general question or complaint.
          </p>
        </a>
      </section>

      <form
        id="help-form"
        onSubmit={submitRequest}
        className="mt-5 space-y-4 rounded-2xl bg-card p-5 shadow-soft sm:p-7"
      >
        <h2 className="text-xl font-semibold">{t("submitRequest")}</h2>
        <label className="grid gap-1.5 text-sm font-medium">
          {t("issueCategory")}
          <select
            className="h-10 rounded-md border border-input bg-background px-3"
            value={category}
            onChange={(event) => {
              const next = event.target.value as SupportCategory;
              setCategory(next);
              if (next !== "order") setOrderId("");
            }}
          >
            <option value="order">{t("helpOrders")}</option>
            <option value="general">{t("helpSomethingElse")}</option>
            <option value="complaint">Complaint</option>
            <option value="other">Other</option>
          </select>
        </label>
        {category === "order" && (
          <label className="grid gap-1.5 text-sm font-medium">
            {t("relatedOrder")}
            <select
              required
              className="h-10 rounded-md border border-input bg-background px-3"
              value={orderId}
              onChange={(event) => setOrderId(event.target.value)}
            >
              <option value="">Choose an order</option>
              {orders.map((order) => (
                <option key={order.id} value={order.id}>
                  #{order.id.slice(0, 8)} · {new Date(order.created_at).toLocaleDateString()} ·{" "}
                  {order.status.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="grid gap-1.5 text-sm font-medium">
          {t("subject")}
          <Input
            required
            maxLength={160}
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
          />
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          {t("description")}
          <textarea
            required
            maxLength={5000}
            rows={5}
            className="resize-y rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
        <Button type="submit" disabled={submitting}>
          {submitting ? t("loading") : t("submitRequest")}
        </Button>
      </form>

      <section id="requests" className="mt-8">
        <h2 className="text-2xl font-semibold">{t("trackRequest")}</h2>
        <h3 className="mt-1 text-sm text-muted-foreground">{t("supportRequests")}</h3>
        {requestsLoading ? (
          <p className="mt-4" role="status">
            {t("loading")}
          </p>
        ) : requestsError ? (
          <p className="mt-4 text-destructive" role="alert">
            Support requests could not be loaded. Please try again.
          </p>
        ) : requests.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            No support requests have been submitted.
          </p>
        ) : (
          <ul className="mt-4 divide-y rounded-2xl bg-card px-4 shadow-soft sm:px-6">
            {requests.map((request) => (
              <li key={request.id} className="py-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{request.subject}</p>
                    <p className="text-xs text-muted-foreground">
                      Request #{request.id.slice(0, 8)} ·{" "}
                      {new Date(request.created_at).toLocaleString()}
                      {request.order_id ? ` · Order #${request.order_id.slice(0, 8)}` : ""}
                    </p>
                  </div>
                  <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium">
                    {statusLabel(request.status)}
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                  {request.description}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
