import { useEffect, useState } from "react";
import { Badge } from "@/shared/ui/Badge";
import { Button } from "@/shared/ui/Button";
import { getSupabase } from "@/lib/supabase/client";
import { DataTable, SelectField, adminStyles as s } from "../ui/AdminUI";
import { STOCK_LABEL, STOCK_TONE } from "../ui/labels";
import type { StockState } from "@/features/demo-data/rules";

interface StockRow {
  productId: string;
  name: string;
  mode: "pronta-entrega" | "sob-demanda";
  onHand: number;
  allocated: number;
  updatedAt: string;
  version: number;
}
interface MovementRow {
  product_id: string;
  kind: string;
  quantity: number;
  reason: string;
  created_at: string;
}

function stockState(row: StockRow): StockState {
  if (row.mode === "sob-demanda") return "sob-demanda";
  if (row.onHand <= row.allocated) return "esgotado";
  if (row.onHand - row.allocated <= 5) return "baixo";
  return "ok";
}

export function StockPage() {
  const [rows, setRows] = useState<StockRow[]>([]);
  const [movements, setMovements] = useState<MovementRow[]>([]);
  const [filter, setFilter] = useState<"" | StockState>("");
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");

  async function reload() {
    setState("loading");
    setError("");
    try {
      const client = getSupabase();
      const [products, inventory, movementRows] = await Promise.all([
        client
          .from("products")
          .select("id,name,production_mode,active")
          .is("archived_at", null)
          .order("name"),
        client.from("inventory").select("product_id,on_hand,allocated,updated_at,version"),
        client
          .from("inventory_movements")
          .select("product_id,kind,quantity,reason,created_at")
          .order("created_at", { ascending: false })
          .limit(100),
      ]);
      const failure = products.error ?? inventory.error ?? movementRows.error;
      if (failure) {
        if (failure.code === "42501" || failure.code === "PGRST301")
          throw new Error(
            "A lista de estoque exige uma sessão administrativa AAL2 com papel proprietário ou operador.",
          );
        throw new Error("Não foi possível carregar o estoque e o histórico.");
      }
      const balanceByProduct = new Map(
        (inventory.data ?? []).map((item) => [item.product_id, item]),
      );
      const nextRows = (products.data ?? []).map((product) => {
        const balance = balanceByProduct.get(product.id);
        return {
          productId: product.id,
          name: product.name,
          mode: product.production_mode,
          onHand: balance?.on_hand ?? 0,
          allocated: balance?.allocated ?? 0,
          updatedAt: balance?.updated_at ?? "",
          version: balance?.version ?? 0,
        } as StockRow;
      });
      setRows(nextRows);
      setMovements((movementRows.data ?? []) as MovementRow[]);
      setState("ready");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível consultar o estoque.");
      setState("error");
    }
  }

  useEffect(() => {
    void reload();
  }, []);
  const list = rows.filter((row) => !filter || stockState(row) === filter);

  return (
    <div className={s.stack}>
      <div className={s.toolbar}>
        <SelectField
          label="Situação"
          value={filter}
          onChange={(event) => setFilter(event.target.value as StockState | "")}
        >
          <option value="">Todas</option>
          {Object.entries(STOCK_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </SelectField>
        <p className={`${s.muted} ${s.grow}`}>
          Saldo persistido: estoque físico menos quantidades alocadas. A vitrine expõe apenas
          disponibilidade, nunca o saldo exato.
        </p>
        <Button variant="outline" onClick={() => void reload()} disabled={state === "loading"}>
          Atualizar
        </Button>
      </div>
      <p role="note">
        Ajustes estão bloqueados até existir uma RPC transacional autorizada para registrar saldo,
        movimento e versão em conjunto. Não há escrita direta nem fallback local.
      </p>
      {state === "loading" && <p role="status">Consultando estoque do Supabase…</p>}
      {state === "error" && <p role="alert">{error}</p>}
      {state === "ready" && (
        <DataTable
          label="Estoque"
          empty={!list.length}
          head={
            <>
              <th>Produto</th>
              <th>Situação</th>
              <th className={s.num}>Disponível</th>
              <th className={s.num}>Físico</th>
              <th className={s.num}>Alocado</th>
              <th>Última movimentação</th>
            </>
          }
        >
          {list.map((row) => {
            const status = stockState(row);
            const latest = movements.find((movement) => movement.product_id === row.productId);
            return (
              <tr key={row.productId}>
                <td>
                  <strong>{row.name}</strong>
                </td>
                <td>
                  <Badge tone={STOCK_TONE[status]}>{STOCK_LABEL[status]}</Badge>
                  {row.mode === "sob-demanda" && <div className={s.muted}>Sob encomenda</div>}
                </td>
                <td className={s.num}>
                  {row.mode === "sob-demanda" ? "—" : Math.max(0, row.onHand - row.allocated)}
                </td>
                <td className={s.num}>{row.mode === "sob-demanda" ? "—" : row.onHand}</td>
                <td className={s.num}>{row.mode === "sob-demanda" ? "—" : row.allocated}</td>
                <td>
                  {latest ? (
                    <>
                      <span>
                        {latest.kind}: {latest.quantity}
                      </span>
                      <div className={s.muted}>
                        {latest.reason} · {new Date(latest.created_at).toLocaleString("pt-BR")}
                      </div>
                    </>
                  ) : (
                    <span className={s.muted}>Sem movimentações</span>
                  )}
                </td>
              </tr>
            );
          })}
        </DataTable>
      )}
    </div>
  );
}
