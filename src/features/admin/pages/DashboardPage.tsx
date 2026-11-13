import { Link } from "@tanstack/react-router";
import { Badge } from "@/shared/ui/Badge";
import { Card } from "@/shared/ui/Card";
import { formatBRL } from "@/shared/utils/format";
import { ORDER_STATUS_LABEL } from "@/shared/types/order";
import { useDemoData } from "@/features/demo-data/repository";
import { dashboardMetrics, orderTotal, ordersByDay, topProducts } from "@/features/demo-data/rules";
import { BarChart, DataTable, HBarList, StatCard, adminStyles as s, formatDate } from "../ui/AdminUI";
import { ORDER_STATUS_TONE } from "../ui/labels";

export function DashboardPage() {
  const data = useDemoData();
  const m = dashboardMetrics(data);
  const days = ordersByDay(data.orders, 14);
  const recent = [...data.orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6);
  const customer = (id: string) => data.customers.find((c) => c.id === id)?.name ?? "Cliente removido";

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
        <StatCard label="Clientes fictícios" value={m.customers} />
        <StatCard label="Vendas confirmadas (demo)" value={formatBRL(m.confirmedRevenueCents)} hint="Pendentes não contam" />
        <StatCard label="Receita recebida" value={formatBRL(m.receivedRevenueCents)} />
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
          <HBarList items={topProducts(data.orders).map((t) => ({ label: t.name, value: t.quantity }))} />
        </Card>
      </div>
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <h2 className={s.h2} style={{ margin: 0 }}>Pedidos recentes</h2>
          <Link to="/admin/pedidos">Ver todos</Link>
        </div>
        <DataTable label="Pedidos recentes" head={<><th>Pedido</th><th>Cliente</th><th className={s.hideSm}>Data</th><th>Status</th><th className={s.num}>Valor estimado</th></>}>
          {recent.map((o) => (
            <tr key={o.id}>
              <td>#{o.number}</td>
              <td>{customer(o.customerId)}</td>
              <td className={s.hideSm}>{formatDate(o.createdAt, true)}</td>
              <td><Badge tone={ORDER_STATUS_TONE[o.status]}>{ORDER_STATUS_LABEL[o.status]}</Badge></td>
              <td className={s.num}>{formatBRL(orderTotal(o))}</td>
            </tr>
          ))}
        </DataTable>
      </div>
    </div>
  );
}
