import { useState } from "react";
import { Eye } from "lucide-react";
import { Badge } from "@/shared/ui/Badge";
import { Button } from "@/shared/ui/Button";
import { formatBRL, maskPhone } from "@/shared/utils/format";
import { ORDER_STATUS_LABEL } from "@/shared/types/order";
import { customersFromOrders, useAdminSnapshot } from "@/features/admin/admin-metrics";
import { DataTable, Modal, adminStyles as s, formatDate } from "../ui/AdminUI";
import { ORDER_STATUS_TONE } from "../ui/labels";

const phoneLabel = (e164: string) => maskPhone(e164.replace(/^\+55/, ""));

export function CustomersPage() {
  const { snapshot, error, loading } = useAdminSnapshot();
  const [view, setView] = useState<string | null>(null);

  if (loading && !snapshot) return <p aria-busy="true">Carregando clientes…</p>;
  if (error || !snapshot) return <p role="alert">{error || "Não foi possível carregar os clientes."}</p>;

  const customers = customersFromOrders(snapshot.orders);
  const viewing = customers.find((c) => c.phone === view);

  return (
    <div className={s.stack}>
      <div className={s.toolbar}>
        <p className={`${s.muted} ${s.grow}`}>
          Clientes identificados pelo WhatsApp informado nos pedidos. A loja não tem login nem conta de
          cliente, e CPF não é coletado.
        </p>
      </div>
      <DataTable label="Clientes" empty={!customers.length} head={<><th>Nome</th><th>WhatsApp</th><th className={s.num}>Pedidos</th><th className={`${s.num} ${s.hideSm}`}>Compras confirmadas</th><th className={s.hideSm}>Primeiro pedido</th><th className={s.num}>Ações</th></>}>
        {customers.map((c) => (
          <tr key={c.phone}>
            <td>{c.name}</td>
            <td>{phoneLabel(c.phone)}</td>
            <td className={s.num}>{c.orders.length}</td>
            <td className={`${s.num} ${s.hideSm}`}>{formatBRL(c.confirmedTotalCents)}</td>
            <td className={s.hideSm}>{formatDate(c.firstPurchase)}</td>
            <td className={s.num}>
              <Button size="sm" variant="outline" onClick={() => setView(c.phone)} aria-label={`Ver ${c.name}`}><Eye size={16} /> Ver</Button>
            </td>
          </tr>
        ))}
      </DataTable>

      <Modal open={!!viewing} title={viewing?.name ?? ""} onClose={() => setView(null)}>
        {viewing && (
          <div className={s.stack}>
            <div className={s.muted}>
              WhatsApp: {phoneLabel(viewing.phone)} · {viewing.orders.length} pedido(s) · Confirmado: {formatBRL(viewing.confirmedTotalCents)}
            </div>
            <DataTable label="Histórico de pedidos" empty={!viewing.orders.length} head={<><th>Pedido</th><th>Data</th><th>Status</th><th className={s.num}>Subtotal</th></>}>
              {viewing.orders.map((o) => (
                <tr key={o.id}>
                  <td>#{o.number}</td>
                  <td>{formatDate(o.createdAt)}</td>
                  <td><Badge tone={ORDER_STATUS_TONE[o.status]}>{ORDER_STATUS_LABEL[o.status]}</Badge></td>
                  <td className={s.num}>{formatBRL(o.subtotalCents)}</td>
                </tr>
              ))}
            </DataTable>
          </div>
        )}
      </Modal>
    </div>
  );
}
