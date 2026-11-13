import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { createSeed } from "@/features/demo-data/seed";
import { isDemoData, validateBanner, validateProduct, validateSettings } from "@/features/demo-data/rules";
import { recoverDemoData } from "@/features/demo-data/validation";
import { __resetDemoCache, acceptRecoveredDemoData, DEMO_STORAGE_KEY, demoRepository, getDemoStorageStatus } from "@/features/demo-data/repository";
import { safeUrl, safeSocialUrl } from "@/shared/utils/safe-url";

const envelope = (data: unknown) => JSON.stringify({ schemaVersion: 1, savedAt: "2026-11-13T01:48:00.000Z", data });
beforeEach(() => { localStorage.clear(); __resetDemoCache(); });
afterEach(() => { vi.restoreAllMocks(); });

describe("CR-006D structural integrity", () => {
  it("accepts all valid demo collections", () => { expect(isDemoData(createSeed())).toBe(true); });
  it("validates every required field and type in every collection", () => {
    const seed = createSeed();
    for (const key of ["products", "categories", "orders", "customers", "customRequests", "banners", "coupons"] as const) {
      const record = seed[key][0]; if (!record) throw new Error("missing fixture");
      for (const field of Object.keys(record)) {
        const changed = { ...record, [field]: { invalid: true } };
        expect(isDemoData({ ...seed, [key]: [changed] }), `${key}.${field}`).toBe(false);
        const missing = { ...record } as Record<string, unknown>; delete missing[field];
        if (!["promoPriceCents", "badge", "productionDays", "image"].includes(field)) expect(isDemoData({ ...seed, [key]: [missing] }), `${key}.${field} missing`).toBe(false);
      }
    }
    for (const key of Object.keys(seed.settings)) expect(isDemoData({ ...seed, settings: { ...seed.settings, [key]: null } }), `settings.${key}`).toBe(false);
  });
  it("rejects malformed nested variants and history", () => {
    const d = createSeed(); const p = d.products[0]; const o = d.orders[0]; if (!p || !o) throw new Error("fixture");
    expect(isDemoData({ ...d, products: [{ ...p, variants: [{ id: "x", name: "Cor", options: [null] }] }] })).toBe(false);
    expect(isDemoData({ ...d, orders: [{ ...o, history: [{ at: "bad", to: "unknown" }] }] })).toBe(false);
    expect(isDemoData({ ...d, orders: [{ ...o, items: [{ ...o.items[0], quantity: -1 }] }] })).toBe(false);
  });
  it("preserves valid records and settings while removing invalid references and duplicates", () => {
    const d = createSeed(); const p = d.products[0]; if (!p) throw new Error("fixture");
    const recovered = recoverDemoData({ ...d, products: [p, p, { ...p, id: "orphan", slug: "orphan", category: "missing" }, null], settings: { ...d.settings, name: "Minha loja", instagram: "javascript:alert(1)" } }, d);
    expect(recovered.data.products).toHaveLength(1);
    expect(recovered.data.products[0]?.id).toBe(p.id);
    expect(recovered.data.settings.name).toBe("Minha loja");
    expect(recovered.data.settings.instagram).toBe("");
    expect(recovered.issues.length).toBeGreaterThan(0);
    expect(isDemoData(recovered.data)).toBe(true);
  });
  it("does not seed missing collections during partial recovery", () => {
    const result = recoverDemoData({ settings: createSeed().settings }, createSeed());
    expect(result.data.products).toEqual([]); expect(result.issues).toHaveLength(7);
  });
  it("rejects inconsistent prices, dates, statuses and references", () => {
    const d = createSeed(); const p = d.products[0]; const c = d.coupons[0]; if (!p || !c) throw new Error("fixture");
    expect(isDemoData({ ...d, products: [{ ...p, priceCents: NaN }] })).toBe(false);
    expect(isDemoData({ ...d, products: [{ ...p, promoPriceCents: p.priceCents }] })).toBe(false);
    expect(isDemoData({ ...d, coupons: [{ ...c, startsAt: "2026-02-30" }] })).toBe(false);
    expect(isDemoData({ ...d, customers: [] })).toBe(false);
  });
});

describe("CR-006D URL allowlist", () => {
  it("allows HTTPS and root-relative links", () => {
    for (const url of ["/produtos?categoria=decoracao#lista", "/images/photo.jpg", "https://example.com/photo.jpg"]) expect(safeUrl(url)).toBe(url);
  });
  it.each(["javascript:alert(1)", "data:image/svg+xml,test", "blob:https://example.com/id", "http://example.com", "ftp://example.com", "mailto:test@example.com"])("rejects forbidden protocol %s", (url) => expect(safeUrl(url)).toBeUndefined());
  it.each(["//evil.com", "/\\evil.com", "/%2fevil.com", "/%5cevil.com", "/%252fevil.com", "/%0aevil.com", " https://evil.com", "https://user:pass@evil.com", "https://", "/bad%"])("rejects ambiguous URL %s", (url) => expect(safeUrl(url)).toBeUndefined());
  it("applies the same protection before saving products, banners and settings", () => {
    const d = createSeed(); const p = d.products[0]; const b = d.banners[0]; if (!p || !b) throw new Error("fixture");
    expect(validateProduct({ ...p, images: ["//evil.com"] }, d.products, d.categories).images).toBeDefined();
    expect(validateBanner({ ...b, buttonUrl: "//evil.com", image: "javascript:alert(1)" })).toHaveProperty("buttonUrl");
    expect(validateSettings({ ...d.settings, logo: "//evil.com" }).logo).toBeDefined();
    expect(safeSocialUrl("https://instagram.com.evil.com/person", "instagram")).toBeUndefined();
    expect(safeSocialUrl("https://instagram.com/person", "instagram")).toBe("https://instagram.com/person");
  });
});

