import { useState } from "react";
import { Pencil } from "lucide-react";
import { Badge } from "@/shared/ui/Badge";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { formatBRL } from "@/shared/utils/format";
import { demoRepository, useDemoData } from "@/features/demo-data/repository";
import { CUSTOM_STATUS_LABEL, type CustomRequestStatus, type DemoCustomRequest } from "@/features/demo-data/model";
import { DataTable, Modal, SelectField, TextareaField, adminStyles as s, centsToInput, formatDate, parseMoney } from "../ui/AdminUI";

export function CustomRequestsPage() {
  const data = useDemoData();
  const [draft, setDraft] = useState<(DemoCustomRequest & { quote: string }) | null>(null);
  const [err, setErr] = useState("");

  function save() {
    if (!draft) return;
    const { quote, ...rest } = draft;
    const cents = quote.trim() ? parseMoney(quote) : null;
    if (cents !== null && (Number.isNaN(cents) || cents <= 0)) { setErr("Orçamento inválido."); return; }
    if (!Number.isInteger(rest.quantity) || rest.quantity < 1) { setErr("Quantidade inválida."); return; }
    const next: DemoCustomRequest = { ...rest, quoteCents: cents };
    demoRepository.update((d) => ({ ...d, customRequests: d.customRequests.map((r) => (r.id === next.id ? next : r)) }));
    setDraft(null);
  }

  return (
    <div className={s.stack}>
      <p className={s.muted}>Solicitações fictícias. O orçamento é sempre manual — o sistema não calcula preço de personalizados. Solicitações reais chegam pelo WhatsApp.</p>
      <DataTable label="Personalizações" empty={!data.customRequests.length} head={<><th>Solicitação</th><th className={s.hideSm}>Cliente</th><th>Status</th><th className={s.num}>Orçamento</th><th className={s.num}>Ações</th></>}>
        {data.customRequests.map((r) => (
          <tr key={r.id}>
            <td><strong>{r.productName}</strong><div className={s.muted}>{formatDate(r.createdAt)} · {r.quantity} un.</div></td>
            <td className={s.hideSm}>{r.customerName}</td>
            <td><Badge tone={r.status === "cancelado" ? "danger" : r.status === "concluido" ? "success" : "primary"}>{CUSTOM_STATUS_LABEL[r.status]}</Badge></td>
            <td className={s.num}>{r.quoteCents ? formatBRL(r.quoteCents) : "A definir"}</td>
            <td className={s.num}><Button size="icon" variant="ghost" aria-label={`Editar ${r.productName}`} onClick={() => { setErr(""); setDraft({ ...r, quote: centsToInput(r.quoteCents) }); }}><Pencil size={16} /></Button></td>
          </tr>
        ))}
      </DataTable>
      <Modal open={!!draft} title="Solicitação de personalização" onClose={() => setDraft(null)} footer={<><Button variant="outline" onClick={() => setDraft(null)}>Cancelar</Button><Button onClick={save}>Salvar</Button></>}>
        {draft && (
          <div className={s.formGrid}>
            <Input label="Produto" value={draft.productName} onChange={(e) => setDraft({ ...draft, productName: e.target.value })} />
            <Input label="Cor" value={draft.color} onChange={(e) => setDraft({ ...draft, color: e.target.value })} />
            <Input label="Dimensões" value={draft.dimensions} onChange={(e) => setDraft({ ...draft, dimensions: e.target.value })} />
            <Input label="Quantidade" type="number" min={1} value={String(draft.quantity)} onChange={(e) => setDraft({ ...draft, quantity: Number(e.target.value) })} />
            <SelectField label="Status" value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as CustomRequestStatus })}>
              {Object.entries(CUSTOM_STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </SelectField>
            <Input label="Orçamento manual (R$)" inputMode="decimal" placeholder="A definir" value={draft.quote} error={err || undefined} onChange={(e) => setDraft({ ...draft, quote: e.target.value })} />
            <TextareaField className={s.full} label="Descrição" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            <Input className={s.full} label="Referência visual (fictícia)" placeholder="/images/referencias/exemplo.jpg" value={draft.referenceImage} onChange={(e) => setDraft({ ...draft, referenceImage: e.target.value })} hint="Imagens reais são enviadas pelo cliente no WhatsApp." />
          </div>
        )}
      </Modal>
    </div>
  );
}
