import { getSupabase } from "@/lib/supabase/client";

export type OrderStatus =
  | "aguardando-contato" | "em-atendimento" | "confirmado" | "em-producao"
  | "pronto-para-entrega" | "enviado" | "concluido" | "cancelado";

export interface RealOrder {
  id: string;
  number: number;
  status: OrderStatus;
  createdAt: string;
  name: string;
  phone: string;
  subtotalCents: number;
  shippingCents: number | null;
  totalCents: number | null;
  deliveryLabel: string | null;
  deliveryDays: number | null;
  /** Full delivery address (admin only), or null for pickup / older orders. */
  deliveryAddress: string | null;
  notes: string;
  version: number;
}

function formatShipAddress(o: Record<string, unknown>): string | null {
  if (typeof o.ship_cep !== "string" || typeof o.ship_street !== "string") return null;
  const cep = o.ship_cep.length === 8 ? `${o.ship_cep.slice(0, 5)}-${o.ship_cep.slice(5)}` : o.ship_cep;
  const complement = typeof o.ship_complement === "string" && o.ship_complement ? `, ${o.ship_complement}` : "";
  return `${o.ship_street}, ${String(o.ship_number ?? "")}${complement} — ${String(o.ship_district ?? "")}, ` +
    `${String(o.ship_city ?? "")}/${String(o.ship_state ?? "")} — CEP ${cep}`;
}
export interface RealOrderItem {
  id: string;
  productName: string;
  sku: string | null;
  attributes: Record<string, string>;
  quantity: number;
  unitPriceCents: number;
}

export async function listRealOrders(): Promise<RealOrder[]> {
  const { data, error } = await getSupabase().from("orders")
    .select("id,number,status,created_at,customer_name_snapshot,customer_phone_snapshot,subtotal_cents,shipping_cents,total_cents,delivery_label,delivery_days,ship_cep,ship_street,ship_number,ship_complement,ship_district,ship_city,ship_state,notes,version")
    .order("created_at", { ascending: false })
    .limit(150);
  if (error) throw new Error("Não foi possível carregar os pedidos reais. Confira o acesso MFA AAL2.");
  return (data ?? []).map((order) => ({
    id: order.id, number: Number(order.number), status: order.status,
    createdAt: order.created_at, name: order.customer_name_snapshot,
    phone: order.customer_phone_snapshot, subtotalCents: Number(order.subtotal_cents),
    shippingCents: order.shipping_cents === null ? null : Number(order.shipping_cents),
    totalCents: order.total_cents === null ? null : Number(order.total_cents),
    deliveryLabel: order.delivery_label ?? null,
    deliveryDays: order.delivery_days ?? null,
    deliveryAddress: formatShipAddress(order as Record<string, unknown>),
    notes: order.notes, version: order.version,
  }));
}

export async function listRealOrderItems(orderId: string): Promise<RealOrderItem[]> {
  const { data, error } = await getSupabase().from("order_items")
    .select("id,product_name_snapshot,sku_snapshot,attributes_snapshot,quantity,unit_price_cents")
    .eq("order_id", orderId).order("created_at");
  if (error) throw new Error("Não foi possível carregar os itens do pedido.");
  return (data ?? []).map((item) => ({
    id: item.id, productName: item.product_name_snapshot,
    sku: item.sku_snapshot,
    attributes: (item.attributes_snapshot ?? {}) as Record<string, string>,
    quantity: item.quantity, unitPriceCents: Number(item.unit_price_cents),
  }));
}

export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  "aguardando-contato": ["em-atendimento", "cancelado"],
  "em-atendimento": ["confirmado", "cancelado"],
  "confirmado": ["em-producao", "pronto-para-entrega", "cancelado"],
  "em-producao": ["pronto-para-entrega", "cancelado"],
  "pronto-para-entrega": ["enviado", "concluido", "cancelado"],
  "enviado": ["concluido"],
  "concluido": [],
  "cancelado": [],
};

export async function transitionRealOrder(
  order: Pick<RealOrder, "id" | "version">,
  status: OrderStatus,
  reason: string,
): Promise<void> {
  const { error } = await getSupabase().rpc("transition_checkout_order", {
    p_order_id: order.id,
    p_expected_version: order.version,
    p_new_status: status,
    p_reason: reason.trim().slice(0, 500),
  });
  if (error) {
    if (error.code === "40001") {
      throw new Error("Este pedido foi alterado por outra pessoa. Atualize a lista.");
    }
    if (error.code === "42501" || error.code === "PGRST301") {
      throw new Error("É necessário acessar como proprietário ou operador com MFA AAL2.");
    }
    throw new Error("Não foi possível alterar o pedido ou movimentar a reserva de estoque.");
  }
}
