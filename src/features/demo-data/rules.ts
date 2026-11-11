import type { Category, Product, ProductAvailability } from "@/shared/types/catalog";
import { isConfirmedSale, type OrderStatus } from "@/shared/types/order";
import { isValidBusinessNumber } from "@/features/checkout/checkout.logic";
import type { DemoBanner, DemoCoupon, DemoData, DemoOrder, StoreSettings } from "./model";

export const LOW_STOCK_THRESHOLD = 5;
export type Errors = Record<string, string>;

export function slugify(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function newId(prefix: string): string {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/* ---------- Produtos ---------- */

export function effectivePriceCents(p: Pick<Product, "priceCents" | "promoPriceCents">): number {
  return p.promoPriceCents && p.promoPriceCents > 0 && p.promoPriceCents < p.priceCents ? p.promoPriceCents : p.priceCents;
}

/** Ready-stock items with zero units are unavailable; made-to-order items are not affected by stock. */
export function effectiveAvailability(p: Pick<Product, "availability" | "stock">): ProductAvailability {
  if (p.availability === "pronta-entrega" && p.stock <= 0) return "indisponivel";
  return p.availability;
}

export type StockState = "sob-demanda" | "esgotado" | "baixo" | "ok" | "indisponivel";
export function stockState(p: Pick<Product, "availability" | "stock">): StockState {
  if (p.availability === "sob-demanda") return "sob-demanda";
  if (p.availability === "indisponivel") return "indisponivel";
  if (p.stock <= 0) return "esgotado";
  if (p.stock <= LOW_STOCK_THRESHOLD) return "baixo";
  return "ok";
}

export function validateProduct(p: Product, all: Product[], categories: Category[]): Errors {
  const e: Errors = {};
  if (p.name.trim().length < 2) e.name = "Informe o nome (mínimo 2 caracteres).";
  if (p.name.length > 100) e.name = "Use até 100 caracteres.";
  if (!SLUG_RE.test(p.slug)) e.slug = "Use letras minúsculas, números e hífens.";
  else if (all.some((o) => o.slug === p.slug && o.id !== p.id)) e.slug = "Já existe um produto com este slug.";
  if (!categories.some((c) => c.slug === p.category)) e.category = "Escolha uma categoria existente.";
  if (!Number.isInteger(p.priceCents) || p.priceCents <= 0) e.priceCents = "Informe um preço maior que zero.";
  if (p.promoPriceCents !== undefined) {
    if (!Number.isInteger(p.promoPriceCents) || p.promoPriceCents <= 0) e.promoPriceCents = "Preço promocional inválido.";
    else if (p.promoPriceCents >= p.priceCents) e.promoPriceCents = "O preço promocional deve ser menor que o preço normal.";
  }
  if (!Number.isInteger(p.stock) || p.stock < 0) e.stock = "O estoque deve ser um número inteiro maior ou igual a zero.";
  if (p.availability === "sob-demanda" && (!p.productionDays || p.productionDays < 1 || !Number.isInteger(p.productionDays)))
    e.productionDays = "Produtos sob encomenda precisam de prazo de produção (dias úteis).";
  if (p.description.length > 1000) e.description = "Use até 1000 caracteres.";
  if (p.images.some((src) => src.startsWith("blob:") || src.startsWith("data:"))) e.images = "Imagens locais temporárias não podem ser salvas.";
  return e;
}

/* ---------- Categorias ---------- */

export function validateCategory(c: Category, all: Category[], originalSlug?: string): Errors {
  const e: Errors = {};
  if (c.name.trim().length < 2) e.name = "Informe o nome da categoria.";
  if (!SLUG_RE.test(c.slug)) e.slug = "Use letras minúsculas, números e hífens.";
  else if (all.some((o) => o.slug === c.slug && o.slug !== originalSlug)) e.slug = "Já existe uma categoria com este slug.";
  if (!Number.isInteger(c.order) || c.order < 0) e.order = "Ordem deve ser um inteiro positivo.";
  return e;
}

export function sortedCategories(list: Category[]): Category[] {
  return [...list].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "pt-BR"));
}

/** Removes a category; products must be moved first unless a destination is given. */
export function deleteCategory(data: DemoData, slug: string, moveTo?: string): DemoData {
  const linked = data.products.filter((p) => p.category === slug);
  if (linked.length && (!moveTo || moveTo === slug || !data.categories.some((c) => c.slug === moveTo)))
    throw new Error("Categoria possui produtos vinculados. Escolha outra categoria para transferi-los.");
  return {
    ...data,
    products: data.products.map((p) => (p.category === slug && moveTo ? { ...p, category: moveTo } : p)),
    categories: data.categories.filter((c) => c.slug !== slug),
  };
}

