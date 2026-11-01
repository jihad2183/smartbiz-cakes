import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatPrice } from "@/hooks/use-cart";
import type { Tables } from "@/integrations/supabase/types";
import { calculateFinancialTotals } from "@/lib/financial-report";

type Order = Tables<"orders">;
type Expense = Tables<"expenses">;
type PaymentEntry = Tables<"order_payment_entries">;
type DateFilter = "today" | "7days" | "30days" | "all" | "custom";
type SortMode = "newest" | "oldest" | "sales";
type DailySummary = {
  date: string;
  orders: Order[];
  expenses: Expense[];
  orderCount: number;
  sales: number;
  expensesTotal: number;
  discounts: number;
  deliveryCharges: number;
  profit: number;
};

const dateKey = (date: Date) =>
  new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);

const todayKey = () => dateKey(new Date());

const dateFromKey = (key: string) => new Date(`${key}T12:00:00`);

const orderDateKey = (value: string) => dateKey(new Date(value));

function ChartPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="min-w-0 rounded-2xl bg-card p-4 shadow-soft sm:p-5">
      <h3 className="mb-4 font-semibold">{title}</h3>
      <div className="h-64 min-w-0">{children}</div>
    </section>
  );
}

function Metric({
  label,
  value,
  onClick,
}: {
  label: string;
  value: string | number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-2xl bg-card p-4 text-left shadow-soft transition hover:ring-1 hover:ring-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </button>
  );
}

