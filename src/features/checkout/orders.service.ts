import { getSupabase } from "@/lib/supabase/client";
import { buildWhatsAppUrl, isValidCustomerPhone, onlyDigits, validateName } from "./checkout.logic";
import type { CartItem } from "@/shared/types/cart";
import type { Product } from "@/shared/types/catalog";
import { formatBRL } from "@/shared/utils/format";
import {
  deliveryPayload,
  formatAddress,
  formatDeliveryDays,
  needsAddress,
  parseQuote,
  validateAddress,
  type DeliveryAddress,
  type DeliveryMethod,
  type DeliveryOption,
} from "./delivery.logic";

export interface OfficialOrder {
  orderId: string;
  orderNumber: number;
  subtotalCents: number;
  shippingCents: number | null;
  totalCents: number | null;
  deliveryLabel: string | null;
  deliveryDays: number | null;
  whatsapp: string;
  status: "aguardando-contato";
}
export interface CheckoutDelivery {
  method: DeliveryMethod;
  address: DeliveryAddress;
}
export interface CheckoutCustomer {
  name: string;
  phone: string;
  notes: string;
  privacyAccepted: boolean;
}

export function orderPayload(
  items: CartItem[], products: Product[], customer: CheckoutCustomer,
  idempotencyKey: string, delivery: CheckoutDelivery,
) {
  if (needsAddress(delivery.method) && Object.keys(validateAddress(delivery.address)).length) {
    throw new Error("Preencha o endereço de entrega completo.");
  }
  const phoneDigits = onlyDigits(customer.phone);
  if (validateName(customer.name) || !isValidCustomerPhone(customer.phone) ||
      customer.notes.length > 500 || !customer.privacyAccepted) {
    throw new Error("Preencha nome completo, telefone, aceite de privacidade e observações válidos.");
  }
  if (!items.length || items.length > 20) throw new Error("Revise o limite de itens do carrinho.");
  const lines = items.map((item) => {
    const product = products.find((p) => p.id === item.productId);
    if (!product) throw new Error("O catálogo mudou. Atualize seu carrinho.");
    const sku = product.variantCombinations?.find((variant) =>
      Object.keys(variant.selections).length === Object.keys(item.variants).length &&
      Object.entries(variant.selections).every(([group, value]) => item.variants[group] === value),
    )?.sku ?? null;
    if (product.variants.length && !sku) {
      throw new Error("Selecione uma combinação válida de cor e tamanho.");
    }
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 10) {
      throw new Error("Para finalizar, cada item deve ter entre 1 e 10 unidades.");
    }
    return { productId: item.productId, quantity: item.quantity, sku };
  });
  return {
    customerName: customer.name.trim().replace(/\s+/g, " "),
    customerPhone: "+55" + phoneDigits,
    notes: customer.notes.trim(),
    privacyAccepted: true,
    idempotencyKey,
    items: lines,
    delivery: deliveryPayload(delivery.method, delivery.address),
  };
}

export async function createOfficialOrder(payload: ReturnType<typeof orderPayload>): Promise<OfficialOrder> {
  const { data, error } = await getSupabase().functions.invoke("checkout-order", {
    body: payload,
  });
  if (error) throw new Error("Não foi possível registrar o pedido. Verifique a conexão e tente novamente.");
  if (data?.error) throw new Error(String(data.error));
  if (!data || !Number.isSafeInteger(data.orderNumber) ||
      !Number.isSafeInteger(Number(data.subtotalCents)) ||
      typeof data.orderId !== "string" || typeof data.whatsapp !== "string") {
    throw new Error("Não foi possível confirmar o pedido. Tente novamente.");
  }
  return {
    orderId: data.orderId,
    orderNumber: data.orderNumber,
    subtotalCents: Number(data.subtotalCents),
    shippingCents: Number.isSafeInteger(data.shippingCents) ? Number(data.shippingCents) : null,
    totalCents: Number.isSafeInteger(data.totalCents) ? Number(data.totalCents) : null,
    deliveryLabel: typeof data.deliveryLabel === "string" ? data.deliveryLabel : null,
    deliveryDays: Number.isSafeInteger(data.deliveryDays) ? Number(data.deliveryDays) : null,
    whatsapp: data.whatsapp,
    status: "aguardando-contato",
  };
}

export async function quoteShipping(cep: string, items: CartItem[]): Promise<DeliveryOption[]> {
  const { data, error } = await getSupabase().functions.invoke("shipping-quote", {
    body: { cep, items: items.map((item) => ({ productId: item.productId })) },
  });
  if (error) throw new Error("Não foi possível calcular o frete agora. Tente novamente.");
  if (data?.error) throw new Error(String(data.error));
  const options = parseQuote(data);
  if (!options.length) throw new Error("Não foi possível calcular o frete agora. Tente novamente.");
  return options;
}

function deliveryLines(order: OfficialOrder, delivery: CheckoutDelivery | null): string[] {
  const shipping = order.shippingCents === null ? "a combinar" : order.shippingCents === 0 ? "grátis" : formatBRL(order.shippingCents);
  const lines = [`Subtotal: ${formatBRL(order.subtotalCents)}`];
  if (order.deliveryLabel) lines.push(`Entrega: ${order.deliveryLabel}`);
  if (delivery && needsAddress(delivery.method)) lines.push(`Endereço: ${formatAddress(delivery.address)}`);
  lines.push(`Frete: ${shipping}.`);
  if (order.totalCents !== null) lines.push(`*Total: ${formatBRL(order.totalCents)}*`);
  if (order.deliveryLabel && order.deliveryDays !== null) lines.push(`Prazo: ${formatDeliveryDays(order.deliveryDays).toLowerCase()}`);
  return lines;
}

export function officialOrderWhatsAppUrl(
  order: OfficialOrder, items: CartItem[], customer: CheckoutCustomer,
  delivery: CheckoutDelivery | null = null,
): string | null {
  const lines = [
    "*PEDIDO CRIATTO 3D*", "",
    `Pedido nº ${order.orderNumber}`,
    `Nome: ${customer.name.trim()}`,
    `WhatsApp: ${customer.phone}`, "",
    "*PRODUTOS*",
    ...items.map((item, i) =>
      `${i + 1}. ${item.name} | ${item.quantity} un.` +
      (Object.keys(item.variants).length
        ? ` | ${Object.entries(item.variants).map(([k, v]) => `${k}: ${v}`).join(", ")}`
        : ""),
    ),
    "", ...deliveryLines(order, delivery),
    customer.notes.trim() ? `Observações: ${customer.notes.trim()}` : "",
    "", order.totalCents !== null
      ? "Gostaria de confirmar este pedido."
      : "Gostaria de confirmar disponibilidade e entrega deste pedido.",
  ].filter(Boolean);
  return buildWhatsAppUrl(order.whatsapp, lines.join("\n"));
}
