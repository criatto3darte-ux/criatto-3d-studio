import { isConfirmedSale, type OrderStatus } from "@/shared/types/order";
import type { DemoOrder } from "./model";

const transitions: Record<OrderStatus, readonly OrderStatus[]> = {
  "aguardando-contato": ["em-atendimento", "confirmado", "cancelado"],
  "em-atendimento": ["confirmado", "cancelado"],
  confirmado: ["em-producao", "pronto-para-entrega", "enviado", "concluido", "cancelado"],
  "em-producao": ["pronto-para-entrega", "cancelado"],
  "pronto-para-entrega": ["enviado", "concluido", "cancelado"],
  enviado: ["concluido", "cancelado"],
  concluido: [],
  cancelado: [],
};

export function allowedOrderStatuses(status: OrderStatus): readonly OrderStatus[] { return transitions[status]; }
export function canChangeOrderStatus(from: OrderStatus, to: OrderStatus): boolean { return transitions[from].includes(to); }
export function isPendingOrder(status: OrderStatus): boolean { return status === "aguardando-contato" || status === "em-atendimento"; }
export function canEditPayment(order: DemoOrder): boolean { return isConfirmedSale(order.status); }

function checkTime(o: DemoOrder, at: string) {
  const time = Date.parse(at);
  if (!Number.isFinite(time) || time < Date.parse(o.history.at(-1)?.at ?? o.createdAt)) throw new Error("Data anterior ao histórico do pedido.");
}

export function changeOrderStatus(o: DemoOrder, to: OrderStatus, at: string, note?: string): DemoOrder {
  if (o.status === to) return o;
  if (!canChangeOrderStatus(o.status, to)) throw new Error("Transição de pedido não permitida.");
  checkTime(o, at);
  return { ...o, status: to, history: [...o.history, { at, from: o.status, to, ...(note ? { note } : {}) }] };
}

export function changeOrderPayment(o: DemoOrder, received: boolean, at: string): DemoOrder {
  if (received === o.paymentReceived) return o;
  if (!canEditPayment(o)) throw new Error("Pagamento só pode ser alterado em pedidos confirmados.");
  checkTime(o, at);
  return { ...o, paymentReceived: received, history: [...o.history, { at, from: o.status, to: o.status, paymentReceived: received, note: received ? "Pagamento recebido (demonstração)" : "Marcação de pagamento removida (demonstração)" }] };
}

/** Old demo histories may omit intermediate steps; accept only reachable forward states, never reopening terminals. */
export function isHistoricalTransition(from: OrderStatus, to: OrderStatus): boolean {
  const visited = new Set<OrderStatus>();
  const queue = [...transitions[from]];
  while (queue.length) {
    const state = queue.shift();
    if (!state || visited.has(state)) continue;
    if (state === to) return true;
    visited.add(state); queue.push(...transitions[state]);
  }
  return false;
}

/** Existing order snapshots and history are append-only, including at programmatic writes. */
export function validOrderUpdates(before: DemoOrder[], after: DemoOrder[]): boolean {
  if (before.length !== after.length) return false;
  return before.every((old) => {
    const next = after.find((o) => o.id === old.id);
    if (!next) return false;
    for (const key of ["number", "createdAt", "customerId", "items", "shippingCents"] as const) {
      if (JSON.stringify(old[key]) !== JSON.stringify(next[key])) return false;
    }
    if (JSON.stringify(next.history.slice(0, old.history.length)) !== JSON.stringify(old.history)) return false;
    let replay = old;
    try {
      for (const entry of next.history.slice(old.history.length)) {
        if (entry.from !== replay.status) return false;
        replay = entry.paymentReceived !== undefined
          ? changeOrderPayment(replay, entry.paymentReceived, entry.at)
          : changeOrderStatus(replay, entry.to, entry.at, entry.note);
        if (replay.status !== entry.to) return false;
      }
    } catch { return false; }
    return replay.status === next.status && replay.paymentReceived === next.paymentReceived;
  });
}