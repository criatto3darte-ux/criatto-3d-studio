import { useSyncExternalStore } from "react";
import type { PostgrestError } from "@supabase/supabase-js";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import type { Category, Product, ProductVariantGroup } from "@/shared/types/catalog";

export type CatalogLoadState = "loading" | "ready" | "error" | "unconfigured";
export interface CatalogSnapshot {
  readonly state: CatalogLoadState;
  readonly products: readonly Product[];
  readonly categories: readonly Category[];
  readonly error: string | null;
}

const EMPTY: CatalogSnapshot = Object.freeze({
  state: "loading",
  products: [],
  categories: [],
  error: null,
});
let snapshot: CatalogSnapshot = EMPTY;
let request: Promise<void> | null = null;
let requestGeneration = 0;
const listeners = new Set<() => void>();

function publish(next: CatalogSnapshot) {
  snapshot = next;
  listeners.forEach((listener) => listener());
}

function failureMessage(error: PostgrestError): string {
  // Do not expose database detail, query strings, or policy internals in the UI.
  if (error.code === "PGRST301" || error.code === "42501")
    return "O catálogo não está disponível para leitura.";
  return "Não foi possível carregar o catálogo. Tente novamente mais tarde.";
}

function integer(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

interface PublicCategoryRow {
  id: string;
  slug: string;
  name: string;
  description: string;
  display_order: number;
}
interface PublicProductRow {
  id: string;
  category_id: string;
  slug: string;
  name: string;
  description: string;
  tags: string[] | null;
  regular_price_cents: number | string;
  promo_price_cents: number | string | null;
  production_mode: "pronta-entrega" | "sob-demanda";
  production_days: number | null;
  featured: boolean;
  badge: string | null;
}

export function toCategory(row: PublicCategoryRow): Category {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    active: true,
    order: row.display_order,
  };
}

export function toPublicProduct(
  row: PublicProductRow,
  categoryById: ReadonlyMap<string, Category>,
  available: boolean,
  groups: readonly { id: string; product_id: string; code: string; label: string }[],
  options: readonly { group_id: string; id: string; label: string }[],
): Product | null {
  const category = categoryById.get(row.category_id);
  if (!category) return null;
  const variants: ProductVariantGroup[] = groups
    .filter((group) => group.product_id === row.id)
    .flatMap((group) => {
      const name =
        group.code === "cor"
          ? "Cor"
          : group.code === "tamanho"
            ? "Tamanho"
            : group.code === "acabamento"
              ? "Acabamento"
              : null;
      if (!name) return [];
      const values = options
        .filter((option) => option.group_id === group.id)
        .map((option) => ({ id: option.id, label: option.label }));
      return values.length ? [{ id: group.id, name, options: values }] : [];
    });
  const regularPrice = integer(row.regular_price_cents);
  const promotionalPrice =
    row.promo_price_cents === null ? undefined : integer(row.promo_price_cents);
  const badge =
    row.badge === "novo"
      ? "Novo"
      : row.badge === "destaque"
        ? "Destaque"
        : row.badge === "promocao"
          ? "Promoção"
          : undefined;
  return {
    id: row.id,
    slug: row.slug,
    name: text(row.name),
    category: category.slug,
    tags: Array.isArray(row.tags) ? row.tags : [],
    description: text(row.description),
    priceCents: regularPrice,
    ...(promotionalPrice === undefined ? {} : { promoPriceCents: promotionalPrice }),
    // The public projection intentionally exposes no object key. Until an approved
    // Storage bucket and URL policy exist, never fabricate a URL or use demo media.
    images: [],
    ...(badge ? { badge } : {}),
    availability:
      row.production_mode === "sob-demanda"
        ? "sob-demanda"
        : available
          ? "pronta-entrega"
          : "indisponivel",
    ...(row.production_days ? { productionDays: row.production_days } : {}),
    // Public availability is boolean by design; exact on-hand quantities stay private.
    stock: available ? 1 : 0,
    featured: Boolean(row.featured),
    active: true,
    variants,
  };
}

async function loadCatalog(): Promise<{ products: Product[]; categories: Category[] }> {
  const client = getSupabase();
  const [categoryResult, productResult, groupResult, optionResult, availabilityResult] =
    await Promise.all([
      client
        .from("public_categories")
        .select("id,slug,name,description,display_order")
        .order("display_order")
        .order("id"),
      client
        .from("public_products")
        .select(
          "id,category_id,slug,name,description,tags,regular_price_cents,promo_price_cents,production_mode,production_days,featured,badge",
        )
        .order("slug"),
      client
        .from("public_attribute_groups")
        .select("id,product_id,code,label,position")
        .order("position"),
      client
        .from("public_attribute_options")
        .select("id,group_id,label,position")
        .order("position"),
      client.from("public_availability").select("product_id,available"),
    ]);
  const error = [categoryResult, productResult, groupResult, optionResult, availabilityResult].find(
    (result) => result.error,
  )?.error;
  if (error) throw error;
  const categories = (categoryResult.data ?? []).map((row) => toCategory(row as PublicCategoryRow));
  const categoryById = new Map(categories.map((category) => [category.id!, category]));
  const availability = new Map(
    (availabilityResult.data ?? []).map((row) => [
      row.product_id as string,
      Boolean(row.available),
    ]),
  );
  const products = (productResult.data ?? []).flatMap((raw) => {
    const product = toPublicProduct(
      raw as PublicProductRow,
      categoryById,
      availability.get((raw as PublicProductRow).id) ?? false,
      (groupResult.data ?? []) as { id: string; product_id: string; code: string; label: string }[],
      (optionResult.data ?? []) as { group_id: string; id: string; label: string }[],
    );
    return product ? [product] : [];
  });
  return { products, categories };
}