/* ---------- Loja pública ---------- */

export function publicCategories(data: DemoData): Category[] {
  return sortedCategories(data.categories.filter((c) => c.active));
}

export function publicProducts(data: DemoData): Product[] {
  const visible = new Set(publicCategories(data).map((c) => c.slug));
  return data.products
    .filter((p) => p.active && visible.has(p.category))
    .map((p) => ({ ...p, availability: effectiveAvailability(p) }));
}

/* ---------- Pedidos ---------- */

export function orderSubtotal(o: DemoOrder): number {
  return o.items.reduce((s, i) => s + i.unitPriceCents * i.quantity, 0);
}
export function orderTotal(o: DemoOrder): number {
  return orderSubtotal(o) + o.shippingCents;
}

export function changeOrderStatus(o: DemoOrder, to: OrderStatus, at: string, note?: string): DemoOrder {
  if (o.status === to) return o;
  return { ...o, status: to, history: [...o.history, { at, from: o.status, to, ...(note ? { note } : {}) }] };
}

function sameDay(iso: string, ref: Date): boolean {
  const d = new Date(iso);
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth() && d.getDate() === ref.getDate();
}

export interface DashboardMetrics {
  ordersToday: number;
  awaitingContact: number;
  confirmed: number;
  inProduction: number;
  activeProducts: number;
  lowStock: number;
  customers: number;
  /** Sum of orders in confirmed statuses — never includes pending orders. */
  confirmedRevenueCents: number;
  /** Payment actually received. */
  receivedRevenueCents: number;
  /** Open (not cancelled, not yet confirmed) orders: estimate only. */
  pendingEstimateCents: number;
}

export function dashboardMetrics(data: DemoData, now = new Date()): DashboardMetrics {
  const o = data.orders;
  return {
    ordersToday: o.filter((x) => sameDay(x.createdAt, now)).length,
    awaitingContact: o.filter((x) => x.status === "aguardando-contato").length,
    confirmed: o.filter((x) => isConfirmedSale(x.status)).length,
    inProduction: o.filter((x) => x.status === "em-producao").length,
    activeProducts: data.products.filter((p) => p.active).length,
    lowStock: data.products.filter((p) => ["baixo", "esgotado"].includes(stockState(p))).length,
    customers: data.customers.length,
    confirmedRevenueCents: o.filter((x) => isConfirmedSale(x.status)).reduce((s, x) => s + orderTotal(x), 0),
    receivedRevenueCents: o.filter((x) => x.paymentReceived && x.status !== "cancelado").reduce((s, x) => s + orderTotal(x), 0),
    pendingEstimateCents: o.filter((x) => x.status === "aguardando-contato" || x.status === "em-atendimento").reduce((s, x) => s + orderTotal(x), 0),
  };
}

export interface DayBucket { key: string; label: string; orders: number; confirmedCents: number }

export function ordersByDay(orders: DemoOrder[], days: number, now = new Date()): DayBucket[] {
  const out: DayBucket[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const inDay = orders.filter((o) => sameDay(o.createdAt, d));
    out.push({
      key: d.toDateString(),
      label: `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`,
      orders: inDay.length,
      confirmedCents: inDay.filter((o) => isConfirmedSale(o.status)).reduce((s, o) => s + orderTotal(o), 0),
    });
  }
  return out;
}

export function ordersByStatus(orders: DemoOrder[]): Record<OrderStatus, number> {
  const out = { "aguardando-contato": 0, "em-atendimento": 0, confirmado: 0, "em-producao": 0, "pronto-para-entrega": 0, enviado: 0, concluido: 0, cancelado: 0 } as Record<OrderStatus, number>;
  for (const o of orders) out[o.status]++;
  return out;
}

/** Most requested items (by quantity) across non-cancelled orders, using order snapshots. */
export function topProducts(orders: DemoOrder[], limit = 5): { name: string; quantity: number }[] {
  const map = new Map<string, { name: string; quantity: number }>();
  for (const o of orders) {
    if (o.status === "cancelado") continue;
    for (const i of o.items) {
      const cur = map.get(i.productId) ?? { name: i.name, quantity: 0 };
      cur.quantity += i.quantity;
      map.set(i.productId, cur);
    }
  }
  return [...map.values()].sort((a, b) => b.quantity - a.quantity).slice(0, limit);
}

