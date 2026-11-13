import { useState } from "react";
import { Eye, MessageCircle } from "lucide-react";
import { Badge } from "@/shared/ui/Badge";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { formatBRL, maskPhone } from "@/shared/utils/format";
import { ORDER_STATUS_LABEL, type OrderStatus } from "@/shared/types/order";
import { buildWhatsAppUrl, isValidCustomerPhone } from "@/features/checkout/checkout.logic";
import { demoRepository, useDemoData } from "@/features/demo-data/repository";
import { changeOrderPayment, changeOrderStatus, orderSubtotal, orderTotal } from "@/features/demo-data/rules";
import { allowedOrderStatuses, canEditPayment } from "@/features/demo-data/order.rules";
import type { DemoOrder } from "@/features/demo-data/model";
import { Check, ConfirmDialog, DataTable, Modal, SelectField, TextareaField, adminStyles as s, formatDate } from "../ui/AdminUI";
import { ORDER_STATUS_TONE } from "../ui/labels";

const STATUSES = Object.keys(ORDER_STATUS_LABEL) as OrderStatus[];

export function OrdersPage() {
  const data = useDemoData();
  const [status, setStatus] = useState<"" | OrderStatus>("");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [pendingCancel, setPendingCancel] = useState(false);
  const customer = (id: string) => data.customers.find((c) => c.id === id);
  const list = [...data.orders]
    .filter((o) => (!status || o.status === status) && (!q || (o.number + " " + (customer(o.customerId)?.name ?? "")).toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const open = data.orders.find((o) => o.id === openId) ?? null;

  const updateOrder = (id: string, fn: (o: DemoOrder) => DemoOrder) =>
    demoRepository.update((d) => ({ ...d, orders: d.orders.map((o) => (o.id === id ? fn(o) : o)) }));

  function setOrderStatus(to: OrderStatus) {
    if (!open) return;
    if (to === "cancelado") { setPendingCancel(true); return; }
    updateOrder(open.id, (o) => changeOrderStatus(o, to, new Date().toISOString()));
  }

  const c = open ? customer(open.customerId) : undefined;
  const waUrl = c && isValidCustomerPhone(c.phone) ? buildWhatsAppUrl(`55${c.phone}`, `Olá, ${c.name}! Sobre o pedido #${open?.number}…`) : null;

  return (
    <div className={s.stack}>
      <p className={s.muted}>Pedidos fictícios de demonstração. Pedidos iniciados no checkout real não aparecem aqui nesta etapa (não há servidor).</p>
      <div className={s.toolbar}>
        <Input className={s.grow} label="Pesquisar" placeholder="Número ou cliente" value={q} onChange={(e) => setQ(e.target.value)} />
        <SelectField label="Status" value={status} onChange={(e) => setStatus(e.target.value as OrderStatus | "")}>
          <option value="">Todos</option>
          {STATUSES.map((st) => <option key={st} value={st}>{ORDER_STATUS_LABEL[st]}</option>)}
        </SelectField>
      </div>
      <DataTable label="Pedidos" empty={!list.length} head={<><th>Pedido</th><th>Cliente</th><th className={s.hideSm}>Data</th><th>Status</th><th className={s.num}>Valor estimado</th><th className={s.num}>Ações</th></>}>
        {list.map((o) => (
          <tr key={o.id}>
            <td>#{o.number}</td>
            <td>{customer(o.customerId)?.name ?? "Cliente removido"}</td>
            <td className={s.hideSm}>{formatDate(o.createdAt, true)}</td>
            <td><Badge tone={ORDER_STATUS_TONE[o.status]}>{ORDER_STATUS_LABEL[o.status]}</Badge></td>
            <td className={s.num}>{formatBRL(orderTotal(o))}</td>
            <td className={s.num}><Button size="sm" variant="outline" onClick={() => setOpenId(o.id)} aria-label={`Ver pedido ${o.number}`}><Eye size={16} /> Ver</Button></td>
          </tr>
        ))}
      </DataTable>

      <Modal open={!!open} title={open ? `Pedido #${open.number} (demonstração)` : ""} onClose={() => setOpenId(null)}>
        {open && (
          <div className={s.stack}>
            <div className={s.formGrid}>
              <div><div className={s.label}>Cliente fictício</div>{c?.name ?? "Cliente removido"}<div className={s.muted}>{c ? maskPhone(c.phone) : ""}</div></div>
              <div><div className={s.label}>Data</div>{formatDate(open.createdAt, true)}</div>
              <SelectField label="Status" value={open.status} onChange={(e) => setOrderStatus(e.target.value as OrderStatus)}>
                {[open.status, ...allowedOrderStatuses(open.status)].map((st) => <option key={st} value={st}>{ORDER_STATUS_LABEL[st]}</option>)}
              </SelectField>
            </div>
            <DataTable label="Itens do pedido" head={<><th>Produto</th><th className={s.num}>Qtd.</th><th className={s.num}>Unitário</th><th className={s.num}>Total</th></>}>
              {open.items.map((i, k) => (
                <tr key={k}>
                  <td>{i.name}<div className={s.muted}>{Object.entries(i.variants).map(([a, b]) => `${a}: ${b}`).join(" · ")}</div></td>
                  <td className={s.num}>{i.quantity}</td>
                  <td className={s.num}>{formatBRL(i.unitPriceCents)}</td>
                  <td className={s.num}>{formatBRL(i.unitPriceCents * i.quantity)}</td>
                </tr>
              ))}
            </DataTable>
            <div className={s.muted}>Subtotal {formatBRL(orderSubtotal(open))} · Frete {formatBRL(open.shippingCents)} · <strong>Valor estimado {formatBRL(orderTotal(open))}</strong></div>
            {canEditPayment(open)
              ? <Check label="Pagamento recebido (demonstração)" checked={open.paymentReceived} onChange={(v) => updateOrder(open.id, (o) => changeOrderPayment(o, v, new Date().toISOString()))} />
              : <p className={s.muted}>{open.status === "cancelado" ? (open.paymentReceived ? "Pagamento registrado antes do cancelamento; não incluído na receita recebida. Estorno não controlado nesta demonstração." : "Pedido cancelado, sem pagamento recebido.") : "Confirme o pedido antes de registrar o pagamento."}</p>}
            <TextareaField label="Observações" defaultValue={open.notes} key={open.id} maxLength={500} onBlur={(e) => { const notes = e.target.value; if (notes !== open.notes) updateOrder(open.id, (o) => ({ ...o, notes })); }} />
            <div>
              <div className={s.label} style={{ marginBottom: 8 }}>Histórico</div>
              <ol className={s.timeline}>
                {[...open.history].reverse().map((h, k) => (
                  <li key={k}>{formatDate(h.at, true)} — {h.from ? `${ORDER_STATUS_LABEL[h.from]} → ` : ""}{ORDER_STATUS_LABEL[h.to]}{h.note ? ` · ${h.note}` : ""}</li>
                ))}
              </ol>
            </div>
            {waUrl ? (
              <a href={waUrl} target="_blank" rel="noopener noreferrer"><Button variant="outline" tabIndex={-1}><MessageCircle size={18} /> Abrir conversa no WhatsApp</Button></a>
            ) : (
              <p className={s.muted}>WhatsApp indisponível: o cliente fictício não tem telefone de teste válido (cadastre um em Clientes).</p>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog open={pendingCancel} danger title="Cancelar pedido" confirmLabel="Cancelar pedido" text={`Confirmar o cancelamento do pedido #${open?.number ?? ""}? A alteração ficará registrada no histórico.`}
        onCancel={() => setPendingCancel(false)}
        onConfirm={() => { if (open) updateOrder(open.id, (o) => changeOrderStatus(o, "cancelado", new Date().toISOString())); setPendingCancel(false); }} />
    </div>
  );
}