export function refreshPublicCatalog(): void {
  if (request) return;
  if (!isSupabaseConfigured()) {
    publish({ state: "unconfigured", products: [], categories: [], error: null });
    return;
  }
  publish({ ...snapshot, state: "loading", error: null });
  const generation = ++requestGeneration;
  request = loadCatalog()
    .then(({ products, categories }) => {
      if (generation === requestGeneration)
        publish({ state: "ready", products, categories, error: null });
    })
    .catch((error: unknown) => {
      if (generation !== requestGeneration) return;
      publish({
        state: "error",
        products: [],
        categories: [],
        error:
          error && typeof error === "object" && "code" in error
            ? failureMessage(error as PostgrestError)
            : "Não foi possível carregar o catálogo. Tente novamente mais tarde.",
      });
    })
    .finally(() => {
      if (generation === requestGeneration) request = null;
    });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (snapshot === EMPTY || (snapshot.state === "unconfigured" && isSupabaseConfigured()))
    refreshPublicCatalog();
  return () => listeners.delete(listener);
}

export function useRemoteCatalog(): CatalogSnapshot {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => EMPTY,
  );
}

export function invalidatePublicCatalog(): void {
  requestGeneration += 1;
  request = null;
  snapshot = { state: "loading", products: [], categories: [], error: null };
  refreshPublicCatalog();
}

export interface AdminCategory extends Category {
  id: string;
  version: number;
}
export interface AdminProduct extends Product {
  version: number;
  archivedAt: string | null;
}

function throwSafe(error: PostgrestError | null, fallback: string): void {
  if (!error) return;
  if (error.code === "23505") throw new Error("Já existe um item com esse slug.");
  if (error.code === "23503")
    throw new Error("A categoria está associada a outros registros e não pode ser removida.");
  if (error.code === "42501" || error.code === "PGRST301")
    throw new Error("A sessão administrativa ou a permissão AAL2 não está válida.");
  throw new Error(fallback);
}

export async function listAdminCategories(): Promise<AdminCategory[]> {
  const client = getSupabase();
  const { data, error } = await client
    .from("categories")
    .select("id,slug,name,description,active,display_order,version")
    .order("display_order")
    .order("id");
  throwSafe(error, "Não foi possível carregar as categorias.");
  return (data ?? []).map((row) => ({
    id: row.id,
    version: row.version,
    slug: row.slug,
    name: row.name,
    description: row.description,
    active: row.active,
    order: row.display_order,
  }));
}

export async function listAdminProducts(
  categories?: readonly AdminCategory[],
): Promise<AdminProduct[]> {
  const client = getSupabase();
  const [productsResult, availabilityResult, groupsResult, optionsResult] = await Promise.all([
    client
      .from("products")
      .select(
        "id,category_id,slug,name,description,tags,regular_price_cents,promo_price_cents,production_mode,production_days,active,featured,badge,archived_at,version",
      )
      .is("archived_at", null)
      .order("created_at", { ascending: false }),
    client.from("public_availability").select("product_id,available"),
    client
      .from("product_attribute_groups")
      .select("id,product_id,code,label,position")
      .order("position"),
    client.from("product_attribute_options").select("id,group_id,label,position").order("position"),
  ]);
  throwSafe(productsResult.error, "Não foi possível carregar os produtos.");
  throwSafe(availabilityResult.error, "Não foi possível carregar a disponibilidade dos produtos.");
  throwSafe(groupsResult.error, "Não foi possível carregar as variações dos produtos.");
  throwSafe(optionsResult.error, "Não foi possível carregar as opções dos produtos.");
  let categoryRows = categories;
  if (!categoryRows) categoryRows = await listAdminCategories();
  const categoryById = new Map(categoryRows.map((category) => [category.id, category]));
  const availability = new Map(
    (availabilityResult.data ?? []).map((row) => [
      row.product_id as string,
      Boolean(row.available),
    ]),
  );
  return (productsResult.data ?? []).flatMap((row) => {
    const category = categoryById.get(row.category_id);
    if (!category) return [];
    const product = toPublicProduct(
      { ...row, archived_at: null } as unknown as PublicProductRow,
      categoryById,
      availability.get(row.id) ?? false,
      (groupsResult.data ?? []) as {
        id: string;
        product_id: string;
        code: string;
        label: string;
      }[],
      (optionsResult.data ?? []) as { group_id: string; id: string; label: string }[],
    );
    if (!product) return [];
    return [{ ...product, active: row.active, version: row.version, archivedAt: row.archived_at }];
  });
}

