import { useEffect, useMemo, useState } from "react";
import { Eye, RefreshCw } from "lucide-react";
import { Button } from "@/shared/ui/Button";
import { Badge } from "@/shared/ui/Badge";
import { formatBRL } from "@/shared/utils/format";
import { listRealOrders, listRealOrderItems, type RealOrder, type RealOrderItem } from "@/features/orders/real-orders.service";
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
    setSelected(order);
    setItems([]);
    setLoadingItems(true);
    try { setItems(await listRealOrderItems(order.id)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Erro ao consultar itens."); }
    finally { setLoadingItems(false); }
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
        head={<><th>Número</th><th>Data</th><th>Cliente</th><th>Status</th><th>Subtotal</th><th>Ações</th></>}>
        {visible.map((order) => (
          <tr key={order.id}>
            <td>#{order.number}</td>
            <td>{new Date(order.createdAt).toLocaleDateString("pt-BR")}</td>
            <td>{order.name}</td>
            <td><Badge tone={order.status === "cancelado" ? "danger" :
              order.status === "concluido" ? "success" : "warning"}>
              {statusLabel[order.status]}
            </Badge></td>
            <td>{formatBRL(order.subtotalCents)}</td>
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
          <p><strong>Frete:</strong> a combinar</p>
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
          <p className={s.muted}>
            A transição de status exigirá a função de gestão de pedidos,
            com liberação ou consumo do estoque reservado e auditoria.
          </p>
        </div>}
      </Modal>
    </div>
  );
}
