import type { CartItem } from "@/shared/types/cart";
import { normalizeCart } from "./cart.logic";

export const CART_STORAGE_KEY = "criatto3d:cart";
export interface CartSnapshot { items: CartItem[]; persistenceError: boolean }
const empty: CartSnapshot = { items: [], persistenceError: false };
let current = empty;
let initialized = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

function read(): CartItem[] {
  const raw = window.localStorage.getItem(CART_STORAGE_KEY);
  try { return normalizeCart(raw ? JSON.parse(raw) : []); } catch { return []; }
}

function refresh() {
  try { current = { items: read(), persistenceError: false }; }
  catch { current = { ...current, persistenceError: true }; }
}

let bound = false;
function bind() {
  if (bound || typeof window === "undefined") return;
  bound = true;
  window.addEventListener("storage", (event) => {
    if (event.storageArea && event.storageArea !== window.localStorage) return;
    if (event.key !== CART_STORAGE_KEY && event.key !== null) return;
    refresh();
    emit(); // Do not write back incoming events: avoids cross-tab echo loops.
  });
}

export const cartRepository = {
  get(): CartSnapshot {
    if (typeof window === "undefined") return empty;
    bind();
    if (!initialized) { initialized = true; refresh(); }
    return current;
  },
  serverSnapshot: () => empty,
  latest(): CartSnapshot {
    this.get();
    const previous = current;
    if (!current.persistenceError) refresh();
    if (JSON.stringify(previous) !== JSON.stringify(current)) emit();
    else current = previous;
    return current;
  },
  subscribe(listener: () => void) {
    bind(); listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
  update(change: (items: CartItem[]) => CartItem[]): CartItem[] {
    this.get();
    // Read the latest shared snapshot before every mutation, not a stale component closure.
    if (!current.persistenceError) refresh();
    const items = normalizeCart(change(current.items));
    let persistenceError = false;
    try { window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items)); }
    catch { persistenceError = true; }
    current = { items, persistenceError };
    emit();
    return items;
  },
};

export function __resetCartCache() { current = empty; initialized = false; }