import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { createSeed } from "@/features/demo-data/seed";
import { allowedOrderStatuses, canChangeOrderStatus, changeOrderPayment, changeOrderStatus, validOrderUpdates } from "@/features/demo-data/order.rules";
import { adjustProductStock, dashboardMetrics, orderMetrics, orderTotal, ordersByDay, publicProducts } from "@/features/demo-data/rules";
import { isValidDemoData, recoverDemoData } from "@/features/demo-data/validation";
import { __resetDemoCache, demoRepository, DEMO_STORAGE_KEY, getDemoStorageStatus } from "@/features/demo-data/repository";
import type { DemoOrder } from "@/features/demo-data/model";
import type { OrderStatus } from "@/shared/types/order";
import { safeUrl } from "@/shared/utils/safe-url";

const now = new Date("2026-11-13T18:00:00Z");
const at = "2026-11-14T18:00:00Z";
function pending(): DemoOrder {
  const o = createSeed(now).orders[0]; if (!o) throw new Error("fixture"); return o;
}
beforeEach(() => { localStorage.clear(); __resetDemoCache(); });
afterEach(() => vi.restoreAllMocks());

describe("CR-006E orders", () => {
  it("allows the forward workflow and preserves snapshots", () => {
    const original = pending(); let o = original;
    for (const status of ["em-atendimento", "confirmado", "em-producao", "pronto-para-entrega", "enviado", "concluido"] as const) o = changeOrderStatus(o, status, at);
    expect(o.history).toHaveLength(7); expect(o.items).toEqual(original.items);
    expect(orderTotal(o)).toBe(12990); expect(validOrderUpdates([original], [o])).toBe(true);
  });
  it("allows direct confirmation and ready-stock fulfilment without production", () => {
    const o = changeOrderStatus(pending(), "confirmado", at);
    expect(changeOrderStatus(o, "concluido", at).status).toBe("concluido");
  });
  it("rejects every transition outside the explicit matrix", () => {
    const states: OrderStatus[] = ["aguardando-contato", "em-atendimento", "confirmado", "em-producao", "pronto-para-entrega", "enviado", "concluido", "cancelado"];
    const matrix: Record<OrderStatus, OrderStatus[]> = {
      "aguardando-contato": ["em-atendimento", "confirmado", "cancelado"], "em-atendimento": ["confirmado", "cancelado"],
      confirmado: ["em-producao", "pronto-para-entrega", "enviado", "concluido", "cancelado"], "em-producao": ["pronto-para-entrega", "cancelado"],
      "pronto-para-entrega": ["enviado", "concluido", "cancelado"], enviado: ["concluido", "cancelado"], concluido: [], cancelado: [],
    };
    for (const from of states) for (const to of states) expect(canChangeOrderStatus(from, to)).toBe(matrix[from].includes(to));
  });
  it("makes cancelled orders terminal", () => {
    const cancelled = changeOrderStatus(pending(), "cancelado", at);
    expect(allowedOrderStatuses("cancelado")).toEqual([]);
    expect(() => changeOrderStatus(cancelled, "confirmado", at)).toThrow();
    expect(cancelled.history.at(-1)).toMatchObject({ from: "aguardando-contato", to: "cancelado" });
  });
  it("makes completed orders terminal", () => {
    const o = changeOrderStatus(changeOrderStatus(pending(), "confirmado", at), "concluido", at);
    expect(() => changeOrderStatus(o, "cancelado", at)).toThrow();
  });
  it("rejects payment before confirmation", () => {
    expect(() => changeOrderPayment(pending(), true, at)).toThrow();
    expect(() => changeOrderPayment(changeOrderStatus(pending(), "em-atendimento", at), true, at)).toThrow();
  });
  it("records payment and its correction without changing the total", () => {
    const o = changeOrderStatus(pending(), "confirmado", at);
    const paid = changeOrderPayment(o, true, at);
    expect(paid.history.at(-1)?.paymentReceived).toBe(true);
    const corrected = changeOrderPayment(paid, false, at);
    expect(corrected.paymentReceived).toBe(false); expect(orderTotal(corrected)).toBe(12990);
    expect(validOrderUpdates([o], [corrected])).toBe(true);
  });
  it("preserves paid cancellation evidence without counting it as revenue", () => {
    const paid = changeOrderPayment(changeOrderStatus(pending(), "confirmado", at), true, at);
    const cancelled = changeOrderStatus(paid, "cancelado", at);
    expect(cancelled.paymentReceived).toBe(true);
    expect(() => changeOrderPayment(cancelled, false, at)).toThrow();
    expect(orderMetrics([cancelled])).toMatchObject({ cancelled: 1, confirmedRevenueCents: 0, receivedRevenueCents: 0, pendingEstimateCents: 0 });
    expect(isValidDemoData({ ...createSeed(now), orders: [cancelled] })).toBe(true);
  });
  it("rejects retroactive timestamps", () => expect(() => changeOrderStatus(pending(), "confirmado", "2020-01-01T00:00:00Z")).toThrow());
  it("rejects rewritten snapshots, removed history and direct state/payment edits at the repository", () => {
    const mutations = [
      (o: DemoOrder) => ({ ...o, shippingCents: 200 }),
      (o: DemoOrder) => ({ ...o, items: o.items.map((i) => ({ ...i, unitPriceCents: 1 })) }),
      (o: DemoOrder) => ({ ...o, paymentReceived: true }),
      (o: DemoOrder) => ({ ...o, status: "confirmado" as const, history: [...o.history, { at, from: o.status, to: "confirmado" as const }].slice(1) }),
    ];
    for (const mutate of mutations) {
      const before = structuredClone(demoRepository.get());
      expect(demoRepository.update((d) => ({ ...d, orders: d.orders.map((o, i) => i === 0 ? mutate(o) : o) }))).toBe(false);
      expect(demoRepository.get()).toEqual(before);
    }
  });
  it("rejects order creation/deletion in this demo stage", () => {
    expect(demoRepository.update((d) => ({ ...d, orders: d.orders.slice(1) }))).toBe(false);
    expect(getDemoStorageStatus().rejected).toBe(true);
  });
  it("rejects backward persisted histories and recovers independent valid orders", () => {
    const d = createSeed(now); const o = pending();
    const bad = { ...o, history: [...o.history, { at, from: o.status, to: "cancelado" }, { at, from: "cancelado", to: o.status }] };
    expect(isValidDemoData({ ...d, orders: [bad] })).toBe(false);
    const recovered = recoverDemoData({ ...d, orders: [bad, d.orders[1]] }, d);
    expect(recovered.data.orders).toHaveLength(1); expect(recovered.issues).toHaveLength(1);
  });
  it("keeps all legacy demo orders valid", () => {
    const d = createSeed(now); expect(isValidDemoData(d)).toBe(true);
    expect(recoverDemoData(d, d).issues).toEqual([]);
  });
  it("creates actionable demo orders before the fictitious display hour", () => {
    const early = new Date("2026-11-13T02:00:00Z");
    const d = createSeed(early);
    expect(d.orders.every((o) => Date.parse(o.createdAt) <= early.getTime())).toBe(true);
    const o = d.orders[0]; if (!o) throw new Error("fixture");
    expect(changeOrderStatus(o, "confirmado", early.toISOString()).status).toBe("confirmado");
  });
});

