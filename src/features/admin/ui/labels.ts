import type { BadgeTone } from "@/shared/ui/Badge";
import type { OrderStatus } from "@/shared/types/order";
import type { StockState } from "@/features/demo-data/rules";

export const ORDER_STATUS_TONE: Record<OrderStatus, BadgeTone> = {
  "aguardando-contato": "warning",
  "em-atendimento": "cyan",
  confirmado: "primary",
  "em-producao": "purple",
  "pronto-para-entrega": "magenta",
  enviado: "yellow",
  concluido: "success",
  cancelado: "danger",
};

export const STOCK_LABEL: Record<StockState, string> = {
  "sob-demanda": "Sob encomenda",
  esgotado: "Esgotado",
  baixo: "Estoque baixo",
  ok: "Em estoque",
  indisponivel: "Indisponível",
};
export const STOCK_TONE: Record<StockState, BadgeTone> = {
  "sob-demanda": "cyan",
  esgotado: "danger",
  baixo: "warning",
  ok: "success",
  indisponivel: "neutral",
};
