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
  notes: string;
  version: number;
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
    .select("id,number,status,created_at,customer_name_snapshot,customer_phone_snapshot,subtotal_cents,notes,version")
    .order("created_at", { ascending: false })
    .limit(150);
  if (error) throw new Error("Não foi possível carregar os pedidos reais. Confira o acesso MFA AAL2.");
  return (data ?? []).map((order) => ({
    id: order.id, number: Number(order.number), status: order.status,
    createdAt: order.created_at, name: order.customer_name_snapshot,
    phone: order.customer_phone_snapshot, subtotalCents: Number(order.subtotal_cents),
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
