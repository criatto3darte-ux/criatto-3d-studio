import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import type { Category } from "@/shared/types/catalog";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { slugify, validateCategory, type Errors } from "@/features/demo-data/rules";
import {
  listAdminCategories,
  listAdminProducts,
  removeAdminCategory,
  saveAdminCategory,
  setAdminCategoryActive,
  swapAdminCategoryOrder,
  type AdminCategory,
  type AdminProduct,
} from "@/features/catalog/supabase-catalog";
import {
  Check,
  ConfirmDialog,
  DataTable,
  Modal,
  TextareaField,
  adminStyles as s,
} from "../ui/AdminUI";

interface Draft {
  cat: Category;
  original?: AdminCategory;
}

export function AdminCategoriesPage() {
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [del, setDel] = useState<AdminCategory | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [actionError, setActionError] = useState("");

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
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar as categorias.");
      setState("error");
    }
  }
  useEffect(() => {
    void reload();
  }, []);

  const cats = useMemo(
    () =>
      [...categories].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "pt-BR")),
    [categories],
  );
  const count = (id: string) =>
    products.filter(
      (product) => product.category === categories.find((category) => category.id === id)?.slug,
    ).length;

  async function save() {
    if (!draft) return;
    const cat = { ...draft.cat, name: draft.cat.name.trim() };
    const validation = validateCategory(cat, categories, draft.original?.slug);
    setErrors(validation);
    if (Object.keys(validation).length) return;
    setBusy(true);
    setActionError("");
    try {
      await saveAdminCategory({
        ...(draft.original ? { id: draft.original.id, version: draft.original.version } : {}),
        slug: cat.slug,
        name: cat.name,
        description: cat.description,
        active: cat.active,
        order: cat.order,
      });
      setDraft(null);
      await reload();
    } catch (cause) {
      setActionError(
        cause instanceof Error ? cause.message : "Não foi possível salvar a categoria.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!del) return;
    setBusy(true);
    setActionError("");
    try {
      await removeAdminCategory(del.id, del.version);
      setDel(null);
      await reload();
    } catch (cause) {
      setActionError(
        cause instanceof Error ? cause.message : "Não foi possível excluir a categoria.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(category: AdminCategory, active: boolean) {
    setBusy(true);
    setActionError("");
    try {
      await setAdminCategoryActive(category.id, category.version, active);
      await reload();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Não foi possível alterar o status.");
    } finally {
      setBusy(false);
    }
  }

  async function move(category: AdminCategory, direction: -1 | 1) {
    const index = cats.findIndex((item) => item.id === category.id);
    const other = cats[index + direction];
    if (!other || busy) return;
    setBusy(true);
    setActionError("");
    try {
      await swapAdminCategoryOrder(category, other);
      await reload();
    } catch (cause) {
      setActionError(
        cause instanceof Error ? cause.message : "Não foi possível reordenar as categorias.",
      );
      await reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={s.stack}>
      <div className={s.toolbar}>
        <p className={`${s.muted} ${s.grow}`}>
          Categorias reais do Supabase. Categorias inativas e seus produtos publicados não aparecem
          na vitrine.
        </p>
        <Button
          variant="outline"
          onClick={() => void reload()}
          disabled={state === "loading" || busy}
        >
          <RefreshCw size={16} /> Atualizar
        </Button>
        <Button
          onClick={() => {
            setErrors({});
            setActionError("");
            setDraft({
              cat: { slug: "", name: "", description: "", active: true, order: cats.length + 1 },
            });
          }}
          disabled={busy}
        >
          <Plus size={18} /> Nova categoria
        </Button>
      </div>
      {state === "loading" && <p role="status">Carregando categorias do Supabase…</p>}
      {state === "error" && <p role="alert">{error}</p>}
      {actionError && <p role="alert">{actionError}</p>}
      {state === "ready" && (
        <DataTable
          label="Categorias"
          empty={!cats.length}
          head={
            <>
              <th>Ordem</th>
              <th>Categoria</th>
              <th className={s.num}>Produtos</th>
              <th>Ativa</th>
              <th className={s.num}>Ações</th>
            </>
          }
        >
          {cats.map((category, index) => (
            <tr key={category.id}>
              <td>
                <div className={s.inline}>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Subir ${category.name}`}
                    disabled={index === 0 || busy}
                    onClick={() => void move(category, -1)}
                  >
                    ↑
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Descer ${category.name}`}
                    disabled={index === cats.length - 1 || busy}
                    onClick={() => void move(category, 1)}
                  >
                    ↓
                  </Button>
                </div>
              </td>
              <td>
                <strong>{category.name}</strong>
                <div className={s.muted}>/{category.slug}</div>
              </td>
              <td className={s.num}>{count(category.id)}</td>
              <td>
                <Check
                  label={category.active ? "Sim" : "Não"}
                  checked={category.active}
                  onChange={(active) => void toggleActive(category, active)}
                />
              </td>
              <td className={s.num}>
                <div className={s.actions}>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Editar ${category.name}`}
                    onClick={() => {
                      setErrors({});
                      setActionError("");
                      setDraft({ cat: { ...category }, original: category });
                    }}
                  >
                    <Pencil size={16} />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Excluir ${category.name}`}
                    onClick={() => {
                      setDel(category);
                      setActionError("");
                    }}
                    disabled={count(category.id) > 0 || busy}
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </DataTable>
      )}
      <Modal
        open={!!draft}
        title={draft?.original ? "Editar categoria" : "Nova categoria"}
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
              value={draft.cat.name}
              error={errors.name}
              onChange={(event) => {
                const name = event.target.value;
                setDraft(
                  (value) =>
                    value && {
                      ...value,
                      cat: {
                        ...value.cat,
                        name,
                        ...(value.original ? {} : { slug: slugify(name) }),
                      },
                    },
                );
              }}
            />
            <Input
              label="Slug"
              value={draft.cat.slug}
              error={errors.slug}
              onChange={(event) =>
                setDraft(
                  (value) =>
                    value && {
                      ...value,
                      cat: { ...value.cat, slug: event.target.value.toLowerCase() },
                    },
                )
              }
            />
            <Input
              label="Ordem de exibição"
              type="number"
              min={0}
              value={String(draft.cat.order)}
              error={errors.order}
              onChange={(event) =>
                setDraft(
                  (value) =>
                    value && { ...value, cat: { ...value.cat, order: Number(event.target.value) } },
                )
              }
            />
            <TextareaField
              className={s.full}
              label="Descrição"
              value={draft.cat.description}
              onChange={(event) =>
                setDraft(
                  (value) =>
                    value && { ...value, cat: { ...value.cat, description: event.target.value } },
                )
              }
            />
            <Check
              label="Ativa na loja"
              checked={draft.cat.active}
              onChange={(active) =>
                setDraft((value) => value && { ...value, cat: { ...value.cat, active } })
              }
            />
            {actionError && (
              <p className={s.full} role="alert">
                {actionError}
              </p>
            )}
          </div>
        )}
      </Modal>
      <ConfirmDialog
        open={!!del}
        danger
        title="Excluir categoria"
        confirmLabel="Excluir"
        onCancel={() => setDel(null)}
        onConfirm={() => void remove()}
        text={
          del
            ? `Excluir a categoria "${del.name}"? A operação é permitida somente sem produtos vinculados.`
            : ""
        }
      />
    </div>
  );
}
