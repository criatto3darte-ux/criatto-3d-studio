import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/shared/ui/Badge";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { formatBRL } from "@/shared/utils/format";
import { demoRepository, useDemoData } from "@/features/demo-data/repository";
import { couponState, newId, validateCoupon, type Errors } from "@/features/demo-data/rules";
import type { CouponKind, DemoCoupon } from "@/features/demo-data/model";
import { Check, ConfirmDialog, DataTable, Modal, SelectField, adminStyles as s, centsToInput, formatDate, parseMoney } from "../ui/AdminUI";

const STATE_TONE = { ativo: "success", agendado: "cyan", expirado: "neutral", inativo: "neutral" } as const;
const localToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

export function CouponsPage() {
  const data = useDemoData();
  const [draft, setDraft] = useState<(DemoCoupon & { valueText: string; limitText: string }) | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [del, setDel] = useState<DemoCoupon | null>(null);
  const today = localToday();
  const isNew = draft ? !data.coupons.some((c) => c.id === draft.id) : false;

  function save() {
    if (!draft) return;
    const { valueText, limitText, ...rest } = draft;
    const value = rest.kind === "fixo" ? parseMoney(valueText) : Number(valueText);
    const c: DemoCoupon = { ...rest, code: rest.code.trim().toUpperCase(), value: Number.isNaN(value) ? 0 : value, usageLimit: limitText.trim() ? Number(limitText) : null };
    const e = validateCoupon(c, data.coupons);
    setErrors(e);
    if (Object.keys(e).length) return;
    demoRepository.update((d) => ({ ...d, coupons: isNew ? [...d.coupons, c] : d.coupons.map((x) => (x.id === c.id ? c : x)) }));
    setDraft(null);
  }
  const edit = (c: DemoCoupon) => { setErrors({}); setDraft({ ...c, valueText: c.kind === "fixo" ? centsToInput(c.value) : String(c.value), limitText: c.usageLimit ? String(c.usageLimit) : "" }); };

  return (
    <div className={s.stack}>
      <div className={s.toolbar}>
        <p className={`${s.muted} ${s.grow}`}>Cupons demonstrativos: ainda <strong>não são aplicados</strong> no carrinho nem no checkout.</p>
        <Button onClick={() => edit({ id: newId("k"), code: "", kind: "percentual", value: 10, startsAt: today, endsAt: today, active: true, usageLimit: null })}><Plus size={18} /> Novo cupom</Button>
      </div>
      <DataTable label="Cupons" empty={!data.coupons.length} head={<><th>Código</th><th>Desconto</th><th className={s.hideSm}>Vigência</th><th className={s.hideSm}>Limite</th><th>Situação</th><th className={s.num}>Ações</th></>}>
        {data.coupons.map((c) => {
          const st = couponState(c, today);
          return (
            <tr key={c.id}>
              <td><strong>{c.code}</strong></td>
              <td>{c.kind === "percentual" ? `${c.value}%` : formatBRL(c.value)}</td>
              <td className={s.hideSm}>{formatDate(c.startsAt + "T12:00:00")} – {formatDate(c.endsAt + "T12:00:00")}</td>
              <td className={s.hideSm}>{c.usageLimit ?? "Sem limite"}</td>
              <td><Badge tone={STATE_TONE[st]}>{st[0]!.toUpperCase() + st.slice(1)}</Badge></td>
              <td className={s.num}><div className={s.actions}>
                <Button size="icon" variant="ghost" aria-label={`Editar ${c.code}`} onClick={() => edit(c)}><Pencil size={16} /></Button>
                <Button size="icon" variant="ghost" aria-label={`Excluir ${c.code}`} onClick={() => setDel(c)}><Trash2 size={16} /></Button>
              </div></td>
            </tr>
          );
        })}
      </DataTable>
      <Modal open={!!draft} title={isNew ? "Novo cupom" : "Editar cupom"} onClose={() => setDraft(null)} footer={<><Button variant="outline" onClick={() => setDraft(null)}>Cancelar</Button><Button onClick={save}>Salvar</Button></>}>
        {draft && (
          <div className={s.formGrid}>
            <Input label="Código" value={draft.code} error={errors.code} onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase().replace(/\s/g, "") })} />
            <SelectField label="Tipo de desconto" value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as CouponKind, valueText: "" })}>
              <option value="percentual">Percentual (%)</option>
              <option value="fixo">Valor fixo (R$)</option>
            </SelectField>
            <Input label={draft.kind === "percentual" ? "Desconto (%)" : "Desconto (R$)"} inputMode="decimal" value={draft.valueText} error={errors.value} onChange={(e) => setDraft({ ...draft, valueText: e.target.value })} />
            <Input label="Limite de utilização (opcional)" type="number" min={1} value={draft.limitText} error={errors.usageLimit} onChange={(e) => setDraft({ ...draft, limitText: e.target.value })} />
            <Input label="Início" type="date" value={draft.startsAt} error={errors.startsAt} onChange={(e) => setDraft({ ...draft, startsAt: e.target.value })} />
            <Input label="Término" type="date" value={draft.endsAt} error={errors.endsAt} onChange={(e) => setDraft({ ...draft, endsAt: e.target.value })} />
            <Check label="Ativo" checked={draft.active} onChange={(v) => setDraft({ ...draft, active: v })} />
          </div>
        )}
      </Modal>
      <ConfirmDialog open={!!del} danger title="Excluir cupom" confirmLabel="Excluir" text={`Excluir o cupom ${del?.code ?? ""}?`} onCancel={() => setDel(null)}
        onConfirm={() => { const id = del!.id; demoRepository.update((d) => ({ ...d, coupons: d.coupons.filter((c) => c.id !== id) })); setDel(null); }} />
    </div>
  );
}
