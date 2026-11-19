import { describe, expect, it } from "vitest";
import {
  clearLegacyDemoData,
  customersFromOrders,
  dashboardMetrics,
  LEGACY_DEMO_STORAGE_KEY,
  lowStock,
  ordersByDay,
  topProducts,
  type AdminSnapshot,
  type MetricOrder,
} from "@/features/admin/admin-metrics";

const NOW = new Date(2026, 10, 19, 15, 0, 0);
const today = new Date(2026, 10, 19, 10, 0, 0).toISOString();
const yesterday = new Date(2026, 10, 18, 10, 0, 0).toISOString();

function order(partial: Partial<MetricOrder> & Pick<MetricOrder, "id" | "status">): MetricOrder {
  return {
    number: 1,
    createdAt: today,
    name: "Cliente",
    phone: "+5521999990000",
    subtotalCents: 1000,
    ...partial,
  };
}

const snapshot: AdminSnapshot = {
  orders: [
    order({ id: "o1", number: 1, status: "aguardando-contato", subtotalCents: 1000 }),
    order({
      id: "o2",
      number: 2,
      status: "confirmado",
      subtotalCents: 2500,
      phone: "+5521888880000",
      name: "Ana",
    }),
    order({ id: "o3", number: 3, status: "cancelado", subtotalCents: 4000, createdAt: yesterday }),
    order({ id: "o4", number: 4, status: "concluido", subtotalCents: 3000, createdAt: yesterday }),
  ],
  items: [
    { orderId: "o1", productName: "Vaso", quantity: 2 },
    { orderId: "o2", productName: "Luminária", quantity: 1 },
    { orderId: "o3", productName: "Luminária", quantity: 9 },
    { orderId: "o4", productName: "Vaso", quantity: 1 },
  ],
  products: [
    { id: "p1", name: "Vaso", active: true, readyStock: true },
    { id: "p2", name: "Luminária", active: true, readyStock: true },
    { id: "p3", name: "Sob medida", active: true, readyStock: false },
    { id: "p4", name: "Rascunho", active: false, readyStock: true },
  ],
  inventory: [
    { productId: "p1", onHand: 5, allocated: 2, minimum: 1 },
    { productId: "p2", onHand: 1, allocated: 1, minimum: 0 },
  ],
  payments: [
    { orderId: "o2", amountCents: 2500, kind: "receipt" },
    { orderId: "o4", amountCents: 3000, kind: "receipt" },
    { orderId: "o4", amountCents: 500, kind: "refund" },
  ],
};

describe("CR-016 admin metrics from Supabase data", () => {
  it("computes dashboard counters without demo data", () => {
    const m = dashboardMetrics(snapshot, NOW);
    expect(m.ordersToday).toBe(2);
    expect(m.pending).toBe(1);
    expect(m.awaitingContact).toBe(1);
    expect(m.confirmed).toBe(1);
    expect(m.completed).toBe(1);
    expect(m.cancelled).toBe(1);
    expect(m.activeProducts).toBe(3);
    expect(m.customers).toBe(2);
    expect(m.confirmedRevenueCents).toBe(5500);
    expect(m.pendingEstimateCents).toBe(1000);
    expect(m.receivedRevenueCents).toBe(5000);
  });

  it("flags only active ready-stock products at or below the minimum", () => {
    expect(lowStock(snapshot).map((row) => row.name)).toEqual(["Luminária"]);
  });

  it("ignores cancelled orders in top products", () => {
    expect(topProducts(snapshot.orders, snapshot.items)).toEqual([
      { name: "Vaso", quantity: 3 },
      { name: "Luminária", quantity: 1 },
    ]);
  });

  it("builds daily series counting only confirmed sales as revenue", () => {
    const days = ordersByDay(snapshot.orders, 2, NOW);
    expect(days).toEqual([
      { label: "18/11", orders: 2, confirmedCents: 3000 },
      { label: "19/11", orders: 2, confirmedCents: 2500 },
    ]);
  });

  it("derives customers from orders grouped by WhatsApp", () => {
    const customers = customersFromOrders(snapshot.orders);
    expect(customers).toHaveLength(2);
    const main = customers.find((c) => c.phone === "+5521999990000")!;
    expect(main.orders).toHaveLength(3);
    expect(main.orders[0]!.number).toBe(1);
    expect(main.lastPurchase).toBe(today);
    expect(main.firstPurchase).toBe(yesterday);
    expect(main.confirmedTotalCents).toBe(3000);
  });

  it("removes the legacy demo data key from browser storage", () => {
    const removed: string[] = [];
    clearLegacyDemoData({ removeItem: (key: string) => void removed.push(key) });
    expect(removed).toEqual([LEGACY_DEMO_STORAGE_KEY]);
    expect(() => clearLegacyDemoData(undefined)).not.toThrow();
    expect(() =>
      clearLegacyDemoData({
        removeItem: () => {
          throw new Error("blocked");
        },
      }),
    ).not.toThrow();
  });
});
