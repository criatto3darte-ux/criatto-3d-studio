export type OrderStatus =
  | "aguardando-contato"
  | "em-atendimento"
  | "confirmado"
  | "em-producao"
  | "pronto-para-entrega"
  | "enviado"
  | "concluido"
  | "cancelado";

/** Statuses that count as a confirmed sale (only after admin confirmation). */
export const CONFIRMED_STATUSES: readonly OrderStatus[] = [
  "confirmado",
  "em-producao",
  "pronto-para-entrega",
  "enviado",
  "concluido",
];

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  "aguardando-contato": "Aguardando contato",
  "em-atendimento": "Em atendimento",
  confirmado: "Confirmado",
  "em-producao": "Em produção",
  "pronto-para-entrega": "Pronto para entrega",
  enviado: "Enviado",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

export function isConfirmedSale(status: OrderStatus): boolean {
  return CONFIRMED_STATUSES.includes(status);
}
