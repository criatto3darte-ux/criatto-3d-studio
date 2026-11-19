import { useCallback, useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { isConfirmedSale, type OrderStatus } from "@/shared/types/order";

/**
 * Indicadores administrativos calculados a partir do Supabase (pedidos,
 * itens, produtos, estoque e pagamentos), protegidos por RLS + AAL2.
 * Substitui os dados de demonstração do LocalStorage.
 */

export interface MetricOrder {
  id: string;
  number: number;
  status: OrderStatus;
  createdAt: string;
  name: string;
  phone: string;
  subtotalCents: number;
}
export interface MetricItem {
  orderId: string;
  productName: string;
  quantity: number;
}
export interface MetricProduct {
  id: string;
  name: string;
  active: boolean;
  readyStock: boolean;
}
export interface MetricInventory {
  productId: string;
  onHand: number;
  allocated: number;
  minimum: number;
}
export interface MetricPayment {
  orderId: string;
  amountCents: number;
  kind: "receipt" | "refund" | "correction";
}
export interface AdminSnapshot {
  orders: MetricOrder[];
  items: MetricItem[];
  products: MetricProduct[];
  inventory: MetricInventory[];
  payments: MetricPayment[];
}

const PENDING: readonly OrderStatus[] = ["aguardando-contato", "em-atendimento"];

export function isSameLocalDay(iso: string, now: Date): boolean {
  const d = new Date(iso);
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export interface LowStockRow {
  productId: string;
  name: string;
  available: number;
  minimum: number;
}

/** Produtos publicados de pronta entrega cujo saldo livre está no mínimo ou abaixo. */
export function lowStock(snapshot: AdminSnapshot): LowStockRow[] {
  const inventory = new Map(snapshot.inventory.map((row) => [row.productId, row]));
  return snapshot.products
    .filter((product) => product.active && product.readyStock)
    .flatMap((product) => {
      const row = inventory.get(product.id);
      const available = row ? row.onHand - row.allocated : 0;
      const minimum = row?.minimum ?? 0;
      return available <= minimum
        ? [{ productId: product.id, name: product.name, available, minimum }]
        : [];
    });
}

export function orderMetrics(orders: readonly MetricOrder[], payments: readonly MetricPayment[]) {
  const confirmed = orders.filter((o) => isConfirmedSale(o.status));
  const pending = orders.filter((o) => PENDING.includes(o.status));
  const orderIds = new Set(orders.map((o) => o.id));
  const receivedRevenueCents = payments
    .filter((p) => orderIds.has(p.orderId))
    .reduce((sum, p) => sum + (p.kind === "refund" ? -p.amountCents : p.amountCents), 0);
  return {
    pending: pending.length,
    awaitingContact: orders.filter((o) => o.status === "aguardando-contato").length,
    confirmed: orders.filter((o) => o.status === "confirmado").length,
    inProduction: orders.filter((o) => o.status === "em-producao").length,
    completed: orders.filter((o) => o.status === "concluido").length,
    cancelled: orders.filter((o) => o.status === "cancelado").length,
    confirmedRevenueCents: confirmed.reduce((sum, o) => sum + o.subtotalCents, 0),
    pendingEstimateCents: pending.reduce((sum, o) => sum + o.subtotalCents, 0),
    receivedRevenueCents,
  };
}

export function dashboardMetrics(snapshot: AdminSnapshot, now = new Date()) {
  const customers = new Set(snapshot.orders.map((o) => o.phone)).size;
  return {
    ...orderMetrics(snapshot.orders, snapshot.payments),
    ordersToday: snapshot.orders.filter((o) => isSameLocalDay(o.createdAt, now)).length,
    activeProducts: snapshot.products.filter((p) => p.active).length,
    lowStock: lowStock(snapshot).length,
    customers,
  };
}

export interface DayPoint {
  label: string;
  orders: number;
  confirmedCents: number;
}

export function ordersByDay(
  orders: readonly MetricOrder[],
  days: number,
  now = new Date(),
): DayPoint[] {
  const points: DayPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const same = orders.filter((o) => isSameLocalDay(o.createdAt, day));
    points.push({
      label: `${String(day.getDate()).padStart(2, "0")}/${String(day.getMonth() + 1).padStart(2, "0")}`,
      orders: same.length,
      confirmedCents: same
        .filter((o) => isConfirmedSale(o.status))
        .reduce((sum, o) => sum + o.subtotalCents, 0),
    });
  }
  return points;
}

export function ordersByStatus(
  orders: readonly MetricOrder[],
): Partial<Record<OrderStatus, number>> {
  const result: Partial<Record<OrderStatus, number>> = {};
  for (const order of orders) result[order.status] = (result[order.status] ?? 0) + 1;
  return result;
}

/** Quantidade por produto, ignorando pedidos cancelados. */
export function topProducts(
  orders: readonly MetricOrder[],
  items: readonly MetricItem[],
  limit = 5,
): { name: string; quantity: number }[] {
  const valid = new Set(orders.filter((o) => o.status !== "cancelado").map((o) => o.id));
  const totals = new Map<string, number>();
  for (const item of items) {
    if (!valid.has(item.orderId)) continue;
    totals.set(item.productName, (totals.get(item.productName) ?? 0) + item.quantity);
  }
  return [...totals.entries()]
    .map(([name, quantity]) => ({ name, quantity }))
    .sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name))
    .slice(0, limit);
}

