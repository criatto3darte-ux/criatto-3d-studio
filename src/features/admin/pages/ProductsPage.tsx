import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import type { Product, ProductAvailability, ProductVariantGroup } from "@/shared/types/catalog";
import { Badge } from "@/shared/ui/Badge";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { formatBRL } from "@/shared/utils/format";
import { AVAILABILITY_LABEL, normalize } from "@/features/catalog/catalog.logic";
import { demoRepository, useDemoData } from "@/features/demo-data/repository";
import { newId, slugify, sortedCategories, stockState, validateProduct, type Errors } from "@/features/demo-data/rules";
import { Check, ConfirmDialog, DataTable, Modal, SelectField, TextareaField, adminStyles as s, centsToInput, parseMoney } from "../ui/AdminUI";
import { ImageManager } from "../ui/ImageManager";
import { STOCK_LABEL, STOCK_TONE } from "../ui/labels";

interface Draft {
  product: Product;
  price: string;
  promo: string;
  colors: string;
  sizes: string;
  isNew: boolean;
  slugTouched: boolean;
}

const listToGroup = (id: string, name: ProductVariantGroup["name"], csv: string): ProductVariantGroup | null => {
  const labels = [...new Set(csv.split(",").map((x) => x.trim()).filter(Boolean))];
  return labels.length ? { id, name, options: labels.map((l) => ({ id: slugify(l) || l, label: l })) } : null;
};
const groupToList = (p: Product, name: string) => p.variants.find((g) => g.name === name)?.options.map((o) => o.label).join(", ") ?? "";

function toDraft(p: Product, isNew: boolean): Draft {
  return { product: p, price: centsToInput(p.priceCents || null), promo: centsToInput(p.promoPriceCents), colors: groupToList(p, "Cor"), sizes: groupToList(p, "Tamanho"), isNew, slugTouched: !isNew };
}