export function customerStats(data: DemoData, customerId: string) {
  const orders = data.orders.filter((o) => o.customerId === customerId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return {
    orders,
    count: orders.length,
    confirmedTotalCents: orders.filter((o) => isConfirmedSale(o.status)).reduce((s, o) => s + orderTotal(o), 0),
    firstPurchase: orders[0]?.createdAt ?? null,
  };
}

/* ---------- Banners, cupons e configurações ---------- */

const URL_RE = /^(\/[\w\-./?=&%#]*|https:\/\/[^\s]+)$/;
const IMG_RE = /^(\/[\w\-./%]+|https:\/\/[^\s]+)$/;

export function validateBanner(b: DemoBanner): Errors {
  const e: Errors = {};
  if (b.title.trim().length < 2) e.title = "Informe o título.";
  if (b.title.length + b.highlight.length > 80) e.title = "Título muito longo (até 80 caracteres).";
  if (b.subtitle.length > 160) e.subtitle = "Use até 160 caracteres.";
  if (!b.buttonText.trim()) e.buttonText = "Informe o texto do botão.";
  if (!URL_RE.test(b.buttonUrl)) e.buttonUrl = "Use um caminho interno (/produtos) ou um endereço https://.";
  if (b.image && !IMG_RE.test(b.image)) e.image = "Use um caminho local (/images/...) ou um endereço https://.";
  if (!Number.isInteger(b.order) || b.order < 0) e.order = "Ordem inválida.";
  return e;
}

export function activeBanner(banners: DemoBanner[]): DemoBanner | undefined {
  return [...banners].filter((b) => b.active).sort((a, b) => a.order - b.order)[0];
}

export function validateCoupon(c: DemoCoupon, all: DemoCoupon[]): Errors {
  const e: Errors = {};
  if (!/^[A-Z0-9]{3,20}$/.test(c.code)) e.code = "Use de 3 a 20 letras maiúsculas ou números.";
  else if (all.some((o) => o.code === c.code && o.id !== c.id)) e.code = "Código já existe.";
  if (!Number.isInteger(c.value) || c.value <= 0) e.value = "Informe um valor maior que zero.";
  else if (c.kind === "percentual" && c.value > 100) e.value = "O percentual deve ser de 1 a 100.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(c.startsAt)) e.startsAt = "Data inicial inválida.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(c.endsAt)) e.endsAt = "Data final inválida.";
  else if (c.endsAt < c.startsAt) e.endsAt = "A data final deve ser igual ou posterior à inicial.";
  if (c.usageLimit !== null && (!Number.isInteger(c.usageLimit) || c.usageLimit < 1)) e.usageLimit = "Limite deve ser um inteiro positivo.";
  return e;
}

export type CouponState = "ativo" | "agendado" | "expirado" | "inativo";
export function couponState(c: DemoCoupon, today: string): CouponState {
  if (!c.active) return "inativo";
  if (today < c.startsAt) return "agendado";
  if (today > c.endsAt) return "expirado";
  return "ativo";
}

export function validateSettings(s: StoreSettings): Errors {
  const e: Errors = {};
  if (s.name.trim().length < 2) e.name = "Informe o nome da loja.";
  if (s.whatsappNumber && !isValidBusinessNumber(s.whatsappNumber)) e.whatsappNumber = "Use 55 + DDD + número, só dígitos (ex.: 5511912345678).";
  if (s.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email)) e.email = "E-mail inválido.";
  if (s.instagram && !/^https:\/\/(www\.)?instagram\.com\/[\w.]+\/?$/.test(s.instagram)) e.instagram = "Use o endereço completo do perfil (https://instagram.com/...).";
  if (s.tiktok && !/^https:\/\/(www\.)?tiktok\.com\/@[\w.]+\/?$/.test(s.tiktok)) e.tiktok = "Use o endereço completo do perfil (https://tiktok.com/@...).";
  if (s.logo && !IMG_RE.test(s.logo)) e.logo = "Use um caminho local (/images/...) ou https://.";
  return e;
}

/* ---------- Validação estrutural ao carregar ---------- */

export function isDemoData(v: unknown): v is DemoData {
  if (!v || typeof v !== "object") return false;
  const d = v as Record<string, unknown>;
  const arrays = ["products", "categories", "orders", "customers", "customRequests", "banners", "coupons"];
  if (!arrays.every((k) => Array.isArray(d[k]))) return false;
  if (!d.settings || typeof d.settings !== "object") return false;
  const products = d.products as unknown[];
  return products.every((p) => !!p && typeof p === "object" && typeof (p as Product).id === "string" && typeof (p as Product).slug === "string" && typeof (p as Product).priceCents === "number");
}
