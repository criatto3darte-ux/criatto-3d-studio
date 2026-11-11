import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { demoRepository, useDemoData } from "@/features/demo-data/repository";
import { activeBanner, newId, validateBanner, type Errors } from "@/features/demo-data/rules";
import type { DemoBanner } from "@/features/demo-data/model";
import { Check, ConfirmDialog, DataTable, Modal, adminStyles as s } from "../ui/AdminUI";
import { cx } from "@/shared/utils/cx";

function Preview({ b, mobile }: { b: DemoBanner; mobile?: boolean }) {
  return (
    <div className={cx(s.previewBox, mobile && s.previewMobile)}>
      <div className={s.muted} style={{ marginBottom: 6 }}>{mobile ? "Prévia mobile" : "Prévia desktop"}</div>
      <div className={s.previewTitle}>{b.title} {b.highlight && <span className="text-gradient">{b.highlight}</span>}</div>
      {b.subtitle && <p className={s.muted}>{b.subtitle}</p>}
      <span className={s.thumbTag} style={{ position: "static", display: "inline-block", fontSize: 12, padding: "4px 10px" }}>{b.buttonText || "Botão"}</span>
      {b.image ? <img className={s.previewImg} src={b.image} alt="" /> : <div className={s.muted} style={{ marginTop: 8 }}>Sem imagem (o cubo animado é exibido).</div>}
    </div>
  );
}

export function BannersPage() {
  const data = useDemoData();
  const list = [...data.banners].sort((a, b) => a.order - b.order);
  const shown = activeBanner(data.banners);
  const [draft, setDraft] = useState<DemoBanner | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [del, setDel] = useState<DemoBanner | null>(null);
  const isNew = draft ? !data.banners.some((b) => b.id === draft.id) : false;

  function save() {
    if (!draft) return;
    const b = { ...draft, title: draft.title.trim(), highlight: draft.highlight.trim(), buttonUrl: draft.buttonUrl.trim(), image: draft.image.trim() };
    const e = validateBanner(b);
    setErrors(e);
    if (Object.keys(e).length) return;
    demoRepository.update((d) => ({ ...d, banners: isNew ? [...d.banners, b] : d.banners.map((x) => (x.id === b.id ? b : x)) }));
    setDraft(null);
  }
  const set = (p: Partial<DemoBanner>) => setDraft((d) => (d ? { ...d, ...p } : d));

  return (
    <div className={s.stack}>
      <div className={s.toolbar}>
        <p className={`${s.muted} ${s.grow}`}>A página inicial mostra o primeiro banner ativo pela ordem. O layout do topo da loja não muda; só textos, botão e imagem.</p>
        <Button onClick={() => { setErrors({}); setDraft({ id: newId("b"), title: "", highlight: "", subtitle: "", image: "", buttonText: "Explorar produtos", buttonUrl: "/produtos", order: list.length + 1, active: false }); }}><Plus size={18} /> Novo banner</Button>
      </div>
      <DataTable label="Banners" empty={!list.length} head={<><th>Ordem</th><th>Título</th><th className={s.hideSm}>Botão</th><th>Status</th><th className={s.num}>Ações</th></>}>
        {list.map((b) => (
          <tr key={b.id}>
            <td>{b.order}</td>
            <td><strong>{b.title} {b.highlight}</strong>{shown?.id === b.id && <div className={s.muted}>Exibido na loja</div>}</td>
            <td className={s.hideSm}>{b.buttonText} → {b.buttonUrl}</td>
            <td><Check label={b.active ? "Ativo" : "Inativo"} checked={b.active} onChange={(v) => demoRepository.update((d) => ({ ...d, banners: d.banners.map((x) => (x.id === b.id ? { ...x, active: v } : x)) }))} /></td>
            <td className={s.num}><div className={s.actions}>
              <Button size="icon" variant="ghost" aria-label={`Editar banner ${b.title}`} onClick={() => { setErrors({}); setDraft({ ...b }); }}><Pencil size={16} /></Button>
              <Button size="icon" variant="ghost" aria-label={`Excluir banner ${b.title}`} onClick={() => setDel(b)}><Trash2 size={16} /></Button>
            </div></td>
          </tr>
        ))}
      </DataTable>

      <Modal open={!!draft} title={isNew ? "Novo banner" : "Editar banner"} onClose={() => setDraft(null)} footer={<><Button variant="outline" onClick={() => setDraft(null)}>Cancelar</Button><Button onClick={save}>Salvar</Button></>}>
        {draft && (
          <div className={s.stack}>
            <div className={s.formGrid}>
              <Input label="Título" value={draft.title} error={errors.title} onChange={(e) => set({ title: e.target.value })} />
              <Input label="Destaque colorido (opcional)" value={draft.highlight} onChange={(e) => set({ highlight: e.target.value })} />
              <Input className={s.full} label="Subtítulo" value={draft.subtitle} error={errors.subtitle} onChange={(e) => set({ subtitle: e.target.value })} />
              <Input label="Texto do botão" value={draft.buttonText} error={errors.buttonText} onChange={(e) => set({ buttonText: e.target.value })} />
              <Input label="URL do botão" value={draft.buttonUrl} error={errors.buttonUrl} onChange={(e) => set({ buttonUrl: e.target.value })} />
              <Input label="Imagem (caminho ou https://)" placeholder="/images/banner/hero.jpg" value={draft.image} error={errors.image} onChange={(e) => set({ image: e.target.value })} />
              <Input label="Ordem de exibição" type="number" min={0} value={String(draft.order)} error={errors.order} onChange={(e) => set({ order: Number(e.target.value) })} />
              <Check label="Ativo" checked={draft.active} onChange={(v) => set({ active: v })} />
            </div>
            <div className={s.preview}><Preview b={draft} /><Preview b={draft} mobile /></div>
          </div>
        )}
      </Modal>
      <ConfirmDialog open={!!del} danger title="Excluir banner" confirmLabel="Excluir" text={`Excluir o banner "${del?.title ?? ""}"?`} onCancel={() => setDel(null)}
        onConfirm={() => { const id = del!.id; demoRepository.update((d) => ({ ...d, banners: d.banners.filter((b) => b.id !== id) })); setDel(null); }} />
    </div>
  );
}
