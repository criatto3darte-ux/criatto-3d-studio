import { useState } from "react";
import { Card } from "@/shared/ui/Card";
import { formatBRL } from "@/shared/utils/format";
import { ORDER_STATUS_LABEL, type OrderStatus } from "@/shared/types/order";
import { useDemoData } from "@/features/demo-data/repository";
import { orderMetrics, ordersByDay, ordersByStatus, stockState, topProducts } from "@/features/demo-data/rules";
import { BarChart, DataTable, HBarList, SelectField, StatCard, adminStyles as s } from "../ui/AdminUI";

export function ReportsPage() {
  const data = useDemoData();
  const [days, setDays] = useState(30);
  const since = new Date(); since.setHours(0, 0, 0, 0); since.setDate(since.getDate() - (days - 1));
  const orders = data.orders.filter((o) => new Date(o.createdAt) >= since);
  const m = orderMetrics(orders);
  const byStatus = ordersByStatus(orders);
  const series = ordersByDay(data.orders, days);
  const low = data.products.filter((p) => ["baixo", "esgotado"].includes(stockState(p)));

  return (
    <div className={s.stack}>
      <div className={s.toolbar}>
        <SelectField label="Período" value={String(days)} onChange={(e) => setDays(Number(e.target.value))}>
          <option value="7">Últimos 7 dias</option>
          <option value="14">Últimos 14 dias</option>
          <option value="30">Últimos 30 dias</option>
        </SelectField>
        <p className={`${s.muted} ${s.grow}`}>Indicadores calculados apenas com pedidos fictícios. Não representam métricas reais.</p>
      </div>
      <div className={s.stats}>
        <StatCard label="Pedidos no período" value={orders.length} />
        <StatCard label="Estimativa pendente" value={formatBRL(m.pendingEstimateCents)} hint={`${m.pending} pedidos ainda não confirmados`} />
        <StatCard label="Vendas confirmadas" value={formatBRL(m.confirmedRevenueCents)} hint="Somente status confirmados" />
        <StatCard label="Receita recebida" value={formatBRL(m.receivedRevenueCents)} hint="Pagamento recebido em pedidos confirmados" />
      </div>
      <div className={s.twoCol}>
        <Card><h2 className={s.h2}>Pedidos por período</h2><BarChart data={series.map((d) => ({ label: d.label, value: d.orders }))} /></Card>
        <Card><h2 className={s.h2}>Vendas confirmadas</h2><BarChart alt data={series.map((d) => ({ label: d.label, value: d.confirmedCents, display: formatBRL(d.confirmedCents) }))} /></Card>
        <Card><h2 className={s.h2}>Pedidos por status</h2><HBarList items={(Object.keys(byStatus) as OrderStatus[]).map((k) => ({ label: ORDER_STATUS_LABEL[k], value: byStatus[k] }))} /></Card>
        <Card><h2 className={s.h2}>Produtos mais solicitados</h2><HBarList items={topProducts(orders).map((t) => ({ label: t.name, value: t.quantity }))} /></Card>
      </div>
      <div>
        <h2 className={s.h2}>Produtos com estoque baixo ou esgotado</h2>
        <DataTable label="Estoque baixo" empty={!low.length} head={<><th>Produto</th><th className={s.num}>Estoque</th></>}>
          {low.map((p) => <tr key={p.id}><td>{p.name}</td><td className={s.num}>{p.stock}</td></tr>)}
        </DataTable>
      </div>
    </div>
  );
}
