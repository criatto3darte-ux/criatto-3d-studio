import { useEffect, useState } from "react";
import { Badge } from "@/shared/ui/Badge";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { getSupabase } from "@/lib/supabase/client";
import {
  adjustAdminInventory,
  setAdminInventoryMinimum,
} from "@/features/catalog/supabase-catalog";
import { DataTable, Modal, SelectField, adminStyles as s } from "../ui/AdminUI";
import { STOCK_LABEL, STOCK_TONE } from "../ui/labels";
import type { StockState } from "@/features/demo-data/rules";

interface StockRow {
  productId: string;
  name: string;
  mode: "pronta-entrega" | "sob-demanda";
  onHand: number;
  allocated: number;
  minimum: number;
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
  if (row.onHand - row.allocated <= row.minimum) return "baixo";
  return "ok";
}

export function StockPage() {
  const [rows, setRows] = useState<StockRow[]>([]);
  const [movements, setMovements] = useState<MovementRow[]>([]);
  const [filter, setFilter] = useState<"" | StockState>("");
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<StockRow | null>(null);
  const [dialogMode, setDialogMode] = useState<"adjust" | "minimum" | null>(null);
  const [delta, setDelta] = useState("");
  const [minimum, setMinimum] = useState("");
  const [reason, setReason] = useState("");
  const [operationKey, setOperationKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  async function reload() {
    setState("loading");
    setError("");
    try {
      const client = getSupabase();
      const { data: rawRoles, error: rolesError } = await client.rpc("my_roles");
      if (rolesError) throw new Error("A sessão administrativa AAL2 não está válida.");
      const roles = Array.isArray(rawRoles)
        ? rawRoles.filter((role: unknown): role is string => typeof role === "string")
        : [];
      if (!roles.some((role) => role === "proprietario" || role === "operador")) {
        throw new Error("O estoque exige o papel proprietário ou operador com MFA AAL2.");
      }
      const productQuery = roles.includes("proprietario")
        ? client
            .from("products")
            .select("id,name,production_mode")
            .is("archived_at", null)
            .order("name")
        : client.from("public_products").select("id,name,production_mode").order("name");
      const [products, inventory, movementRows] = await Promise.all([
        productQuery,
        client
          .from("inventory")
          .select("product_id,on_hand,allocated,minimum_on_hand,updated_at,version"),
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
          minimum: balance?.minimum_on_hand ?? 0,
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

  function openDialog(row: StockRow, mode: "adjust" | "minimum") {
    setSelected(row);
    setDialogMode(mode);
    setDelta("");
    setMinimum(String(row.minimum));
    setReason("");
    setOperationKey(mode === "adjust" ? crypto.randomUUID() : null);
    setActionError("");
  }

  async function submitStockAction() {
    if (!selected || !dialogMode) return;
    if (dialogMode === "adjust" && !operationKey) {
      setActionError("Identificador da movimentação indisponível. Reabra o formulário.");
      return;
    }
    setBusy(true);
    setActionError("");
    try {
      if (dialogMode === "adjust") {
        const parsedDelta = Number(delta);
        if (!Number.isSafeInteger(parsedDelta) || parsedDelta === 0) {
          setActionError("Informe um ajuste inteiro diferente de zero.");
          return;
        }
        if (!reason.trim()) {
          setActionError("Informe o motivo da movimentação.");
          return;
        }
        await adjustAdminInventory({
          productId: selected.productId,
          delta: parsedDelta,
          reason: reason.trim(),
          operationKey: operationKey!,
          expectedVersion: selected.version,
        });
      } else {
        const parsedMinimum = Number(minimum);
        if (!Number.isSafeInteger(parsedMinimum) || parsedMinimum < 0) {
          setActionError("O estoque mínimo deve ser um número inteiro igual ou maior que zero.");
          return;
        }
        await setAdminInventoryMinimum({
          productId: selected.productId,
          minimum: parsedMinimum,
          expectedVersion: selected.version,
        });
      }
      setDialogMode(null);
      setSelected(null);
      await reload();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Não foi possível salvar o estoque.");
      await reload();
    } finally {
      setBusy(false);
    }
  }

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
        Ajustes usam comandos transacionais AAL2 com controle de versão, idempotência e histórico
        append-only; saldos e mínimos são persistidos pelo Supabase, sem escrita direta pelo
        navegador.
      </p>
      {actionError && !dialogMode && <p role="alert">{actionError}</p>}
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
              <th className={s.num}>Mínimo</th>
              <th>Última movimentação</th>
              <th className={s.num}>Ações</th>
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
                <td className={s.num}>{row.mode === "sob-demanda" ? "—" : row.minimum}</td>
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
                <td className={s.num}>
                  <div className={s.actions}>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy || row.mode === "sob-demanda"}
                      onClick={() => openDialog(row, "adjust")}
                    >
                      Movimentar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy || row.mode === "sob-demanda"}
                      onClick={() => openDialog(row, "minimum")}
                    >
                      Mínimo
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </DataTable>
      )}
      <Modal
        open={dialogMode !== null}
        title={dialogMode === "minimum" ? "Definir estoque mínimo" : "Registrar movimentação"}
        onClose={() => !busy && setDialogMode(null)}
        footer={
          <>
            <Button variant="outline" onClick={() => setDialogMode(null)} disabled={busy}>
              Cancelar
            </Button>
            <Button onClick={() => void submitStockAction()} disabled={busy}>
              {busy ? "Salvando…" : "Confirmar"}
            </Button>
          </>
        }
      >
        {selected && dialogMode === "adjust" && (
          <div className={s.stack}>
            <p>
              {selected.name} · disponível: {Math.max(0, selected.onHand - selected.allocated)} ·
              versão {selected.version}
            </p>
            <Input
              label="Ajuste de quantidade (positivo para entrada, negativo para saída)"
              type="number"
              step={1}
              value={delta}
              onChange={(event) => setDelta(event.target.value)}
            />
            <Input
              label="Motivo"
              maxLength={500}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
        )}
        {selected && dialogMode === "minimum" && (
          <div className={s.stack}>
            <p>
              {selected.name} · mínimo atual: {selected.minimum} · versão {selected.version}
            </p>
            <Input
              label="Estoque mínimo"
              type="number"
              min={0}
              step={1}
              value={minimum}
              onChange={(event) => setMinimum(event.target.value)}
            />
          </div>
        )}
        {actionError && <p role="alert">{actionError}</p>}
      </Modal>
    </div>
  );
}
