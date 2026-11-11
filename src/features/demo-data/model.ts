import type { Category, Product } from "@/shared/types/catalog";
import type { OrderStatus } from "@/shared/types/order";

/**
 * DEMONSTRAÇÃO — modelo único usado pela loja e pelo painel.
 * Todos os registros de clientes, pedidos e personalizações são fictícios.
 */
export const DEMO_SCHEMA_VERSION = 1;

export interface OrderItemSnapshot {
  /** Reference only: the product may be edited or deleted later. */
  productId: string;
  name: string;
  unitPriceCents: number;
  quantity: number;
  variants: Record<string, string>;
}

export interface OrderHistoryEntry {
  at: string;
  from?: OrderStatus;
  to: OrderStatus;
  note?: string;
}

export interface DemoOrder {
  id: string;
  number: string;
  createdAt: string;
  customerId: string;
  items: OrderItemSnapshot[];
  shippingCents: number;
  status: OrderStatus;
  notes: string;
  /** True only when payment was actually received (receita recebida). */
  paymentReceived: boolean;
  history: OrderHistoryEntry[];
}

export interface DemoCustomer {
  id: string;
  name: string;
  /** Test phone (digits). Seeds use DDD 00, which does not exist, so no real person is reachable. */
  phone: string;
  createdAt: string;
  notes: string;
}

export type CustomRequestStatus = "recebida" | "em-analise" | "orcamento-enviado" | "aprovado" | "em-producao" | "concluido" | "cancelado";

export const CUSTOM_STATUS_LABEL: Record<CustomRequestStatus, string> = {
  recebida: "Solicitação recebida",
  "em-analise": "Em análise",
  "orcamento-enviado": "Orçamento enviado",
  aprovado: "Aprovado",
  "em-producao": "Em produção",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

export interface DemoCustomRequest {
  id: string;
  createdAt: string;
  customerName: string;
  productName: string;
  description: string;
  color: string;
  dimensions: string;
  quantity: number;
  referenceImage: string;
  status: CustomRequestStatus;
  /** Manual quote in cents. Never computed automatically. */
  quoteCents: number | null;
}

export interface DemoBanner {
  id: string;
  title: string;
  /** Optional part of the title rendered with the brand gradient. */
  highlight: string;
  subtitle: string;
  image: string;
  buttonText: string;
  buttonUrl: string;
  order: number;
  active: boolean;
}

export type CouponKind = "percentual" | "fixo";

export interface DemoCoupon {
  id: string;
  code: string;
  kind: CouponKind;
  /** Percent (1–100) or cents for fixed. */
  value: number;
  startsAt: string;
  endsAt: string;
  active: boolean;
  usageLimit: number | null;
}

export interface StoreSettings {
  name: string;
  logo: string;
  whatsappNumber: string;
  email: string;
  instagram: string;
  tiktok: string;
  address: string;
  deliveryInfo: string;
  offersNationalShipping: boolean;
  serviceMessage: string;
}

export interface DemoData {
  products: Product[];
  categories: Category[];
  orders: DemoOrder[];
  customers: DemoCustomer[];
  customRequests: DemoCustomRequest[];
  banners: DemoBanner[];
  coupons: DemoCoupon[];
  settings: StoreSettings;
}

export interface DemoEnvelope {
  schemaVersion: number;
  savedAt: string;
  data: DemoData;
}
