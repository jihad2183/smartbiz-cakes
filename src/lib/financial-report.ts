import type { Tables } from "@/integrations/supabase/types";

type Order = Pick<Tables<"orders">, "id" | "status" | "total" | "delivery_charge" | "discount">;
type Expense = Pick<Tables<"expenses">, "amount">;
type PaymentEntry = Pick<Tables<"order_payment_entries">, "order_id" | "entry_type" | "amount">;

const CONFIRMED_ORDER_STATUSES = new Set([
  "confirmed",
  "preparing",
  "out_for_delivery",
  "delivered",
]);

export function isConfirmedOrder(status: string): boolean {
  return CONFIRMED_ORDER_STATUSES.has(status);
}

export type FinancialTotals = {
  totalOrders: number;
  completedOrders: number;
  pendingOrders: number;
  cancelledOrders: number;
  sales: number;
  expenses: number;
  profit: number;
  deliveryCharges: number;
  discounts: number;
  paymentsReceived: number;
  pendingPayments: number;
};

function sum(values: number[]) {
  return values.reduce((total, value) => total + (Number.isFinite(value) ? value : 0), 0);
}

export function calculateFinancialTotals(
  orders: Order[],
  expenses: Expense[],
  paymentEntries: PaymentEntry[],
): FinancialTotals {
  const confirmedOrders = orders.filter((order) => isConfirmedOrder(order.status));
  const deliveryCharges = sum(confirmedOrders.map((order) => Number(order.delivery_charge)));
  const sales = sum(
    confirmedOrders.map((order) =>
      Math.max(0, Number(order.total) - Number(order.delivery_charge)),
    ),
  );
  const expensesTotal = sum(expenses.map((expense) => Number(expense.amount)));
  const completedOrders = orders.filter((order) => order.status === "delivered").length;
  const cancelledOrders = orders.filter((order) => order.status === "cancelled").length;
  const confirmedOrderIds = new Set(confirmedOrders.map((order) => order.id));
  const entriesByOrder = new Map<string, { received: number; refunded: number }>();
  for (const entry of paymentEntries) {
    if (!confirmedOrderIds.has(entry.order_id)) continue;
    const balance = entriesByOrder.get(entry.order_id) ?? { received: 0, refunded: 0 };
    if (entry.entry_type === "received") balance.received += Number(entry.amount);
    if (entry.entry_type === "refunded") balance.refunded += Number(entry.amount);
    entriesByOrder.set(entry.order_id, balance);
  }
  const paymentBalances = confirmedOrders.map((order) => {
    const balance = entriesByOrder.get(order.id);
    return {
      received: Math.max(0, (balance?.received ?? 0) - (balance?.refunded ?? 0)),
      total: Math.max(0, Number(order.total)),
    };
  });

  return {
    totalOrders: orders.length,
    completedOrders,
    pendingOrders: orders.filter((order) => order.status === "pending").length,
    cancelledOrders,
    sales,
    expenses: expensesTotal,
    profit: sales + deliveryCharges - expensesTotal,
    deliveryCharges,
    discounts: sum(confirmedOrders.map((order) => Number(order.discount))),
    paymentsReceived: sum(paymentBalances.map((balance) => balance.received)),
    pendingPayments: sum(
      paymentBalances.map((balance) => Math.max(0, balance.total - balance.received)),
    ),
  };
}
