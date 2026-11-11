// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { createSeed } from "@/features/demo-data/seed";
import { DEMO_STORAGE_KEY, __resetDemoCache, demoRepository } from "@/features/demo-data/repository";
import { dashboardMetrics, publicProducts } from "@/features/demo-data/rules";
import { reconcileCart, purchasableItems, applyReconciliation } from "@/features/cart/cart.reconcile";
import { isCartItem } from "@/features/cart/cart.logic";
import { buildOrderMessage } from "@/features/checkout/checkout.logic";
import type { CartItem } from "@/shared/types/cart";

const seed = createSeed(new Date("2026-11-10T15:00:00"));
const prod = publicProducts(seed).find((p) => p.availability !== "indisponivel" && !p.promoPriceCents && p.variants.length === 0) ?? publicProducts(seed)[0]!;
const item = (over: Partial<CartItem> = {}): CartItem => ({ key: prod.id, productId: prod.id, name: prod.name, unitPriceCents: prod.priceCents, quantity: 2, variants: {}, ...over });

describe("carrinho x catálogo", () => {
  it("price change: checkout uses the current price and flags it", () => {
    const data = { ...seed, products: seed.products.map((p) => (p.id === prod.id ? (({ promoPriceCents: _x, ...rest }) => ({ ...rest, priceCents: 9990 }))(p) : p)) };
    const [line] = reconcileCart([item({ unitPriceCents: 5000 })], publicProducts(data));
    expect(line!.status).toBe("price-changed");
    expect(line!.item.unitPriceCents).toBe(9990);
    expect(line!.previousUnitCents).toBe(5000);
  });
  it("deactivated product blocks checkout and is dropped on update", () => {
    const data = { ...seed, products: seed.products.map((p) => (p.id === prod.id ? { ...p, active: false } : p)) };
    const lines = reconcileCart([item()], publicProducts(data));
    expect(lines[0]!.status).toBe("removed");
    expect(purchasableItems(lines)).toHaveLength(0);
    expect(applyReconciliation(lines)).toEqual([]);
  });
  it("ready-stock item with zero stock is unavailable", () => {
    const data = { ...seed, products: seed.products.map((p) => (p.id === prod.id ? { ...p, availability: "pronta-entrega" as const, stock: 0 } : p)) };
    expect(reconcileCart([item()], publicProducts(data))[0]!.status).toBe("unavailable");
  });
  it("made-to-order item with zero stock stays purchasable", () => {
    const data = { ...seed, products: seed.products.map((p) => (p.id === prod.id ? { ...p, availability: "sob-demanda" as const, stock: 0, productionDays: 5 } : p)) };
    expect(reconcileCart([item()], publicProducts(data))[0]!.status).toBe("ok");
  });
  it("removed variant option makes the line unavailable", () => {
    expect(reconcileCart([item({ variants: { Cor: "Inexistente" } })], publicProducts(seed))[0]!.status).toBe("unavailable");
  });
  it("rejects corrupted cart entries", () => {
    expect(isCartItem(item())).toBe(true);
    expect(isCartItem({ key: "x", quantity: -1 })).toBe(false);
  });
  it("WhatsApp message uses current reconciled prices", () => {
    const msg = buildOrderMessage([item({ unitPriceCents: 1234, quantity: 3 })], { name: "Fulano Teste", phone: "21999999999", notes: "" });
    expect(msg).toMatch(/Valor unitário: R\$\s12,34/);
    expect(msg).toMatch(/TOTAL ESTIMADO: R\$\s37,02/);
    expect(msg).toContain("Frete: A combinar.");
  });
});

describe("repositório compartilhado", () => {
  beforeEach(() => { localStorage.clear(); __resetDemoCache(); });
  it("admin edit is visible to the store and persisted", () => {
    demoRepository.update((d) => ({ ...d, products: d.products.map((p) => (p.id === prod.id ? { ...p, name: "Nome Editado" } : p)) }));
    expect(publicProducts(demoRepository.get()).find((p) => p.id === prod.id)?.name).toBe("Nome Editado");
    __resetDemoCache();
    expect(demoRepository.get().products.find((p) => p.id === prod.id)?.name).toBe("Nome Editado");
  });
  it("shared settings are read from the same source", () => {
    demoRepository.update((d) => ({ ...d, settings: { ...d.settings, name: "Loja X" } }));
    expect(demoRepository.get().settings.name).toBe("Loja X");
  });
  it("corrupted storage falls back to the seed; reset restores it", () => {
    localStorage.setItem(DEMO_STORAGE_KEY, "{broken");
    expect(demoRepository.get().products.length).toBe(seed.products.length);
    demoRepository.update((d) => ({ ...d, products: [] }));
    demoRepository.reset();
    expect(demoRepository.get().products.length).toBe(seed.products.length);
  });
  it("no personal checkout data is stored", () => {
    demoRepository.update((d) => d);
    const all = Object.keys(localStorage).map((k) => localStorage.getItem(k)).join(" ");
    expect(all).not.toMatch(/Fulano Teste/);
  });
  it("deleting a product keeps order snapshots and pending orders are not revenue", () => {
    const before = demoRepository.get().orders.map((o) => o.items.map((i) => i.name).join());
    demoRepository.update((d) => ({ ...d, products: d.products.slice(1) }));
    expect(demoRepository.get().orders.map((o) => o.items.map((i) => i.name).join())).toEqual(before);
    const d = demoRepository.get();
    const pending = { ...d, orders: d.orders.map((o) => ({ ...o, status: "aguardando-contato" as const })) };
    expect(dashboardMetrics(pending, new Date("2026-11-10T15:00:00")).confirmedRevenueCents).toBe(0);
  });
});
