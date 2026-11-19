import { useState } from "react";
import { Card } from "@/shared/ui/Card";
import { formatBRL } from "@/shared/utils/format";
import { ORDER_STATUS_LABEL, type OrderStatus } from "@/shared/types/order";
import {
  lowStock,
  orderMetrics,
  ordersByDay,
  ordersByStatus,
  topProducts,
  useAdminSnapshot,
} from "@/features/admin/admin-metrics";
import { BarChart, DataTable, HBarList, SelectField, StatCard, adminStyles as s } from "../ui/AdminUI";

export function ReportsPage() {
  const { snapshot, error, loading } = useAdminSnapshot();
  const [days, setDays] = useState(30);

  if (loading && !snapshot) return <p aria-busy="true">Carregando relatórios…</p>;
  if (error || !snapshot) return <p role="alert">{error || "Não foi possível carregar os relatórios."}</p>;

  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - (days - 1));
  const orders = snapshot.orders.filter((o) => new Date(o.createdAt) >= since);
  const m = orderMetrics(orders, snapshot.payments);
  const byStatus = ordersByStatus(orders);
  const series = ordersByDay(snapshot.orders, days);
  const top = topProducts(orders, snapshot.items);
  const low = lowStock(snapshot);

  return (
    <div className={s.stack}>
      <div className={s.toolbar}>
        <SelectField label="Período" value={String(days)} onChange={(e) => setDays(Number(e.target.value))}>
          <option value="7">Últimos 7 dias</option>
          <option value="14">Últimos 14 dias</option>
          <option value="30">Últimos 30 dias</option>
        </SelectField>
        <p className={`${s.muted} ${s.grow}`}>Indicadores calculados com os pedidos registrados na loja. Valores sem frete.</p>
      </div>
      <div className={s.stats}>
        <StatCard label="Pedidos no período" value={orders.length} />
        <StatCard label="Estimativa pendente" value={formatBRL(m.pendingEstimateCents)} hint={`${m.pending} pedidos ainda não confirmados`} />
        <StatCard label="Vendas confirmadas" value={formatBRL(m.confirmedRevenueCents)} hint="Somente status confirmados" />
        <StatCard label="Receita recebida" value={formatBRL(m.receivedRevenueCents)} hint="Pagamentos registrados no período" />
      </div>
      <div className={s.twoCol}>
        <Card><h2 className={s.h2}>Pedidos por período</h2><BarChart data={series.map((d) => ({ label: d.label, value: d.orders }))} /></Card>
        <Card><h2 className={s.h2}>Vendas confirmadas</h2><BarChart alt data={series.map((d) => ({ label: d.label, value: d.confirmedCents, display: formatBRL(d.confirmedCents) }))} /></Card>
        <Card>
          <h2 className={s.h2}>Pedidos por status</h2>
          {orders.length
            ? <HBarList items={(Object.keys(byStatus) as OrderStatus[]).map((k) => ({ label: ORDER_STATUS_LABEL[k], value: byStatus[k] ?? 0 }))} />
            : <p className={s.muted}>Nenhum pedido no período.</p>}
        </Card>
        <Card>
          <h2 className={s.h2}>Produtos mais solicitados</h2>
          {top.length
            ? <HBarList items={top.map((t) => ({ label: t.name, value: t.quantity }))} />
            : <p className={s.muted}>Nenhum pedido no período.</p>}
        </Card>
      </div>
      <div>
        <h2 className={s.h2}>Produtos com estoque baixo ou esgotado</h2>
        <DataTable label="Estoque baixo" empty={!low.length} head={<><th>Produto</th><th className={s.num}>Disponível</th><th className={s.num}>Mínimo</th></>}>
          {low.map((p) => <tr key={p.productId}><td>{p.name}</td><td className={s.num}>{p.available}</td><td className={s.num}>{p.minimum}</td></tr>)}
        </DataTable>
      </div>
    </div>
  );
}
