import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FinancialDashboard } from "@/components/admin/FinancialDashboard";
import { calculateFinancialTotals } from "@/lib/financial-report";

afterEach(() => vi.unstubAllGlobals());

describe("financial report calculations", () => {
  it("counts confirmed orders, discounts, expenses, partial payments, and refunds accurately", () => {
    const result = calculateFinancialTotals(
      [
        {
          id: "confirmed",
          status: "confirmed",
          total: 110,
          delivery_charge: 10,
          discount: 5,
        },
        {
          id: "completed",
          status: "delivered",
          total: 200,
          delivery_charge: 20,
          discount: 10,
        },
        {
          id: "pending",
          status: "pending",
          total: 110,
          delivery_charge: 10,
          discount: 5,
        },
        {
          id: "cancelled",
          status: "cancelled",
          total: 99,
          delivery_charge: 9,
          discount: 10,
        },
      ],
      [{ amount: 40 }],
      [
        { order_id: "confirmed", entry_type: "received", amount: 25 },
        { order_id: "completed", entry_type: "received", amount: 200 },
        { order_id: "cancelled", entry_type: "received", amount: 99 },
      ],
    );

    expect(result).toEqual({
      totalOrders: 4,
      completedOrders: 1,
      pendingOrders: 1,
      cancelledOrders: 1,
      sales: 280,
      expenses: 40,
      profit: 270,
      deliveryCharges: 30,
      discounts: 15,
      paymentsReceived: 225,
      pendingPayments: 85,
    });
  });

  it("subtracts refunds and excludes pending, cancelled, and duplicate payment effects", () => {
    const result = calculateFinancialTotals(
      [
        {
          id: "order",
          status: "preparing",
          total: 100,
          delivery_charge: 0,
          discount: 20,
        },
        {
          id: "unconfirmed",
          status: "pending",
          total: 100,
          delivery_charge: 0,
          discount: 20,
        },
      ],
      [],
      [
        { order_id: "order", entry_type: "received", amount: 60 },
        { order_id: "order", entry_type: "refunded", amount: 10 },
        { order_id: "unconfirmed", entry_type: "received", amount: 100 },
      ],
    );

    expect(result.sales).toBe(100);
    expect(result.discounts).toBe(20);
    expect(result.paymentsReceived).toBe(50);
    expect(result.pendingPayments).toBe(50);
  });
});

describe("financial dashboard card navigation", () => {
  it("opens status and finance details from every dashboard metric card", () => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    const onOpenOrders = vi.fn();
    const onOpenExpenses = vi.fn();
    const { container } = render(
      <FinancialDashboard
        orders={[]}
        expenses={[]}
        paymentEntries={[]}
        onOpenOrders={onOpenOrders}
        onOpenExpenses={onOpenExpenses}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Total Orders/ }));
    fireEvent.click(screen.getByRole("button", { name: /Completed Orders/ }));
    fireEvent.click(screen.getByRole("button", { name: /Pending Orders/ }));
    fireEvent.click(screen.getByRole("button", { name: /Cancelled Orders/ }));
    fireEvent.click(screen.getByRole("button", { name: /Total Sales/ }));
    fireEvent.click(screen.getByRole("button", { name: /Total Expenses/ }));
    fireEvent.click(screen.getByRole("button", { name: /Profit \(before product costs\)/ }));
    fireEvent.click(screen.getByRole("button", { name: /Total Delivery Charge/ }));
    fireEvent.click(screen.getByRole("button", { name: /Total Discount/ }));
    fireEvent.click(screen.getByRole("button", { name: /Payment Received/ }));
    fireEvent.click(screen.getByRole("button", { name: /Payment Pending/ }));

    expect(onOpenOrders.mock.calls.map(([filter]) => filter)).toEqual([
      "all",
      "delivered",
      "pending",
      "cancelled",
      "confirmed_sales",
      "confirmed_sales",
      "confirmed_sales",
      "confirmed_sales",
      "payment_received",
      "payment_pending",
    ]);
    expect(onOpenExpenses).toHaveBeenCalledOnce();
    expect(container.textContent).not.toContain("Daily Sales");
    expect(container.textContent).not.toContain("Daily Expenses");
    expect(container.textContent).not.toContain("Profit / Loss");
  });
});