export async function saveAdminCategory(
  input: Omit<AdminCategory, "id" | "version"> & { id?: string; version?: number },
): Promise<void> {
  const client = getSupabase();
  const fields = {
    slug: input.slug.trim(),
    name: input.name.trim(),
    description: input.description.trim(),
    active: input.active,
    display_order: input.order,
  };
  const result = input.id
    ? await client
        .from("categories")
        .update(fields)
        .eq("id", input.id)
        .eq("version", input.version ?? 0)
        .select("id")
    : await client.from("categories").insert(fields).select("id");
  throwSafe(result.error, "Não foi possível salvar a categoria.");
  if (input.id && result.data?.length !== 1)
    throw new Error(
      "A categoria foi alterada em outra sessão. Atualize a lista e tente novamente.",
    );
  invalidatePublicCatalog();
}

export async function removeAdminCategory(id: string, version: number): Promise<void> {
  const client = getSupabase();
  const { count, error: countError } = await client
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("category_id", id)
    .is("archived_at", null);
  throwSafe(countError, "Não foi possível validar os vínculos da categoria.");
  if ((count ?? 0) > 0)
    throw new Error("A categoria possui produtos vinculados. Reassocie-os antes de excluir.");
  const { data, error } = await client
    .from("categories")
    .delete()
    .eq("id", id)
    .eq("version", version)
    .select("id");
  throwSafe(error, "Não foi possível excluir a categoria.");
  if (data?.length !== 1)
    throw new Error(
      "A categoria foi alterada em outra sessão. Atualize a lista e tente novamente.",
    );
  invalidatePublicCatalog();
}

export async function setAdminCategoryActive(
  id: string,
  version: number,
  active: boolean,
): Promise<void> {
  const { data, error } = await getSupabase()
    .from("categories")
    .update({ active })
    .eq("id", id)
    .eq("version", version)
    .select("id");
  throwSafe(error, "Não foi possível atualizar a categoria.");
  if (data?.length !== 1)
    throw new Error(
      "A categoria foi alterada em outra sessão. Atualize a lista e tente novamente.",
    );
  invalidatePublicCatalog();
}

export async function archiveAdminProduct(id: string, version: number): Promise<void> {
  const { data, error } = await getSupabase()
    .from("products")
    .update({ active: false, archived_at: new Date().toISOString() })
    .eq("id", id)
    .eq("version", version)
    .is("archived_at", null)
    .select("id");
  throwSafe(error, "Não foi possível arquivar o produto.");
  if (data?.length !== 1)
    throw new Error("O produto foi alterado em outra sessão. Atualize a lista e tente novamente.");
  invalidatePublicCatalog();
}

export async function setAdminProductPublished(
  id: string,
  version: number,
  active: boolean,
): Promise<void> {
  const { data, error } = await getSupabase()
    .from("products")
    .update({ active })
    .eq("id", id)
    .eq("version", version)
    .is("archived_at", null)
    .select("id");
  throwSafe(error, "Não foi possível alterar a publicação.");
  if (data?.length !== 1)
    throw new Error("O produto foi alterado em outra sessão. Atualize a lista e tente novamente.");
  invalidatePublicCatalog();
}

export async function saveAdminProduct(input: {
  id?: string;
  version?: number;
  slug: string;
  name: string;
  categoryId: string;
  description: string;
  tags: string[];
  regularPriceCents: number;
  promoPriceCents: number | null;
  productionMode: "pronta-entrega" | "sob-demanda";
  productionDays: number | null;
  featured: boolean;
  active: boolean;
  badge: "novo" | "destaque" | "promocao" | null;
}): Promise<void> {
  const fields = {
    slug: input.slug.trim(),
    name: input.name.trim(),
    category_id: input.categoryId,
    description: input.description.trim(),
    tags: input.tags,
    regular_price_cents: input.regularPriceCents,
    promo_price_cents: input.promoPriceCents,
    production_mode: input.productionMode,
    production_days: input.productionMode === "sob-demanda" ? input.productionDays : null,
    featured: input.featured,
    active: input.active,
    badge: input.badge,
  };
  const query = getSupabase();
  const result = input.id
    ? await query
        .from("products")
        .update(fields)
        .eq("id", input.id)
        .eq("version", input.version ?? 0)
        .is("archived_at", null)
        .select("id")
    : await query
        .from("products")
        .insert({ ...fields, archived_at: null })
        .select("id");
  throwSafe(result.error, "Não foi possível salvar o produto.");
  if (input.id && result.data?.length !== 1)
    throw new Error("O produto foi alterado em outra sessão. Atualize a lista e tente novamente.");
  invalidatePublicCatalog();
}