export function FinancialDashboard({
  orders,
  expenses,
  paymentEntries,
  onOpenOrders,
  onOpenExpenses,
}: {
  orders: Order[];
  expenses: Expense[];
  paymentEntries: PaymentEntry[];
  onOpenOrders: (filter: string, startDate: string, endDate: string) => void;
  onOpenExpenses: () => void;
}) {
  const [filter, setFilter] = useState<DateFilter>("today");
  const [customStart, setCustomStart] = useState(todayKey);
  const [customEnd, setCustomEnd] = useState(todayKey);
  const [appliedCustom, setAppliedCustom] = useState({ start: todayKey(), end: todayKey() });
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const bounds = useMemo(() => {
    const today = todayKey();
    if (filter === "today") return { start: today, end: today };
    if (filter === "7days" || filter === "30days") {
      const start = new Date();
      start.setHours(12, 0, 0, 0);
      start.setDate(start.getDate() - (filter === "7days" ? 6 : 29));
      return { start: dateKey(start), end: today };
    }
    if (filter === "custom") return appliedCustom;
    return { start: null, end: null };
  }, [appliedCustom, filter]);

  const filtered = useMemo(() => {
    const datedOrders = orders.map((order) => ({
      value: order,
      date: orderDateKey(order.created_at),
    }));
    const datedExpenses = expenses.map((expense) => ({
      value: expense,
      date: expense.spent_on.slice(0, 10),
    }));
    const dates = [...datedOrders, ...datedExpenses].map(({ date }) => date).sort();
    const start = bounds.start ?? dates[0] ?? todayKey();
    const end =
      bounds.end ?? (dates.at(-1) && dates.at(-1)! > todayKey() ? dates.at(-1)! : todayKey());
    const validRange = start <= end;
    return {
      start,
      end,
      validRange,
      orders: validRange
        ? datedOrders.filter(({ date }) => date >= start && date <= end).map(({ value }) => value)
        : [],
      expenses: validRange
        ? datedExpenses.filter(({ date }) => date >= start && date <= end).map(({ value }) => value)
        : [],
    };
  }, [bounds, expenses, orders]);

  const dailyRows = useMemo(() => {
    if (!filtered.validRange) return [];
    const rows: DailySummary[] = [];
    const cursor = dateFromKey(filtered.start);
    const end = dateFromKey(filtered.end);
    while (cursor <= end) {
      const date = dateKey(cursor);
      const dayOrders = filtered.orders.filter((order) => orderDateKey(order.created_at) === date);
      const dayExpenses = filtered.expenses.filter(
        (expense) => expense.spent_on.slice(0, 10) === date,
      );
      const totals = calculateFinancialTotals(dayOrders, dayExpenses, paymentEntries);
      rows.push({
        date,
        orders: dayOrders,
        expenses: dayExpenses,
        orderCount: totals.totalOrders,
        sales: totals.sales,
        expensesTotal: totals.expenses,
        discounts: totals.discounts,
        deliveryCharges: totals.deliveryCharges,
        profit: totals.profit,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    return rows;
  }, [filtered, paymentEntries]);

  const sortedDailyRows = useMemo(() => {
    const rows = [...dailyRows];
    if (sortMode === "oldest") return rows;
    if (sortMode === "sales") return rows.sort((a, b) => b.sales - a.sales);
    return rows.reverse();
  }, [dailyRows, sortMode]);

  const totals = calculateFinancialTotals(filtered.orders, filtered.expenses, paymentEntries);
  const selectedSummary = dailyRows.find((row) => row.date === selectedDate) ?? null;
  const chartRows = dailyRows.map((row) => ({
    ...row,
    label: dateFromKey(row.date).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    }),
    pendingOrders: row.orders.filter((order) => order.status === "pending").length,
    completedOrders: row.orders.filter((order) => order.status === "delivered").length,
    cancelledOrders: row.orders.filter((order) => order.status === "cancelled").length,
  }));
  const filters: [DateFilter, string][] = [
    ["today", "Today"],
    ["7days", "Last 7 Days"],
    ["30days", "Last 30 Days"],
    ["all", "All Time"],
    ["custom", "Custom Range"],
  ];
  const openOrders = (orderFilter: string) =>
    onOpenOrders(orderFilter, filtered.start, filtered.end);

  return (
    <section>
      <h1 className="mb-2 text-3xl">Financial dashboard</h1>
      <p className="mb-5 text-sm text-muted-foreground">
        Confirmed sales include confirmed, preparing, out-for-delivery, and delivered orders. Sales
        are after discounts and exclude delivery charges; profit adds delivery charges and subtracts
        recorded expenses. Profit is before product costs, which are not tracked here. Payments
        received are based on recorded receipts net of refunds.
      </p>
      <div className="flex flex-wrap gap-2" aria-label="Financial date filters">
        {filters.map(([value, label]) => (
          <Button
            key={value}
            variant={filter === value ? "default" : "outline"}
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
          >
            {label}
          </Button>
        ))}
      </div>
      {filter === "custom" && (
        <form
          className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (customStart > customEnd) {
              return;
            }
            setAppliedCustom({ start: customStart, end: customEnd });
          }}
        >
          <label className="grid gap-1 text-sm font-medium">
            Start Date
            <input
              type="date"
              value={customStart}
              onChange={(event) => setCustomStart(event.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3"
              required
            />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            End Date
            <input
              type="date"
              value={customEnd}
              onChange={(event) => setCustomEnd(event.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3"
              required
            />
          </label>
          <Button type="submit" disabled={!customStart || !customEnd || customStart > customEnd}>
            Apply Filter
          </Button>
          {customStart > customEnd && (
            <p className="text-sm text-destructive" role="alert">
              Start date must be on or before end date.
            </p>
          )}
        </form>
      )}

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Total Orders" value={totals.totalOrders} onClick={() => openOrders("all")} />
        <Metric
          label="Completed Orders"
          value={totals.completedOrders}
          onClick={() => openOrders("delivered")}
        />
        <Metric
          label="Pending Orders"
          value={totals.pendingOrders}
          onClick={() => openOrders("pending")}
        />
        <Metric
          label="Cancelled Orders"
          value={totals.cancelledOrders}
          onClick={() => openOrders("cancelled")}
        />
        <Metric
          label="Total Sales"
          value={formatPrice(totals.sales)}
          onClick={() => openOrders("confirmed_sales")}
        />
        <Metric
          label="Total Expenses"
          value={formatPrice(totals.expenses)}
          onClick={onOpenExpenses}
        />
        <Metric
          label="Total Profit (before product costs)"
          value={formatPrice(totals.profit)}
          onClick={() => openOrders("confirmed_sales")}
        />
        <Metric
          label="Total Delivery Charge"
          value={formatPrice(totals.deliveryCharges)}
          onClick={() => openOrders("confirmed_sales")}
        />
        <Metric
          label="Total Discount"
          value={formatPrice(totals.discounts)}
          onClick={() => openOrders("confirmed_sales")}
        />
        <Metric
          label="Payment Received (net)"
          value={formatPrice(totals.paymentsReceived)}
          onClick={() => openOrders("payment_received")}
        />
        <Metric
          label="Payment Pending"
          value={formatPrice(totals.pendingPayments)}
          onClick={() => openOrders("payment_pending")}
        />
      </div>

      {!filtered.validRange && (
        <p className="mt-5 rounded-lg bg-destructive/10 p-3 text-sm text-destructive" role="alert">
          The selected date range is invalid.
        </p>
      )}

      <div className="mt-6 grid gap-4">
        <ChartPanel title="Order Statistics">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartRows}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="completedOrders" name="Completed" stackId="orders" fill="#15803d" />
              <Bar dataKey="pendingOrders" name="Pending" stackId="orders" fill="#d97706" />
              <Bar dataKey="cancelledOrders" name="Cancelled" stackId="orders" fill="#dc2626" />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
      </div>

      <section className="mt-6 rounded-2xl bg-card p-4 shadow-soft sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Daily Financial Activity</h2>
            <p className="text-sm text-muted-foreground">
              Select a date to inspect orders and recorded expenses.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            Sort
            <select
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as SortMode)}
              className="h-10 rounded-md border border-input bg-background px-3"
            >
              <option value="newest">Newest date</option>
              <option value="oldest">Oldest date</option>
              <option value="sales">Highest sales</option>
            </select>
          </label>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="p-2">Date</th>
                <th className="p-2">Orders</th>
                <th className="p-2">Sales</th>
                <th className="p-2">Expenses</th>
                <th className="p-2">Discounts</th>
                <th className="p-2">Delivery Charges</th>
                <th className="p-2">Profit before product costs</th>
              </tr>
            </thead>
            <tbody>
              {sortedDailyRows.map((row) => (
                <tr key={row.date} className="border-b last:border-0">
                  <td className="p-2">
                    <button
                      type="button"
                      className="font-medium text-primary underline-offset-4 hover:underline"
                      onClick={() => setSelectedDate(row.date)}
                    >
                      {dateFromKey(row.date).toLocaleDateString()}
                    </button>
                  </td>
                  <td className="p-2">{row.orderCount}</td>
                  <td className="p-2">{formatPrice(row.sales)}</td>
                  <td className="p-2">{formatPrice(row.expensesTotal)}</td>
                  <td className="p-2">{formatPrice(row.discounts)}</td>
                  <td className="p-2">{formatPrice(row.deliveryCharges)}</td>
                  <td className="p-2">{formatPrice(row.profit)}</td>
                </tr>
              ))}
              {sortedDailyRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-muted-foreground">
                    No financial activity in this date range.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Dialog
        open={selectedSummary !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedDate(null);
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedSummary
                ? dateFromKey(selectedSummary.date).toLocaleDateString()
                : "Daily activity"}
            </DialogTitle>
            <DialogDescription>Orders and expenses recorded for this date.</DialogDescription>
          </DialogHeader>
          {selectedSummary && (
            <div className="space-y-5">
              <section>
                <h3 className="font-semibold">Orders ({selectedSummary.orders.length})</h3>
                {selectedSummary.orders.length ? (
                  <ul className="mt-2 divide-y rounded-lg border">
                    {selectedSummary.orders.map((order) => (
                      <li
                        key={order.id}
                        className="flex flex-wrap justify-between gap-2 p-3 text-sm"
                      >
                        <div className="min-w-0">
                          <p>
                            {order.customer_name || "Customer"} · #{order.id.slice(0, 8)}
                          </p>
                          <p className="break-all text-xs text-muted-foreground">
                            {order.status} · {order.payment_status} · {order.payment_method}
                            {order.transaction_reference
                              ? ` · Ref: ${order.transaction_reference}`
                              : ""}
                          </p>
                        </div>
                        <div className="text-right">
                          <p>{formatPrice(Number(order.total))}</p>
                          <p className="text-xs text-muted-foreground">
                            Discount {formatPrice(Number(order.discount))} · Delivery{" "}
                            {formatPrice(Number(order.delivery_charge))}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">No orders.</p>
                )}
              </section>
              <section>
                <h3 className="font-semibold">Expenses ({selectedSummary.expenses.length})</h3>
                {selectedSummary.expenses.length ? (
                  <ul className="mt-2 divide-y rounded-lg border">
                    {selectedSummary.expenses.map((expense) => (
                      <li
                        key={expense.id}
                        className="flex flex-wrap justify-between gap-2 p-3 text-sm"
                      >
                        <div>
                          <p>
                            {expense.title} · {expense.category}
                          </p>
                          {expense.note && (
                            <p className="text-xs text-muted-foreground">{expense.note}</p>
                          )}
                        </div>
                        <p>{formatPrice(Number(expense.amount))}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">No expenses.</p>
                )}
              </section>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
