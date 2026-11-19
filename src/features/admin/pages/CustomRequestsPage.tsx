import { useEffect, useState } from "react";
import { Badge } from "@/shared/ui/Badge";
import { formatBRL } from "@/shared/utils/format";
import { getSupabase } from "@/lib/supabase/client";
import { CUSTOM_STATUS_LABEL, type CustomRequestStatus } from "@/features/demo-data/model";
import { DataTable, adminStyles as s, formatDate } from "../ui/AdminUI";

interface RequestRow {
  id: string;
  created_at: string;
  customer_name_snapshot: string;
  description: string;
  quantity: number;
  status: CustomRequestStatus;
  quote_cents: number | null;
}

export function CustomRequestsPage() {
  const [rows, setRows] = useState<RequestRow[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      const { data, error: loadError } = await getSupabase()
        .from("custom_requests")
        .select("id,created_at,customer_name_snapshot,description,quantity,status,quote_cents")
        .order("created_at", { ascending: false })
        .limit(200);
      if (loadError) {
        setError("Não foi possível carregar as solicitações. Confira o acesso com MFA (AAL2).");
        return;
      }
      setRows((data ?? []) as RequestRow[]);
    })();
  }, []);

  if (error) return <p role="alert">{error}</p>;
  if (!rows) return <p aria-busy="true">Carregando solicitações…</p>;

  return (
    <div className={s.stack}>
      <p className={s.muted}>
        Os pedidos de produtos personalizados chegam pelo WhatsApp, a partir da página
        “Produtos personalizados” da loja. O orçamento é sempre manual. Esta lista mostra apenas
        solicitações registradas no sistema.
      </p>
      <DataTable label="Personalizações" empty={!rows.length} head={<><th>Solicitação</th><th className={s.hideSm}>Cliente</th><th>Status</th><th className={s.num}>Orçamento</th></>}>
        {rows.map((r) => (
          <tr key={r.id}>
            <td><strong>{r.description.slice(0, 80)}</strong><div className={s.muted}>{formatDate(r.created_at)} · {r.quantity} un.</div></td>
            <td className={s.hideSm}>{r.customer_name_snapshot}</td>
            <td><Badge tone={r.status === "cancelado" ? "danger" : r.status === "concluido" ? "success" : "primary"}>{CUSTOM_STATUS_LABEL[r.status]}</Badge></td>
            <td className={s.num}>{r.quote_cents ? formatBRL(r.quote_cents) : "A definir"}</td>
          </tr>
        ))}
      </DataTable>
    </div>
  );
}
