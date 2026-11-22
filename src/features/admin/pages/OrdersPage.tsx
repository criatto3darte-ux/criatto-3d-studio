import { useEffect, useMemo, useState } from "react";
import { Eye, RefreshCw } from "lucide-react";
import { Button } from "@/shared/ui/Button";
import { Badge } from "@/shared/ui/Badge";
import { formatBRL } from "@/shared/utils/format";
import { listRealOrders, listRealOrderItems, transitionRealOrder, ORDER_TRANSITIONS, type OrderStatus, type RealOrder, type RealOrderItem } from "@/features/orders/real-orders.service";
import { DataTable, Modal, adminStyles as s } from "../ui/AdminUI";

const statusLabel: Record<RealOrder["status"], string> = {
  "aguardando-contato": "Aguardando contato",
  "em-atendimento": "Em atendimento",
  "confirmado": "Confirmado",
  "em-producao": "Em produção",
  "pronto-para-entrega": "Pronto para entrega",
  "enviado": "Enviado",
  "concluido": "Concluído",
  "cancelado": "Cancelado",
};

export function OrdersPage() {
  const [orders, setOrders] = useState<RealOrder[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<RealOrder | null>(null);
  const [items, setItems] = useState<RealOrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);
  const [statusDraft, setStatusDraft] = useState<OrderStatus | "">("");
  const [statusNote, setStatusNote] = useState("");
  const [statusBusy, setStatusBusy] = useState(false);
  const [error, setError] = useState("");

  async function reload() {
    setLoading(true);
    setError("");
    try { setOrders(await listRealOrders()); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao consultar pedidos."); }
    finally { setLoading(false); }
  }

  useEffect(() => { void reload(); }, []);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return orders.filter((order) =>
      !term || [String(order.number), order.name, order.phone, statusLabel[order.status]]
        .some((field) => field.toLowerCase().includes(term)));
  }, [orders, search]);

  async function open(order: RealOrder) {
    setStatusDraft("");
    setStatusNote("");
    setSelected(order);
    setItems([]);
    setLoadingItems(true);
    try { setItems(await listRealOrderItems(order.id)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Erro ao consultar itens."); }
    finally { setLoadingItems(false); }
  }

  async function changeStatus() {
    if (!selected || !statusDraft ||
        !ORDER_TRANSITIONS[selected.status].includes(statusDraft)) return;
    setStatusBusy(true);
    setError("");
    try {
      await transitionRealOrder(selected, statusDraft, statusNote);
      setSelected(null);
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível atualizar o pedido.");
    } finally {
      setStatusBusy(false);
    }
  }

  return (
    <div className={s.stack}>
      <div className={s.toolbar}>
        <label htmlFor="real-orders-search">Buscar pedido</label>
        <input id="real-orders-search" type="search" value={search}
          placeholder="Número, cliente, telefone ou status"
          onChange={(event) => setSearch(event.target.value)} />
        <Button variant="outline" disabled={loading} onClick={() => void reload()}>
          <RefreshCw size={16}/> Atualizar
        </Button>
      </div>
      <p className={s.muted}>
        Pedidos registrados no Supabase, não no navegador. O status
        aguardando contato não é receita confirmada.
      </p>
      {error && <p role="alert">{error}</p>}
      {loading && <p role="status">Carregando pedidos…</p>}
      {!loading && <DataTable label="Pedidos reais" empty={!visible.length}
        head={<><th>Número</th><th>Data</th><th>Cliente</th><th>Status</th><th>Valor</th><th>Ações</th></>}>
        {visible.map((order) => (
          <tr key={order.id}>
            <td>#{order.number}</td>
            <td>{new Date(order.createdAt).toLocaleDateString("pt-BR")}</td>
            <td>{order.name}</td>
            <td><Badge tone={order.status === "cancelado" ? "danger" :
              order.status === "concluido" ? "success" : "warning"}>
              {statusLabel[order.status]}
            </Badge></td>
            <td>{order.totalCents !== null
              ? formatBRL(order.totalCents)
              : <>{formatBRL(order.subtotalCents)} <span className={s.muted}>+ frete a combinar</span></>}</td>
            <td>
              <Button size="sm" variant="outline" onClick={() => void open(order)}>
                <Eye size={16}/> Ver
              </Button>
            </td>
          </tr>
        ))}
      </DataTable>}
      <Modal open={!!selected} title={selected ? `Pedido #${selected.number}` : ""}
        onClose={() => setSelected(null)}
        footer={<Button variant="outline" onClick={() => setSelected(null)}>Fechar</Button>}>
        {selected && <div className={s.stack}>
          <p><strong>Cliente:</strong> {selected.name}</p>
          <p><strong>Telefone:</strong> {selected.phone}</p>
          <p><strong>Status:</strong> {statusLabel[selected.status]}</p>
          <p><strong>Entrega:</strong> {selected.deliveryLabel ?? "A combinar"}
            {selected.deliveryDays !== null && ` — prazo de até ${selected.deliveryDays} dia(s) útil(eis)`}</p>
          {selected.deliveryAddress && <p><strong>Endereço:</strong> {selected.deliveryAddress}</p>}
          <p><strong>Frete:</strong> {selected.shippingCents === null ? "a combinar"
            : selected.shippingCents === 0 ? "grátis" : formatBRL(selected.shippingCents)}</p>
          <p><strong>Observações:</strong> {selected.notes || "Nenhuma"}</p>
          <h3>Produtos</h3>
          {loadingItems ? <p role="status">Carregando itens…</p> : (
            <ul>{items.map((item) => (
              <li key={item.id}>
                {item.productName} — {item.quantity} un. — {formatBRL(item.quantity * item.unitPriceCents)}
                {Object.entries(item.attributes).length > 0 &&
                  <div>{Object.entries(item.attributes).map(([k,v]) => `${k}: ${v}`).join(", ")}</div>}
              </li>
            ))}</ul>
          )}
          <p><strong>Subtotal:</strong> {formatBRL(selected.subtotalCents)}</p>
          {selected.totalCents !== null && <p><strong>Total:</strong> {formatBRL(selected.totalCents)}</p>}
          {ORDER_TRANSITIONS[selected.status].length > 0 && (
            <fieldset className={s.stack} disabled={statusBusy}>
              <legend>Atualizar andamento do pedido</legend>
              <label htmlFor="order-next-status">Próxima etapa</label>
              <select id="order-next-status" value={statusDraft}
                onChange={(event) => setStatusDraft(event.target.value as OrderStatus | "")}>
                <option value="">Selecione um status</option>
                {ORDER_TRANSITIONS[selected.status].map((status) =>
                  <option value={status} key={status}>{statusLabel[status]}</option>)}
              </select>
              <label htmlFor="order-change-note">Motivo ou observação</label>
              <textarea id="order-change-note" value={statusNote} maxLength={500}
                onChange={(event) => setStatusNote(event.target.value)} />
              <p className={s.muted}>
                Cancelar libera o estoque reservado; concluir consome a reserva.
                A alteração é registrada em histórico auditável.
              </p>
              <Button disabled={!statusDraft || statusBusy} onClick={() => void changeStatus()}>
                {statusBusy ? "Atualizando…" : "Atualizar status"}
              </Button>
            </fieldset>
          )}
        </div>}
      </Modal>
    </div>
  );
}