export function ProductsPage() {
  const data = useDemoData();
  const cats = sortedCategories(data.categories);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [avail, setAvail] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [toDelete, setToDelete] = useState<Product | null>(null);

  const list = useMemo(() => {
    const t = normalize(q.trim());
    return data.products.filter((p) => (!t || normalize(p.name + " " + p.slug).includes(t)) && (!cat || p.category === cat) && (!avail || p.availability === avail));
  }, [data.products, q, cat, avail]);

  const catName = (slug: string) => data.categories.find((c) => c.slug === slug)?.name ?? "—";
  const patch = (p: Partial<Product>) => setDraft((d) => (d ? { ...d, product: { ...d.product, ...p } } : d));
  const toggle = (id: string, key: "active" | "featured") =>
    demoRepository.update((d) => ({ ...d, products: d.products.map((p) => (p.id === id ? { ...p, [key]: !p[key] } : p)) }));

  function openNew() {
    setErrors({});
    setDraft(toDraft({ id: newId("p"), slug: "", name: "", category: cats[0]?.slug ?? "", tags: [], description: "", priceCents: 0, images: [], availability: "pronta-entrega", stock: 0, featured: false, active: true, variants: [] }, true));
  }

  function save() {
    if (!draft) return;
    const priceCents = parseMoney(draft.price);
    const promo = draft.promo.trim() ? parseMoney(draft.promo) : undefined;
    const variants = [listToGroup("cor", "Cor", draft.colors), listToGroup("tamanho", "Tamanho", draft.sizes)].filter((g): g is ProductVariantGroup => !!g);
    const { promoPriceCents: _drop, productionDays: _pd, ...rest } = draft.product;
    const product: Product = {
      ...rest,
      name: rest.name.trim(),
      priceCents: Number.isNaN(priceCents) ? 0 : priceCents,
      ...(promo !== undefined ? { promoPriceCents: Number.isNaN(promo) ? -1 : promo } : {}),
      ...(draft.product.availability === "sob-demanda" ? { productionDays: draft.product.productionDays ?? 0 } : draft.product.productionDays ? { productionDays: draft.product.productionDays } : {}),
      variants,
    };
    const e = validateProduct(product, data.products, data.categories);
    setErrors(e);
    if (Object.keys(e).length) return;
    demoRepository.update((d) => ({ ...d, products: draft.isNew ? [...d.products, product] : d.products.map((p) => (p.id === product.id ? product : p)) }));
    setDraft(null);
  }

  return (
    <div className={s.stack}>
      <div className={s.toolbar}>
        <Input className={s.grow} label="Pesquisar" placeholder="Nome ou slug" value={q} onChange={(e) => setQ(e.target.value)} />
        <SelectField label="Categoria" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">Todas</option>
          {cats.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
        </SelectField>
        <SelectField label="Disponibilidade" value={avail} onChange={(e) => setAvail(e.target.value)}>
          <option value="">Todas</option>
          {Object.entries(AVAILABILITY_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </SelectField>
        <Button onClick={openNew}><Plus size={18} /> Novo produto</Button>
      </div>
      <p className={s.muted}>{list.length} de {data.products.length} produtos (demonstração)</p>
      <DataTable label="Produtos" empty={!list.length} head={<><th>Produto</th><th className={s.hideSm}>Categoria</th><th className={s.num}>Preço</th><th className={s.hideSm}>Estoque</th><th>Publicado</th><th className={s.hideSm}>Destaque</th><th className={s.num}>Ações</th></>}>
        {list.map((p) => {
          const st = stockState(p);
          return (
            <tr key={p.id}>
              <td><strong>{p.name}</strong><div className={s.muted}>/{p.slug}</div></td>
              <td className={s.hideSm}>{catName(p.category)}</td>
              <td className={s.num}>{p.promoPriceCents ? <><s className={s.muted}>{formatBRL(p.priceCents)}</s><br />{formatBRL(p.promoPriceCents)}</> : formatBRL(p.priceCents)}</td>
              <td className={s.hideSm}><Badge tone={STOCK_TONE[st]}>{st === "sob-demanda" ? `${STOCK_LABEL[st]} · ${p.productionDays ?? "—"}d` : `${STOCK_LABEL[st]} · ${p.stock}`}</Badge></td>
              <td><Check label={p.active ? "Sim" : "Não"} checked={p.active} onChange={() => toggle(p.id, "active")} /></td>
              <td className={s.hideSm}><Check label={p.featured ? "Sim" : "Não"} checked={p.featured} onChange={() => toggle(p.id, "featured")} /></td>
              <td className={s.num}>
                <div className={s.actions}>
                  <Button size="icon" variant="ghost" aria-label={`Editar ${p.name}`} onClick={() => { setErrors({}); setDraft(toDraft(p, false)); }}><Pencil size={16} /></Button>
                  <Button size="icon" variant="ghost" aria-label={`Excluir ${p.name}`} onClick={() => setToDelete(p)}><Trash2 size={16} /></Button>
                </div>
              </td>
            </tr>
          );
        })}
      </DataTable>

      <Modal open={!!draft} title={draft?.isNew ? "Novo produto" : "Editar produto"} onClose={() => setDraft(null)} footer={<><Button variant="outline" onClick={() => setDraft(null)}>Cancelar</Button><Button onClick={save}>Salvar</Button></>}>
        {draft && (
          <div className={s.formGrid}>
            <Input label="Nome" value={draft.product.name} error={errors.name} onChange={(e) => { const name = e.target.value; setDraft((d) => d && { ...d, product: { ...d.product, name, ...(d.slugTouched ? {} : { slug: slugify(name) }) } }); }} />
            <Input label="Slug (URL)" value={draft.product.slug} error={errors.slug} onChange={(e) => setDraft((d) => d && { ...d, slugTouched: true, product: { ...d.product, slug: e.target.value.toLowerCase() } })} />
            <SelectField label="Categoria" value={draft.product.category} error={errors.category} onChange={(e) => patch({ category: e.target.value })}>
              {cats.map((c) => <option key={c.slug} value={c.slug}>{c.name}{c.active ? "" : " (inativa)"}</option>)}
            </SelectField>
            <SelectField label="Tipo de produção" value={draft.product.availability} onChange={(e) => patch({ availability: e.target.value as ProductAvailability })}>
              {Object.entries(AVAILABILITY_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </SelectField>
            <Input label="Preço (R$)" inputMode="decimal" value={draft.price} error={errors.priceCents} onChange={(e) => setDraft((d) => d && { ...d, price: e.target.value })} />
            <Input label="Preço promocional (opcional)" inputMode="decimal" value={draft.promo} error={errors.promoPriceCents} onChange={(e) => setDraft((d) => d && { ...d, promo: e.target.value })} />
            <Input label="Estoque" type="number" min={0} value={String(draft.product.stock)} error={errors.stock} onChange={(e) => patch({ stock: Number(e.target.value) })} hint={draft.product.availability === "sob-demanda" ? "Sob encomenda: estoque zero não torna o produto indisponível." : undefined} />
            <Input label="Prazo estimado (dias úteis)" type="number" min={1} value={draft.product.productionDays === undefined ? "" : String(draft.product.productionDays)} error={errors.productionDays} onChange={(e) => patch({ productionDays: e.target.value === "" ? undefined : Number(e.target.value) } as Partial<Product>)} />
            <Input label="Cores (separadas por vírgula)" value={draft.colors} onChange={(e) => setDraft((d) => d && { ...d, colors: e.target.value })} />
            <Input label="Tamanhos (separados por vírgula)" value={draft.sizes} onChange={(e) => setDraft((d) => d && { ...d, sizes: e.target.value })} />
            <TextareaField className={s.full} label="Descrição" value={draft.product.description} error={errors.description} onChange={(e) => patch({ description: e.target.value })} />
            <div className={s.full}><ImageManager images={draft.product.images} onChange={(images) => patch({ images })} /></div>
            {errors.images && <span className={`${s.error} ${s.full}`}>{errors.images}</span>}
            <div className={s.full} style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
              <Check label="Publicado na loja" checked={draft.product.active} onChange={(v) => patch({ active: v })} />
              <Check label="Produto em destaque" checked={draft.product.featured} onChange={(v) => patch({ featured: v })} />
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog open={!!toDelete} danger title="Excluir produto" confirmLabel="Excluir" text={`Excluir "${toDelete?.name ?? ""}"? Pedidos existentes mantêm o nome, o preço e as variações registrados no momento do pedido.`}
        onCancel={() => setToDelete(null)}
        onConfirm={() => { const id = toDelete!.id; demoRepository.update((d) => ({ ...d, products: d.products.filter((p) => p.id !== id) })); setToDelete(null); }} />
    </div>
  );
}
