import { useState } from "react";
import { Eye, Plus } from "lucide-react";
import { Badge } from "@/shared/ui/Badge";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { formatBRL, maskPhone } from "@/shared/utils/format";
import { ORDER_STATUS_LABEL } from "@/shared/types/order";
import { isValidCustomerPhone, maskPhone as maskTyping, onlyDigits, validateName } from "@/features/checkout/checkout.logic";
import { demoRepository, useDemoData } from "@/features/demo-data/repository";
import { customerStats, newId, orderTotal } from "@/features/demo-data/rules";
import type { DemoCustomer } from "@/features/demo-data/model";
import { DataTable, Modal, TextareaField, adminStyles as s, formatDate } from "../ui/AdminUI";
import { ORDER_STATUS_TONE } from "../ui/labels";

export function CustomersPage() {
  const data = useDemoData();
  const [view, setView] = useState<string | null>(null);
  const [draft, setDraft] = useState<DemoCustomer | null>(null);
  const [err, setErr] = useState<{ name?: string; phone?: string }>({});
  const viewing = data.customers.find((c) => c.id === view);
  const stats = viewing ? customerStats(data, viewing.id) : null;
  const isNew = draft ? !data.customers.some((c) => c.id === draft.id) : false;

  function save() {
    if (!draft) return;
    const e: typeof err = {};
    const n = validateName(draft.name); if (n) e.name = n;
    if (draft.phone && !isValidCustomerPhone(draft.phone) && !draft.phone.startsWith("00")) e.phone = "Telefone de teste inválido (DDD + número).";
    setErr(e);
    if (Object.keys(e).length) return;
    const c = { ...draft, name: draft.name.trim() };
    demoRepository.update((d) => ({ ...d, customers: isNew ? [...d.customers, c] : d.customers.map((x) => (x.id === c.id ? c : x)) }));
    setDraft(null);
  }

  return (
    <div className={s.stack}>
      <div className={s.toolbar}>
        <p className={`${s.muted} ${s.grow}`}>Cadastro interno e fictício. A loja não tem login, senha nem conta de cliente; CPF não é coletado.</p>
        <Button onClick={() => { setErr({}); setDraft({ id: newId("c"), name: "", phone: "", createdAt: new Date().toISOString(), notes: "" }); }}><Plus size={18} /> Novo cliente</Button>
      </div>
      <DataTable label="Clientes" empty={!data.customers.length} head={<><th>Nome</th><th>Telefone</th><th className={s.num}>Pedidos</th><th className={`${s.num} ${s.hideSm}`}>Compras confirmadas</th><th className={s.hideSm}>Primeira compra</th><th className={s.num}>Ações</th></>}>
        {data.customers.map((c) => {
          const st = customerStats(data, c.id);
          return (
            <tr key={c.id}>
              <td>{c.name}</td>
              <td>{c.phone ? maskPhone(c.phone) : "—"}</td>
              <td className={s.num}>{st.count}</td>
              <td className={`${s.num} ${s.hideSm}`}>{formatBRL(st.confirmedTotalCents)}</td>
              <td className={s.hideSm}>{st.firstPurchase ? formatDate(st.firstPurchase) : "—"}</td>
              <td className={s.num}><Button size="sm" variant="outline" onClick={() => setView(c.id)} aria-label={`Ver ${c.name}`}><Eye size={16} /> Ver</Button></td>
            </tr>
          );
        })}
      </DataTable>

      <Modal open={!!viewing} title={viewing?.name ?? ""} onClose={() => setView(null)} footer={<Button variant="outline" onClick={() => { if (viewing) { setErr({}); setDraft({ ...viewing }); setView(null); } }}>Editar</Button>}>
        {viewing && stats && (
          <div className={s.stack}>
            <div className={s.muted}>Telefone: {viewing.phone ? maskPhone(viewing.phone) : "—"} · {stats.count} pedido(s) · Confirmado: {formatBRL(stats.confirmedTotalCents)}</div>
            <DataTable label="Histórico de pedidos" empty={!stats.orders.length} head={<><th>Pedido</th><th>Data</th><th>Status</th><th className={s.num}>Valor</th></>}>
              {stats.orders.map((o) => (
                <tr key={o.id}><td>#{o.number}</td><td>{formatDate(o.createdAt)}</td><td><Badge tone={ORDER_STATUS_TONE[o.status]}>{ORDER_STATUS_LABEL[o.status]}</Badge></td><td className={s.num}>{formatBRL(orderTotal(o))}</td></tr>
              ))}
            </DataTable>
          </div>
        )}
      </Modal>

      <Modal open={!!draft} title={isNew ? "Novo cliente fictício" : "Editar cliente"} onClose={() => setDraft(null)} footer={<><Button variant="outline" onClick={() => setDraft(null)}>Cancelar</Button><Button onClick={save}>Salvar</Button></>}>
        {draft && (
          <div className={s.formGrid}>
            <Input label="Nome" value={draft.name} error={err.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            <Input label="Telefone de teste (opcional)" inputMode="tel" value={maskTyping(draft.phone)} error={err.phone} hint="Use apenas um número de teste seu. Habilita o botão de WhatsApp nos pedidos." onChange={(e) => setDraft({ ...draft, phone: onlyDigits(e.target.value).slice(0, 11) })} />
            <TextareaField className={s.full} label="Observações" value={draft.notes} maxLength={500} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
          </div>
        )}
      </Modal>
    </div>
  );
}
