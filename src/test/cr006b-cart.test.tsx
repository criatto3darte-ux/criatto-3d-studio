import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CartProvider, useCart } from "@/features/cart/CartContext";
import { addItem, buildCartKey, normalizeCart, subtotalCents } from "@/features/cart/cart.logic";
import { availableQuantity } from "@/features/cart/cart.stock";
import { applyReconciliation, isBlocking, purchasableItems, reconcileCart } from "@/features/cart/cart.reconcile";
import { CART_STORAGE_KEY, __resetCartCache, cartRepository } from "@/features/cart/cart.repository";
import { __resetDemoCache, demoRepository } from "@/features/demo-data/repository";
import { publicProducts } from "@/features/demo-data/rules";
import { buildOrderMessage } from "@/features/checkout/checkout.logic";
import type { CartItem } from "@/shared/types/cart";
import type { Product } from "@/shared/types/catalog";

let cart: ReturnType<typeof useCart> | undefined;
function Probe() { cart = useCart(); return <output>{cart.count}</output>; }
function mountedCart() { if (!cart) throw new Error("Cart not mounted"); return cart; }
function product(over: Partial<Product> = {}): Product {
  const base = publicProducts(demoRepository.get())[0];
  if (!base) throw new Error("Missing fixture");
  return { ...base, stock: 10, variants: [{ id: "cor", name: "Cor", options: [{ id: "a", label: "Branco" }, { id: "b", label: "Preto" }] }], ...over };
}
function line(p: Product, quantity: number, color = "Branco"): CartItem {
  const variants = { Cor: color };
  return { key: buildCartKey(p.id, variants), productId: p.id, name: p.name, unitPriceCents: p.priceCents, quantity, variants };
}
function install(p: Product) { demoRepository.update((d) => ({ ...d, products: d.products.map((x) => x.id === p.id ? p : x) })); }

beforeEach(() => { localStorage.clear(); __resetCartCache(); __resetDemoCache(); cart = undefined; });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("CR-006B stock", () => {
  it("rejects adding five units to stock one, including the mutation boundary", () => {
    const p = product({ stock: 1 }); install(p);
    render(<CartProvider><Probe /></CartProvider>);
    act(() => { expect(mountedCart().add(line(p, 5))).toBe(false); });
    expect(mountedCart().items).toEqual([]);
    act(() => { expect(mountedCart().add(line(p, 1))).toBe(true); });
    act(() => { expect(mountedCart().add(line(p, 1))).toBe(false); });
    expect(mountedCart().count).toBe(1);
  });
  it("shares ten units between variations and limits quantity edits", () => {
    const p = product(); install(p);
    render(<CartProvider><Probe /></CartProvider>);
    act(() => { mountedCart().add(line(p, 6)); mountedCart().add(line(p, 4, "Preto")); });
    expect(mountedCart().count).toBe(10);
    act(() => { expect(mountedCart().add(line(p, 1, "Preto"))).toBe(false); mountedCart().setQuantity(line(p, 1).key, 9); });
    expect(mountedCart().items.map((x) => x.quantity)).toEqual([6, 4]);
    expect(availableQuantity(mountedCart().items, p)).toBe(0);
  });
  it("blocks reduced shared stock and explicitly adjusts without losing variations or promotion", () => {
    const p = product({ stock: 3, promoPriceCents: 1000 });
    const lines = reconcileCart([line(p, 2), line(p, 4, "Preto")], [p]);
    expect(lines.every(isBlocking)).toBe(true);
    expect(purchasableItems(lines)).toEqual([]);
    const adjusted = applyReconciliation(lines);
    expect(adjusted.map((x) => [x.quantity, x.variants.Cor])).toEqual([[2, "Branco"], [1, "Preto"]]);
    expect(subtotalCents(adjusted)).toBe(3000);
    expect(reconcileCart(adjusted, [p]).some(isBlocking)).toBe(false);
    expect(p.stock).toBe(3); // No reservation or deduction.
  });
  it("blocks unavailable products and removes them only when updating", () => {
    const p = product({ availability: "indisponivel" });
    const lines = reconcileCart([line(p, 2)], [p]);
    expect(lines[0]?.status).toBe("unavailable");
    expect(lines[0]?.item.quantity).toBe(2);
    expect(applyReconciliation(lines)).toEqual([]);
  });
  it("does not apply physical stock to made-to-order products", () => {
    const p = product({ stock: 0, availability: "sob-demanda", productionDays: 5 }); install(p);
    render(<CartProvider><Probe /></CartProvider>);
    act(() => { expect(mountedCart().add(line(p, 5))).toBe(true); expect(mountedCart().add(line(p, 10, "Preto"))).toBe(true); });
    expect(mountedCart().count).toBe(15);
    expect(reconcileCart(mountedCart().items, [p]).some(isBlocking)).toBe(false);
  });
  it("rechecks stock and availability and builds WhatsApp with current promotional prices", () => {
    const p = product({ promoPriceCents: 1200 });
    const items = purchasableItems(reconcileCart([line(p, 2)], [p]));
    const message = buildOrderMessage(items, { name: "Pessoa Ficticia", phone: "00999999999", notes: "" });
    expect(message).toMatch(/TOTAL ESTIMADO: R\$\s24,00/);
    expect(reconcileCart(items, [{ ...p, stock: 1 }]).some(isBlocking)).toBe(true);
    expect(reconcileCart(items, [{ ...p, availability: "indisponivel" }]).some(isBlocking)).toBe(true);
  });
});