export interface CustomerSummary {
  phone: string;
  name: string;
  orders: MetricOrder[];
  confirmedTotalCents: number;
  firstPurchase: string;
  lastPurchase: string;
}

/** Clientes derivados dos pedidos (o checkout não cria conta nem cadastro). */
export function customersFromOrders(orders: readonly MetricOrder[]): CustomerSummary[] {
  const byPhone = new Map<string, MetricOrder[]>();
  for (const order of orders) {
    const list = byPhone.get(order.phone) ?? [];
    list.push(order);
    byPhone.set(order.phone, list);
  }
  return [...byPhone.entries()]
    .map(([phone, list]) => {
      const sorted = [...list].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      const last = sorted[sorted.length - 1]!;
      return {
        phone,
        name: last.name,
        orders: [...sorted].reverse(),
        confirmedTotalCents: sorted
          .filter((o) => isConfirmedSale(o.status))
          .reduce((sum, o) => sum + o.subtotalCents, 0),
        firstPurchase: sorted[0]!.createdAt,
        lastPurchase: last.createdAt,
      };
    })
    .sort((a, b) => b.lastPurchase.localeCompare(a.lastPurchase));
}

const ACCESS_ERROR = "Não foi possível carregar os dados. Confira o acesso com MFA (AAL2).";

export async function loadAdminSnapshot(): Promise<AdminSnapshot> {
  const client = getSupabase();
  const [orders, items, products, inventory, payments] = await Promise.all([
    client
      .from("orders")
      .select(
        "id,number,status,created_at,customer_name_snapshot,customer_phone_snapshot,subtotal_cents",
      )
      .order("created_at", { ascending: false })
      .limit(1000),
    client.from("order_items").select("order_id,product_name_snapshot,quantity").limit(5000),
    client.from("products").select("id,name,active,production_mode").is("archived_at", null),
    client.from("inventory").select("product_id,on_hand,allocated,minimum_on_hand"),
    client.from("payments").select("order_id,amount_cents,kind"),
  ]);
  if (orders.error || items.error || products.error || inventory.error) {
    throw new Error(ACCESS_ERROR);
  }
  return {
    orders: (orders.data ?? []).map((o) => ({
      id: o.id,
      number: Number(o.number),
      status: o.status as OrderStatus,
      createdAt: o.created_at,
      name: o.customer_name_snapshot,
      phone: o.customer_phone_snapshot,
      subtotalCents: Number(o.subtotal_cents),
    })),
    items: (items.data ?? []).map((i) => ({
      orderId: i.order_id,
      productName: i.product_name_snapshot,
      quantity: Number(i.quantity),
    })),
    products: (products.data ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      active: Boolean(p.active),
      readyStock: p.production_mode === "pronta-entrega",
    })),
    inventory: (inventory.data ?? []).map((row) => ({
      productId: row.product_id,
      onHand: Number(row.on_hand),
      allocated: Number(row.allocated),
      minimum: Number(row.minimum_on_hand ?? 0),
    })),
    // Pagamentos só são visíveis para proprietário/financeiro; para outros
    // papéis a RLS devolve vazio, e a receita recebida fica zerada.
    payments: payments.error
      ? []
      : (payments.data ?? []).map((p) => ({
          orderId: p.order_id,
          amountCents: Number(p.amount_cents),
          kind: p.kind as MetricPayment["kind"],
        })),
  };
}

export function useAdminSnapshot() {
  const [snapshot, setSnapshot] = useState<AdminSnapshot | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setSnapshot(await loadAdminSnapshot());
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : ACCESS_ERROR);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { snapshot, error, loading, reload };
}

/** Remove os dados de demonstração antigos guardados no navegador. */
export const LEGACY_DEMO_STORAGE_KEY = "criatto3d:demo-data";
export function clearLegacyDemoData(storage: Pick<Storage, "removeItem"> | undefined): void {
  try {
    storage?.removeItem(LEGACY_DEMO_STORAGE_KEY);
  } catch {
    /* armazenamento indisponível: nada a limpar */
  }
}