describe("CR-006E metrics and settings", () => {
  it("counts only products visible in active categories", () => {
    const d = createSeed(now); d.categories = d.categories.map((c) => ({ ...c, active: false }));
    expect(dashboardMetrics(d, now).activeProducts).toBe(0); expect(publicProducts(d)).toEqual([]);
  });
  it("uses identical totals in dashboard, reports and daily chart", () => {
    const d = createSeed(now); const m = orderMetrics(d.orders); const dashboard = dashboardMetrics(d, now);
    expect(m.pending).toBe(3); expect(m.confirmed).toBe(9); expect(m.completed).toBe(4); expect(m.cancelled).toBe(2);
    expect(dashboard.confirmedRevenueCents).toBe(m.confirmedRevenueCents);
    expect(dashboard.receivedRevenueCents).toBe(m.receivedRevenueCents);
    expect(dashboard.pendingEstimateCents).toBe(m.pendingEstimateCents);
    expect(ordersByDay(d.orders, 30, now).reduce((s, day) => s + day.confirmedCents, 0)).toBe(m.confirmedRevenueCents);
    d.customRequests = d.customRequests.map((r) => ({ ...r, quoteCents: 999999 }));
    expect(dashboardMetrics(d, now).confirmedRevenueCents).toBe(m.confirmedRevenueCents);
  });
  it("keeps pending estimates separate from confirmed and received totals", () => {
    expect(orderMetrics([pending()])).toMatchObject({ pending: 1, pendingEstimateCents: 12990, confirmedRevenueCents: 0, receivedRevenueCents: 0 });
  });
  it("ignores contradictory unconfirmed paid input in revenue calculations", () => {
    const o = { ...pending(), paymentReceived: true };
    expect(orderMetrics([o]).receivedRevenueCents).toBe(0);
    expect(isValidDemoData({ ...createSeed(now), orders: [o] })).toBe(false);
  });
  it("prevents physical stock adjustments on made-to-order products", () => {
    const p = createSeed(now).products.find((p) => p.availability === "sob-demanda"); if (!p) throw new Error("fixture");
    expect(() => adjustProductStock(p, 5)).toThrow();
    const stock = { ...p, availability: "pronta-entrega" as const };
    expect(adjustProductStock(stock, 5).stock).toBe(5);
    expect(() => adjustProductStock(stock, 1.5)).toThrow();
  });
  it("reports settings failures and persists the logo on retry and reload", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
    expect(demoRepository.update((d) => ({ ...d, settings: { ...d.settings, logo: "/logo.svg" } }))).toBe(false);
    expect(getDemoStorageStatus().writeError).toBe(true); spy.mockRestore();
    expect(demoRepository.update((d) => d)).toBe(true); __resetDemoCache();
    expect(demoRepository.get().settings.logo).toBe("/logo.svg");
    expect(safeUrl(demoRepository.get().settings.logo)).toBe("/logo.svg");
    expect(localStorage.getItem(DEMO_STORAGE_KEY)).toContain("/logo.svg");
  });
  it("rejects unsafe logo updates without replacing saved settings", () => {
    const before = demoRepository.get().settings;
    expect(demoRepository.update((d) => ({ ...d, settings: { ...d.settings, logo: "javascript:alert(1)" } }))).toBe(false);
    expect(demoRepository.get().settings).toEqual(before);
  });
});