describe("CR-006B persistence", () => {
  it("sanitizes malformed entries, repairs legacy keys and merges duplicates", () => {
    const item = line(product(), 2);
    const bad = [null, { ...item, quantity: 1.5 }, { ...item, unitPriceCents: -1 }, { ...item, variants: [] }, { ...item, variants: { Cor: 7 } }];
    const items = normalizeCart([...bad, { ...item, key: "wrong", image: 7 }, { ...item, key: "duplicate" }]);
    expect(items).toHaveLength(1);
    expect(items[0]?.key).toBe(item.key);
    expect(items[0]?.quantity).toBe(4);
    expect(items[0]?.image).toBeUndefined();
    expect(normalizeCart({ bad: true })).toEqual([]);
    expect(addItem([], { ...item, quantity: NaN })).toEqual([]);
  });
  it("loads corrupt JSON without crashing and does not overwrite storage during hydration", () => {
    localStorage.setItem(CART_STORAGE_KEY, "{bad");
    const spy = vi.spyOn(Storage.prototype, "setItem");
    render(<CartProvider><Probe /></CartProvider>);
    expect(screen.getByText("0")).toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();
  });
  it("reads the latest tab before mutating and propagates incoming changes without echo writes", () => {
    const p = product(); install(p);
    render(<CartProvider><Probe /></CartProvider>);
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify([line(p, 3)]));
    act(() => { mountedCart().add(line(p, 2, "Preto")); });
    expect(mountedCart().count).toBe(5);
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify([line(p, 1)]));
    const spy = vi.spyOn(Storage.prototype, "setItem");
    act(() => { window.dispatchEvent(new StorageEvent("storage", { key: CART_STORAGE_KEY, storageArea: localStorage })); });
    expect(mountedCart().count).toBe(1);
    expect(spy).not.toHaveBeenCalled();
    localStorage.removeItem(CART_STORAGE_KEY);
    act(() => { window.dispatchEvent(new StorageEvent("storage", { key: CART_STORAGE_KEY })); });
    expect(mountedCart().count).toBe(0);
  });
  it("keeps memory and exposes failure when persistence is unavailable", () => {
    const item = line(product(), 2);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Quota", "QuotaExceededError"); });
    expect(() => cartRepository.update(() => [item])).not.toThrow();
    expect(cartRepository.get().items[0]?.quantity).toBe(2);
    expect(cartRepository.get().persistenceError).toBe(true);
    cartRepository.update((items) => addItem(items, item));
    expect(cartRepository.get().items[0]?.quantity).toBe(4);
  });
  it("refreshes a checkout snapshot even before the other tab storage event arrives", () => {
    const item = line(product(), 1);
    cartRepository.update(() => [item]);
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify([{ ...item, quantity: 5 }]));
    expect(cartRepository.latest().items[0]?.quantity).toBe(5);
  });
});