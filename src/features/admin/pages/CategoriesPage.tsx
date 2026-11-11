import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import type { Category } from "@/shared/types/catalog";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { demoRepository, useDemoData } from "@/features/demo-data/repository";
import { deleteCategory, slugify, sortedCategories, validateCategory, type Errors } from "@/features/demo-data/rules";
import { Check, ConfirmDialog, DataTable, Modal, SelectField, TextareaField, adminStyles as s } from "../ui/AdminUI";

export function AdminCategoriesPage() {
  const data = useDemoData();
  const cats = sortedCategories(data.categories);
  const [draft, setDraft] = useState<{ cat: Category; original?: string } | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [del, setDel] = useState<Category | null>(null);
  const [moveTo, setMoveTo] = useState("");
  const [delError, setDelError] = useState("");
  const count = (slug: string) => data.products.filter((p) => p.category === slug).length;

  function save() {
    if (!draft) return;
    const cat = { ...draft.cat, name: draft.cat.name.trim() };
    const e = validateCategory(cat, data.categories, draft.original);
    setErrors(e);
    if (Object.keys(e).length) return;
    const orig = draft.original;
    demoRepository.update((d) => ({
      ...d,
      categories: orig ? d.categories.map((c) => (c.slug === orig ? cat : c)) : [...d.categories, cat],
      // Renaming the slug keeps products linked.
      products: orig && orig !== cat.slug ? d.products.map((p) => (p.category === orig ? { ...p, category: cat.slug } : p)) : d.products,
    }));
    setDraft(null);
  }

  function confirmDelete() {
    if (!del) return;
    try {
      const target = del.slug;
      demoRepository.update((d) => deleteCategory(d, target, moveTo || undefined));
      setDel(null);
    } catch (e) {
      setDelError(e instanceof Error ? e.message : "Não foi possível excluir.");
    }
  }

  const move = (slug: string, dir: -1 | 1) => {
    const i = cats.findIndex((c) => c.slug === slug);
    const j = i + dir;
    if (j < 0 || j >= cats.length) return;
    const order = cats.map((c) => c.slug);
    [order[i], order[j]] = [order[j]!, order[i]!];
    demoRepository.update((d) => ({ ...d, categories: d.categories.map((c) => ({ ...c, order: order.indexOf(c.slug) + 1 })) }));
  };

  return (
    <div className={s.stack}>
      <div className={s.toolbar}>
        <p className={`${s.muted} ${s.grow}`}>Categorias inativas ficam ocultas na loja junto com seus produtos.</p>
        <Button onClick={() => { setErrors({}); setDraft({ cat: { slug: "", name: "", description: "", active: true, order: cats.length + 1 } }); }}><Plus size={18} /> Nova categoria</Button>
      </div>
      <DataTable label="Categorias" empty={!cats.length} head={<><th>Ordem</th><th>Categoria</th><th className={s.num}>Produtos</th><th>Ativa</th><th className={s.num}>Ações</th></>}>
        {cats.map((c, i) => (
          <tr key={c.slug}>
            <td>
              <div className={s.inline}>
                <Button size="sm" variant="ghost" aria-label={`Subir ${c.name}`} disabled={i === 0} onClick={() => move(c.slug, -1)}>↑</Button>
                <Button size="sm" variant="ghost" aria-label={`Descer ${c.name}`} disabled={i === cats.length - 1} onClick={() => move(c.slug, 1)}>↓</Button>
              </div>
            </td>
            <td><strong>{c.name}</strong><div className={s.muted}>/{c.slug}</div></td>
            <td className={s.num}>{count(c.slug)}</td>
            <td><Check label={c.active ? "Sim" : "Não"} checked={c.active} onChange={(v) => demoRepository.update((d) => ({ ...d, categories: d.categories.map((x) => (x.slug === c.slug ? { ...x, active: v } : x)) }))} /></td>
            <td className={s.num}>
              <div className={s.actions}>
                <Button size="icon" variant="ghost" aria-label={`Editar ${c.name}`} onClick={() => { setErrors({}); setDraft({ cat: { ...c }, original: c.slug }); }}><Pencil size={16} /></Button>
                <Button size="icon" variant="ghost" aria-label={`Excluir ${c.name}`} onClick={() => { setDel(c); setMoveTo(""); setDelError(""); }}><Trash2 size={16} /></Button>
              </div>
            </td>
          </tr>
        ))}
      </DataTable>

      <Modal open={!!draft} title={draft?.original ? "Editar categoria" : "Nova categoria"} onClose={() => setDraft(null)} footer={<><Button variant="outline" onClick={() => setDraft(null)}>Cancelar</Button><Button onClick={save}>Salvar</Button></>}>
        {draft && (
          <div className={s.formGrid}>
            <Input label="Nome" value={draft.cat.name} error={errors.name} onChange={(e) => { const name = e.target.value; setDraft((d) => d && { ...d, cat: { ...d.cat, name, ...(d.original ? {} : { slug: slugify(name) }) } }); }} />
            <Input label="Slug" value={draft.cat.slug} error={errors.slug} onChange={(e) => setDraft((d) => d && { ...d, cat: { ...d.cat, slug: e.target.value.toLowerCase() } })} />
            <Input label="Ordem de exibição" type="number" min={0} value={String(draft.cat.order)} error={errors.order} onChange={(e) => setDraft((d) => d && { ...d, cat: { ...d.cat, order: Number(e.target.value) } })} />
            <TextareaField className={s.full} label="Descrição" value={draft.cat.description} onChange={(e) => setDraft((d) => d && { ...d, cat: { ...d.cat, description: e.target.value } })} />
            <Check label="Ativa na loja" checked={draft.cat.active} onChange={(v) => setDraft((d) => d && { ...d, cat: { ...d.cat, active: v } })} />
          </div>
        )}
      </Modal>

      <ConfirmDialog open={!!del} danger title="Excluir categoria" confirmLabel="Excluir" onCancel={() => setDel(null)} onConfirm={confirmDelete}
        text={del && count(del.slug) ? `"${del.name}" possui ${count(del.slug)} produto(s). Escolha para onde transferi-los antes de excluir.` : `Excluir a categoria "${del?.name ?? ""}"?`}>
        {del && count(del.slug) > 0 && (
          <div style={{ marginTop: 16 }}>
            <SelectField label="Transferir produtos para" value={moveTo} onChange={(e) => setMoveTo(e.target.value)} error={delError || undefined}>
              <option value="">Selecione…</option>
              {cats.filter((c) => c.slug !== del.slug).map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </SelectField>
          </div>
        )}
      </ConfirmDialog>
    </div>
  );
}
