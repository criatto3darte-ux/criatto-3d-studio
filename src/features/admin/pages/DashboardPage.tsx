import { Link } from "@tanstack/react-router";
import { Badge } from "@/shared/ui/Badge";
import { Card } from "@/shared/ui/Card";
import { formatBRL, maskPhone } from "@/shared/utils/format";
import { ORDER_STATUS_LABEL } from "@/shared/types/order";
import {
  dashboardMetrics,
  ordersByDay,
  topProducts,
  useAdminSnapshot,
} from "@/features/admin/admin-metrics";
import { BarChart, DataTable, HBarList, StatCard, adminStyles as s, formatDate } from "../ui/AdminUI";
import { ORDER_STATUS_TONE } from "../ui/labels";

export function DashboardPage() {
  const { snapshot, error, loading } = useAdminSnapshot();

  if (loading && !snapshot) return <p aria-busy="true">Carregando indicadores…</p>;
  if (error || !snapshot) return <p role="alert">{error || "Não foi possível carregar os indicadores."}</p>;

  const m = dashboardMetrics(snapshot);
  const days = ordersByDay(snapshot.orders, 14);
  const recent = snapshot.orders.slice(0, 6);
  const top = topProducts(snapshot.orders, snapshot.items);

  return (
    <div className={s.stack}>
      <div className={s.stats}>
        <StatCard label="Pedidos do dia" value={m.ordersToday} />
        <StatCard label="Pedidos pendentes" value={m.pending} hint={`Aguardando contato: ${m.awaitingContact}`} />
        <StatCard label="Pedidos confirmados" value={m.confirmed} />
        <StatCard label="Em produção" value={m.inProduction} />
        <StatCard label="Pedidos concluídos" value={m.completed} />
        <StatCard label="Pedidos cancelados" value={m.cancelled} />
        <StatCard label="Produtos ativos" value={m.activeProducts} />
        <StatCard label="Estoque baixo/esgotado" value={m.lowStock} hint="Somente pronta entrega" />
        <StatCard label="Clientes" value={m.customers} hint="WhatsApp distintos nos pedidos" />
        <StatCard label="Vendas confirmadas" value={formatBRL(m.confirmedRevenueCents)} hint="Pendentes não contam" />
        <StatCard label="Receita recebida" value={formatBRL(m.receivedRevenueCents)} hint="Pagamentos registrados" />
        <StatCard label="Estimativa pendente" value={formatBRL(m.pendingEstimateCents)} />
      </div>
      <div className={s.twoCol}>
        <Card>
          <h2 className={s.h2}>Pedidos por período (14 dias)</h2>
          <BarChart data={days.map((d) => ({ label: d.label, value: d.orders }))} />
        </Card>
        <Card>
          <h2 className={s.h2}>Vendas confirmadas (14 dias)</h2>
          <BarChart alt data={days.map((d) => ({ label: d.label, value: d.confirmedCents, display: formatBRL(d.confirmedCents) }))} />
        </Card>
        <Card>
          <h2 className={s.h2}>Produtos mais solicitados</h2>
          {top.length
            ? <HBarList items={top.map((t) => ({ label: t.name, value: t.quantity }))} />
            : <p className={s.muted}>Nenhum pedido ainda.</p>}
        </Card>
      </div>
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <h2 className={s.h2} style={{ margin: 0 }}>Pedidos recentes</h2>
          <Link to="/admin/pedidos">Ver todos</Link>
        </div>
        <DataTable label="Pedidos recentes" empty={!recent.length} head={<><th>Pedido</th><th>Cliente</th><th className={s.hideSm}>Data</th><th>Status</th><th className={s.num}>Subtotal</th></>}>
          {recent.map((o) => (
            <tr key={o.id}>
              <td>#{o.number}</td>
              <td>{o.name}<div className={s.muted}>{maskPhone(o.phone.replace(/^\+55/, ""))}</div></td>
              <td className={s.hideSm}>{formatDate(o.createdAt, true)}</td>
              <td><Badge tone={ORDER_STATUS_TONE[o.status]}>{ORDER_STATUS_LABEL[o.status]}</Badge></td>
              <td className={s.num}>{formatBRL(o.subtotalCents)}</td>
            </tr>
          ))}
        </DataTable>
      </div>
    </div>
  );
}