describe("CR-006D repository failures and recovery", () => {
  it("keeps corrupt JSON untouched and blocks writes pending explicit approval", () => {
    localStorage.setItem(DEMO_STORAGE_KEY, "{broken"); demoRepository.get();
    expect(getDemoStorageStatus().recoveryRequired).toBe(true);
    expect(demoRepository.update((d) => ({ ...d, settings: { ...d.settings, name: "Nova" } }))).toBe(false);
    expect(localStorage.getItem(DEMO_STORAGE_KEY)).toBe("{broken");
    acceptRecoveredDemoData();
    expect(demoRepository.update((d) => ({ ...d, settings: { ...d.settings, name: "Nova" } }))).toBe(true);
    __resetDemoCache(); expect(demoRepository.get().settings.name).toBe("Nova");
  });
  it("handles read failure without losing in-memory data", () => {
    demoRepository.update((d) => ({ ...d, settings: { ...d.settings, name: "Preservada" } }));
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("denied"); });
    window.dispatchEvent(new StorageEvent("storage", { key: DEMO_STORAGE_KEY }));
    expect(demoRepository.get().settings.name).toBe("Preservada"); expect(getDemoStorageStatus().readError).toBe(true);
  });
  it("reports write failures and retries the in-memory draft without false success", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
    expect(demoRepository.update((d) => ({ ...d, settings: { ...d.settings, name: "Rascunho" } }))).toBe(false);
    expect(getDemoStorageStatus().writeError).toBe(true); expect(demoRepository.get().settings.name).toBe("Rascunho");
    spy.mockRestore();
    expect(demoRepository.update((d) => ({ ...d, settings: { ...d.settings, address: "Endereço" } }))).toBe(true);
    __resetDemoCache(); expect(demoRepository.get().settings.name).toBe("Rascunho");
  });
  it("rejects invalid programmatic writes without changing valid data", () => {
    const d = demoRepository.get();
    expect(demoRepository.update((data) => ({ ...data, banners: [{ ...data.banners[0], buttonUrl: "javascript:alert(1)" }] } as typeof data))).toBe(false);
    expect(demoRepository.get()).toEqual(d); expect(getDemoStorageStatus().rejected).toBe(true);
  });
  it("isolates mutating callbacks before validation", () => {
    const original = structuredClone(demoRepository.get());
    expect(demoRepository.update((d) => { d.settings.name = ""; return d; })).toBe(false);
    expect(demoRepository.get()).toEqual(original);
  });
  it("preserves a failed-write draft during incoming changes until explicit approval", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
    demoRepository.update((d) => ({ ...d, settings: { ...d.settings, name: "Meu rascunho" } }));
    spy.mockRestore();
    localStorage.setItem(DEMO_STORAGE_KEY, envelope(createSeed()));
    window.dispatchEvent(new StorageEvent("storage", { key: DEMO_STORAGE_KEY }));
    expect(demoRepository.get().settings.name).toBe("Meu rascunho");
    expect(getDemoStorageStatus().recoveryRequired).toBe(true);
    expect(demoRepository.update((d) => d)).toBe(false);
    acceptRecoveredDemoData(); expect(demoRepository.update((d) => d)).toBe(true);
    __resetDemoCache(); expect(demoRepository.get().settings.name).toBe("Meu rascunho");
  });
  it("synchronizes safe incoming data without echo writes and merges latest updates", () => {
    demoRepository.get(); const d = createSeed(); d.settings.name = "Outra aba";
    localStorage.setItem(DEMO_STORAGE_KEY, envelope(d));
    const spy = vi.spyOn(Storage.prototype, "setItem");
    window.dispatchEvent(new StorageEvent("storage", { key: DEMO_STORAGE_KEY }));
    expect(demoRepository.get().settings.name).toBe("Outra aba"); expect(spy).not.toHaveBeenCalled();
    const changed = { ...d, settings: { ...d.settings, name: "Mais recente" } }; localStorage.setItem(DEMO_STORAGE_KEY, envelope(changed));
    demoRepository.update((data) => ({ ...data, settings: { ...data.settings, address: "Aqui" } }));
    expect(demoRepository.get().settings.name).toBe("Mais recente");
  });
});