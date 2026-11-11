import { beforeEach, describe, expect, it } from "vitest";
import { createSeed } from "@/features/demo-data/seed";
import {
  changeOrderStatus, couponState, dashboardMetrics, deleteCategory, effectiveAvailability, effectivePriceCents,
  publicProducts, stockState, validateCoupon, validateProduct, validateSettings,
} from "@/features/demo-data/rules";
import { DEMO_STORAGE_KEY, __resetDemoCache, demoRepository } from "@/features/demo-data/repository";
import { parseMoney } from "@/features/admin/ui/AdminUI";

const now = new Date("2026-11-10T15:00:00");

describe("produtos", () => {
  const d = createSeed(now);
  const base = d.products[0]!;
  it("promo price must be lower than regular price", () => {
    expect(validateProduct({ ...base, promoPriceCents: base.priceCents }, d.products, d.categories).promoPriceCents).toBeDefined();
    expect(validateProduct({ ...base, promoPriceCents: base.priceCents - 1 }, d.products, d.categories).promoPriceCents).toBeUndefined();
    expect(effectivePriceCents({ priceCents: 1000, promoPriceCents: 800 })).toBe(800);
  });
  it("slug must be unique", () => {
    expect(validateProduct({ ...base, id: "new", slug: d.products[1]!.slug }, d.products, d.categories).slug).toBe("Já existe um produto com este slug.");
  });
  it("made-to-order needs production days", () => {
    const { productionDays: _p, ...rest } = base;
    expect(validateProduct({ ...rest, availability: "sob-demanda" }, d.products, d.categories).productionDays).toBeDefined();
  });
  it("inactive products are hidden from the store", () => {
    const data = { ...d, products: d.products.map((p) => (p.id === "p01" ? { ...p, active: false } : p)) };
    expect(publicProducts(data).some((p) => p.id === "p01")).toBe(false);
  });
  it("zero stock: ready-stock becomes unavailable, made-to-order stays available", () => {
    expect(effectiveAvailability({ availability: "pronta-entrega", stock: 0 })).toBe("indisponivel");
    expect(effectiveAvailability({ availability: "sob-demanda", stock: 0 })).toBe("sob-demanda");
    expect(stockState({ availability: "pronta-entrega", stock: 5 })).toBe("baixo");
  });
});

describe("categorias", () => {
  it("cannot delete a category with products unless they are moved", () => {
    const d = createSeed(now);
    expect(() => deleteCategory(d, "presentes")).toThrow();
    const next = deleteCategory(d, "presentes", "decoracao");
    expect(next.categories.some((c) => c.slug === "presentes")).toBe(false);
    expect(next.products.filter((p) => p.category === "presentes")).toHaveLength(0);
    expect(next.products).toHaveLength(d.products.length);
  });
});

describe("pedidos e métricas", () => {
  it("status change is recorded in history", () => {
    const o = createSeed(now).orders[0]!;
    const next = changeOrderStatus(o, "confirmado", now.toISOString());
    expect(next.history.at(-1)).toMatchObject({ from: "aguardando-contato", to: "confirmado" });
  });
  it("pending orders never count as confirmed revenue", () => {
    const d = createSeed(now);
    const before = dashboardMetrics(d, now).confirmedRevenueCents;
    const pending = { ...d, orders: [...d.orders, { ...d.orders[0]!, id: "x", status: "aguardando-contato" as const }] };
    expect(dashboardMetrics(pending, now).confirmedRevenueCents).toBe(before);
    expect(dashboardMetrics(d, now).ordersToday).toBe(3);
  });
  it("deleting a product keeps order item snapshots", () => {
    const d = createSeed(now);
    const without = { ...d, products: d.products.filter((p) => p.id !== "p01") };
    expect(without.orders[0]!.items[0]).toMatchObject({ productId: "p01", name: "Luminária Lua", unitPriceCents: 12990 });
  });
});

describe("cupons e configurações", () => {
  it("validates coupon values and dates", () => {
    const c = { id: "1", code: "OFF", kind: "percentual" as const, value: 120, startsAt: "2026-11-10", endsAt: "2026-11-01", active: true, usageLimit: null };
    const e = validateCoupon(c, []);
    expect(e.value).toBeDefined();
    expect(e.endsAt).toBeDefined();
    expect(couponState({ ...c, endsAt: "2026-12-01" }, "2026-11-09")).toBe("agendado");
  });
  it("WhatsApp must be empty or valid", () => {
    const s = createSeed(now).settings;
    expect(validateSettings(s).whatsappNumber).toBeUndefined();
    expect(validateSettings({ ...s, whatsappNumber: "1199" }).whatsappNumber).toBeDefined();
  });
  it("parses money in pt-BR", () => {
    expect(parseMoney("1.234,56")).toBe(123456);
    expect(parseMoney("12.9")).toBe(1290);
    expect(Number.isNaN(parseMoney("abc"))).toBe(true);
  });
});

describe("repositório local", () => {
  beforeEach(() => { localStorage.clear(); __resetDemoCache(); });
  it("persists versioned data and restores the demo", () => {
    demoRepository.update((d) => ({ ...d, settings: { ...d.settings, name: "Teste" } }));
    __resetDemoCache();
    expect(demoRepository.get().settings.name).toBe("Teste");
    expect(JSON.parse(localStorage.getItem(DEMO_STORAGE_KEY)!).schemaVersion).toBe(1);
    demoRepository.reset();
    expect(demoRepository.get().settings.name).toBe("Criatto 3D");
  });
  it("ignores data from another schema version", () => {
    localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify({ schemaVersion: 999, data: {} }));
    expect(demoRepository.get().products.length).toBe(18);
  });
});
