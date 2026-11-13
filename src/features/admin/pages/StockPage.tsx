import { useState } from "react";
import { Badge } from "@/shared/ui/Badge";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { demoRepository, useDemoData } from "@/features/demo-data/repository";
import { adjustProductStock, LOW_STOCK_THRESHOLD, stockState, type StockState } from "@/features/demo-data/rules";
import { DataTable, SelectField, adminStyles as s } from "../ui/AdminUI";
import { STOCK_LABEL, STOCK_TONE } from "../ui/labels";

function setStock(id: string, stock: number) {
  demoRepository.update((d) => ({ ...d, products: d.products.map((p) => (p.id === id ? adjustProductStock(p, stock) : p)) }));
}

export function StockPage() {
  const data = useDemoData();
  const [filter, setFilter] = useState<"" | StockState>("");
  const list = data.products.filter((p) => !filter || stockState(p) === filter);
  return (
    <div className={s.stack}>
      <div className={s.toolbar}>
        <SelectField label="Situação" value={filter} onChange={(e) => setFilter(e.target.value as StockState | "")}>
          <option value="">Todas</option>
          {Object.entries(STOCK_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </SelectField>
        <p className={`${s.muted} ${s.grow}`}>Estoque baixo: até {LOW_STOCK_THRESHOLD} unidades. Abrir o WhatsApp não baixa estoque; a baixa real dependerá da confirmação do pedido no backend.</p>
      </div>
      <DataTable label="Estoque" empty={!list.length} head={<><th>Produto</th><th>Situação</th><th className={s.num}>Quantidade</th><th className={s.num}>Ajustar</th></>}>
        {list.map((p) => {
          const st = stockState(p);
          return (
            <tr key={p.id}>
              <td><strong>{p.name}</strong>{!p.active && <div className={s.muted}>Não publicado</div>}</td>
              <td><Badge tone={STOCK_TONE[st]}>{STOCK_LABEL[st]}</Badge>{st === "sob-demanda" && <div className={s.muted}>Produção: {p.productionDays ?? "—"} dias</div>}</td>
              <td className={s.num}>{st === "sob-demanda" ? "Não se aplica" : p.stock}</td>
              <td className={s.num}>
                {st === "sob-demanda" ? <span className={s.muted}>Sob encomenda</span> : <div className={s.actions} style={{ alignItems: "center" }}>
                  <Button size="sm" variant="outline" aria-label={`Diminuir estoque de ${p.name}`} onClick={() => setStock(p.id, p.stock - 1)} disabled={p.stock <= 0}>−1</Button>
                  <Button size="sm" variant="outline" aria-label={`Aumentar estoque de ${p.name}`} onClick={() => setStock(p.id, p.stock + 1)}>+1</Button>
                  <Input aria-label={`Definir estoque de ${p.name}`} type="number" min={0} style={{ width: 90 }} defaultValue={p.stock} key={p.stock}
                    onBlur={(e) => { const n = Number(e.target.value); if (Number.isFinite(n) && n !== p.stock) setStock(p.id, n); }}
                    onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
                </div>}
              </td>
            </tr>
          );
        })}
      </DataTable>
    </div>
  );
}
