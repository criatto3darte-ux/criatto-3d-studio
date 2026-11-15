import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import type { Product, ProductAvailability } from "@/shared/types/catalog";
import { Badge } from "@/shared/ui/Badge";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { formatBRL } from "@/shared/utils/format";
import { AVAILABILITY_LABEL, normalize } from "@/features/catalog/catalog.logic";
import {
  archiveAdminProduct,
  listAdminCategories,
  listAdminProducts,
  saveAdminProduct,
  setAdminProductPublished,
  type AdminCategory,
  type AdminProduct,
} from "@/features/catalog/supabase-catalog";
import { slugify, validateProduct, type Errors } from "@/features/demo-data/rules";
import {
  Check,
  ConfirmDialog,
  DataTable,
  Modal,
  SelectField,
  TextareaField,
  adminStyles as s,
  centsToInput,
  parseMoney,
} from "../ui/AdminUI";

interface Draft {
  product: Product;
  price: string;
  promo: string;
  productionDays: string;
  isNew: boolean;
  slugTouched: boolean;
  version?: number;
}
const badgeValue: Record<string, "novo" | "destaque" | "promocao" | null> = {
  Novo: "novo",
  Destaque: "destaque",
  "Mais Vendido": "promocao",
  Promoção: "promocao",
};

function toDraft(product: Product, isNew: boolean, version?: number): Draft {
  return {
    product,
    price: centsToInput(product.priceCents || null),
    promo: centsToInput(product.promoPriceCents),
    productionDays: product.productionDays ? String(product.productionDays) : "",
    isNew,
    slugTouched: !isNew,
    ...(version === undefined ? {} : { version }),
  };
}

export function ProductsPage() {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [avail, setAvail] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [toArchive, setToArchive] = useState<AdminProduct | null>(null);

  async function reload() {
    setState("loading");
    setError("");
    try {
      const nextCategories = await listAdminCategories();
      const nextProducts = await listAdminProducts(nextCategories);
      setCategories(nextCategories);
      setProducts(nextProducts);
      setState("ready");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar os produtos.");
      setState("error");
    }
  }
  useEffect(() => {
    void reload();
  }, []);

  const filtered = useMemo(() => {
    const term = normalize(q.trim());
    return products.filter(
      (product) =>
        (!term || normalize(`${product.name} ${product.slug}`).includes(term)) &&
        (!cat || product.category === cat) &&
        (!avail || product.availability === avail),
    );
  }, [products, q, cat, avail]);
  const categoryBySlug = new Map(categories.map((category) => [category.slug, category]));

  function openNew() {
    setErrors({});
    setActionError("");
    setDraft(
      toDraft(
        {
          id: "",
          slug: "",
          name: "",
          category: categories[0]?.slug ?? "",
          tags: [],
          description: "",
          priceCents: 0,
          images: [],
          availability: "pronta-entrega",
          stock: 0,
          featured: false,
          active: false,
          variants: [],
        },
        true,
      ),
    );
  }

  async function save() {
    if (!draft) return;
    const parsedPrice = parseMoney(draft.price);
    const parsedPromo = draft.promo.trim() ? parseMoney(draft.promo) : undefined;
    const { promoPriceCents: _promo, productionDays: _days, ...baseProduct } = draft.product;
    const product: Product = {
      ...baseProduct,
      name: draft.product.name.trim(),
      priceCents: Number.isNaN(parsedPrice) ? 0 : parsedPrice,
      ...(parsedPromo === undefined
        ? {}
        : { promoPriceCents: Number.isNaN(parsedPromo) ? -1 : parsedPromo }),
      ...(draft.product.availability === "sob-demanda"
        ? { productionDays: Number(draft.productionDays) }
        : {}),
    };
    const validation = validateProduct(product, products, categories);
    delete validation.stock;
    delete validation.images;
    delete validation.description;
    setErrors(validation);
    if (Object.keys(validation).length) return;
    const category = categoryBySlug.get(product.category);
    if (!category) {
      setActionError("Selecione uma categoria válida.");
      return;
    }
    setBusy(true);
    setActionError("");
    try {
      await saveAdminProduct({
        ...(draft.isNew ? {} : { id: draft.product.id, version: draft.version }),
        slug: product.slug,
        name: product.name,
        categoryId: category.id,
        description: product.description,
        tags: product.tags,
        regularPriceCents: product.priceCents,
        promoPriceCents: product.promoPriceCents ?? null,
        productionMode: product.availability === "sob-demanda" ? "sob-demanda" : "pronta-entrega",
        productionDays: product.productionDays ?? null,
        featured: product.featured,
        active: product.active,
        badge: product.badge ? (badgeValue[product.badge] ?? null) : null,
      });
      setDraft(null);
      await reload();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Não foi possível salvar o produto.");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(product: AdminProduct, key: "active" | "featured") {
    if (key === "active") {
      setBusy(true);
      setActionError("");
      try {
        await setAdminProductPublished(product.id, product.version, !product.active);
        await reload();
      } catch (cause) {
        setActionError(
          cause instanceof Error ? cause.message : "Não foi possível publicar o produto.",
        );
      } finally {
        setBusy(false);
      }
      return;
    }
    setActionError(
      "A edição do destaque usa o mesmo comando de gravação do produto. Abra Editar para alterar esse campo com segurança.",
    );
  }

  async function archive() {
    if (!toArchive) return;
    setBusy(true);
    setActionError("");
    try {
      await archiveAdminProduct(toArchive.id, toArchive.version);
      setToArchive(null);
      await reload();
    } catch (cause) {
      setActionError(
        cause instanceof Error ? cause.message : "Não foi possível arquivar o produto.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={s.stack}>
      <div className={s.toolbar}>
        <Input
          className={s.grow}
          label="Pesquisar"
          placeholder="Nome ou slug"
          value={q}
          onChange={(event) => setQ(event.target.value)}
        />
        <SelectField label="Categoria" value={cat} onChange={(event) => setCat(event.target.value)}>
          <option value="">Todas</option>
          {categories.map((category) => (
            <option key={category.id} value={category.slug}>
              {category.name}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Disponibilidade"
          value={avail}
          onChange={(event) => setAvail(event.target.value)}
        >
          <option value="">Todas</option>
          {Object.entries(AVAILABILITY_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </SelectField>
        <Button
          variant="outline"
          onClick={() => void reload()}
          disabled={state === "loading" || busy}
        >
          <RefreshCw size={16} /> Atualizar
        </Button>
        <Button onClick={openNew} disabled={busy}>
          <Plus size={18} /> Novo produto
        </Button>
      </div>
      <p className={s.muted}>
        {state === "ready" ? `${filtered.length} de ${products.length} produtos do Supabase` : ""}
      </p>
      {state === "loading" && <p role="status">Carregando produtos do Supabase…</p>}
      {state === "error" && <p role="alert">{error}</p>}
      {actionError && <p role="alert">{actionError}</p>}
      {state === "ready" && (
        <DataTable
          label="Produtos"
          empty={!filtered.length}
          head={
            <>
              <th>Produto</th>
              <th className={s.hideSm}>Categoria</th>
              <th className={s.num}>Preço</th>
              <th className={s.hideSm}>Modo</th>
              <th>Publicado</th>
              <th className={s.hideSm}>Destaque</th>
              <th className={s.num}>Ações</th>
            </>
          }
        >
          {filtered.map((product) => (
            <tr key={product.id}>
              <td>
                <strong>{product.name}</strong>
                <div className={s.muted}>/{product.slug}</div>
              </td>
              <td className={s.hideSm}>{product.category}</td>
              <td className={s.num}>
                {product.promoPriceCents ? (
                  <>
                    <s className={s.muted}>{formatBRL(product.priceCents)}</s>
                    <br />
                    {formatBRL(product.promoPriceCents)}
                  </>
                ) : (
                  formatBRL(product.priceCents)
                )}
              </td>
              <td className={s.hideSm}>
                <Badge
                  tone={
                    product.availability === "sob-demanda"
                      ? "warning"
                      : product.availability === "indisponivel"
                        ? "danger"
                        : "success"
                  }
                >
                  {product.availability === "sob-demanda"
                    ? `Sob encomenda · ${product.productionDays ?? "—"}d`
                    : product.availability === "indisponivel"
                      ? "Esgotado"
                      : "Pronta entrega"}
                </Badge>
              </td>
              <td>
                <Check
                  label={product.active ? "Sim" : "Não"}
                  checked={product.active}
                  onChange={() => void toggle(product, "active")}
                />
              </td>
              <td className={s.hideSm}>
                <Check
                  label={product.featured ? "Sim" : "Não"}
                  checked={product.featured}
                  onChange={() => {
                    setDraft(toDraft(product, false, product.version));
                  }}
                />
              </td>
              <td className={s.num}>
                <div className={s.actions}>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Editar ${product.name}`}
                    onClick={() => {
                      setErrors({});
                      setActionError("");
                      setDraft(toDraft(product, false, product.version));
                    }}
                  >
                    <Pencil size={16} />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Arquivar ${product.name}`}
                    onClick={() => setToArchive(product)}
                    disabled={busy}
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </DataTable>
      )}

      <p role="note">
        O catálogo público expõe somente disponibilidade binária; os saldos exatos são exclusivos do
        painel de estoque. Imagens/galeria e combinações com SKU dependem de Storage e comandos
        transacionais ainda não habilitados.
      </p>
      <Modal
        open={!!draft}
        title={draft?.isNew ? "Novo produto" : "Editar produto"}
        onClose={() => !busy && setDraft(null)}
        footer={
          <>
            <Button variant="outline" onClick={() => setDraft(null)} disabled={busy}>
              Cancelar
            </Button>
            <Button onClick={() => void save()} disabled={busy}>
              {busy ? "Salvando…" : "Salvar"}
            </Button>
          </>
        }
      >
        {draft && (
          <div className={s.formGrid}>
            <Input
              label="Nome"
              value={draft.product.name}
              error={errors.name}
              onChange={(event) => {
                const name = event.target.value;
                setDraft(
                  (value) =>
                    value && {
                      ...value,
                      product: {
                        ...value.product,
                        name,
                        ...(value.slugTouched ? {} : { slug: slugify(name) }),
                      },
                    },
                );
              }}
            />
            <Input
              label="Slug (URL)"
              value={draft.product.slug}
              error={errors.slug}
              onChange={(event) =>
                setDraft(
                  (value) =>
                    value && {
                      ...value,
                      slugTouched: true,
                      product: { ...value.product, slug: event.target.value.toLowerCase() },
                    },
                )
              }
            />
            <SelectField
              label="Categoria"
              value={draft.product.category}
              error={errors.category}
              onChange={(event) =>
                setDraft(
                  (value) =>
                    value && {
                      ...value,
                      product: { ...value.product, category: event.target.value },
                    },
                )
              }
            >
              {categories.map((category) => (
                <option key={category.id} value={category.slug}>
                  {category.name}
                  {category.active ? "" : " (inativa)"}
                </option>
              ))}
            </SelectField>
            <SelectField
              label="Tipo de produção"
              value={draft.product.availability}
              onChange={(event) =>
                setDraft(
                  (value) =>
                    value && {
                      ...value,
                      product: {
                        ...value.product,
                        availability: event.target.value as ProductAvailability,
                      },
                    },
                )
              }
            >
              <option value="pronta-entrega">Pronta entrega</option>
              <option value="sob-demanda">Sob encomenda</option>
            </SelectField>
            <Input
              label="Preço normal (R$)"
              inputMode="decimal"
              value={draft.price}
              error={errors.priceCents}
              onChange={(event) =>
                setDraft((value) => value && { ...value, price: event.target.value })
              }
            />
            <Input
              label="Preço promocional (R$), opcional"
              inputMode="decimal"
              value={draft.promo}
              error={errors.promoPriceCents}
              onChange={(event) =>
                setDraft((value) => value && { ...value, promo: event.target.value })
              }
            />
            {draft.product.availability === "sob-demanda" && (
              <Input
                label="Prazo estimado (dias úteis)"
                type="number"
                min={1}
                value={draft.productionDays}
                error={errors.productionDays}
                onChange={(event) =>
                  setDraft((value) => value && { ...value, productionDays: event.target.value })
                }
              />
            )}
            <TextareaField
              className={s.full}
              label="Descrição"
              value={draft.product.description}
              error={errors.description}
              onChange={(event) =>
                setDraft(
                  (value) =>
                    value && {
                      ...value,
                      product: { ...value.product, description: event.target.value },
                    },
                )
              }
            />
            <Input
              className={s.full}
              label="Tags separadas por vírgula"
              value={draft.product.tags.join(", ")}
              onChange={(event) =>
                setDraft(
                  (value) =>
                    value && {
                      ...value,
                      product: {
                        ...value.product,
                        tags: [
                          ...new Set(
                            event.target.value
                              .split(",")
                              .map((tag) => tag.trim())
                              .filter(Boolean),
                          ),
                        ],
                      },
                    },
                )
              }
            />
            <Check
              label="Destaque na loja"
              checked={draft.product.featured}
              onChange={(featured) =>
                setDraft((value) => value && { ...value, product: { ...value.product, featured } })
              }
            />
            <Check
              label="Publicar na loja"
              checked={draft.product.active}
              onChange={(active) =>
                setDraft((value) => value && { ...value, product: { ...value.product, active } })
              }
            />
            <div className={s.full}>
              <p role="note">
                Variantes/combinações SKU e imagens não serão alteradas neste formulário até que
                existam comandos atômicos e Storage configurados. O restante do produto é gravado
                diretamente no Supabase sob as permissões RLS existentes.
              </p>
              {actionError && <p role="alert">{actionError}</p>}
            </div>
          </div>
        )}
      </Modal>
      <ConfirmDialog
        open={!!toArchive}
        danger
        title="Arquivar produto"
        confirmLabel="Arquivar"
        onCancel={() => setToArchive(null)}
        onConfirm={() => void archive()}
        text={
          toArchive
            ? `Arquivar "${toArchive.name}"? O produto será despublicado e mantido para preservar referências.`
            : ""
        }
      />
    </div>
  );
}
