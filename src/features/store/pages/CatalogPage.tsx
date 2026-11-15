import { useCallback, useEffect, useMemo, useState } from "react";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { PackageSearch, Search, SlidersHorizontal } from "lucide-react";
import { Input } from "@/shared/ui/Input";
import { Button } from "@/shared/ui/Button";
import { useStoreCatalog } from "@/features/catalog/catalog.service";
import {
  AVAILABILITY_LABEL,
  PAGE_SIZE,
  SORT_OPTIONS,
  parseCatalogSearch,
  queryCatalog,
  type CatalogSearch,
} from "@/features/catalog/catalog.logic";
import { ProductGrid } from "../components/ProductCard";
import { PageHeader } from "../components/Section";
import styles from "./CatalogPage.module.css";

const route = getRouteApi("/_store/produtos");

export function CatalogPage() {
  const search = route.useSearch();
  const navigate = useNavigate();
  const [term, setTerm] = useState(search.q ?? "");
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const update = useCallback(
    (patch: Partial<Record<keyof CatalogSearch, string | undefined>>) =>
      navigate({
        to: "/produtos",
        search: (previous) => parseCatalogSearch({ ...previous, ...patch }),
        replace: true,
        resetScroll: false,
      }),
    [navigate],
  );

  // Keep the box in sync when the header search changes the URL.
  useEffect(() => setTerm(search.q ?? ""), [search.q]);

  // Debounced search-as-you-type.
  useEffect(() => {
    if (term.trim() === (search.q ?? "")) return;
    const t = setTimeout(() => update({ q: term }), 350);
    return () => clearTimeout(t);
  }, [term, search.q, update]);

  const key = JSON.stringify(search);
  // The remote Supabase snapshot is stateful; only the visible page slice resets here.
  useEffect(() => {
    setVisible(PAGE_SIZE);
  }, [key]);

  const { products, categories, state: catalogState, error: catalogError } = useStoreCatalog();
  const results = useMemo(() => queryCatalog(products, search), [products, search]);
  const shown = results.slice(0, visible);
  const hasFilters = Object.keys(search).length > 0;
  const catName = search.categoria
    ? categories.find((c) => c.slug === search.categoria)?.name
    : undefined;

  return (
    <div className="container">
      <PageHeader
        eyebrow="Catálogo"
        title={catName ?? "Produtos"}
        text="Encontre peças por nome, categoria e disponibilidade."
      />
      {catalogState === "error" && (
        <p role="alert">{catalogError ?? "Não foi possível carregar o catálogo."}</p>
      )}
      {catalogState === "unconfigured" && (
        <p role="status">O catálogo está temporariamente indisponível.</p>
      )}
      {catalogState === "loading" && (
        <p role="status" aria-live="polite">
          Carregando catálogo…
        </p>
      )}
      <div style={{ height: 24 }} />
      <div className={styles.layout}>
        <aside id="filtros" className={styles.filters} data-open={filtersOpen} aria-label="Filtros">
          <fieldset className={styles.group}>
            <legend className={styles.legend}>Categoria</legend>
            <label className={styles.option}>
              <input
                type="radio"
                name="categoria"
                checked={!search.categoria}
                onChange={() => update({ categoria: undefined })}
              />{" "}
              Todas
            </label>
            {categories.map((c) => (
              <label key={c.slug} className={styles.option}>
                <input
                  type="radio"
                  name="categoria"
                  checked={search.categoria === c.slug}
                  onChange={() => update({ categoria: c.slug })}
                />{" "}
                {c.name}
              </label>
            ))}
          </fieldset>
          <fieldset className={styles.group}>
            <legend className={styles.legend}>Disponibilidade</legend>
            <label className={styles.option}>
              <input
                type="radio"
                name="disp"
                checked={!search.disponibilidade}
                onChange={() => update({ disponibilidade: undefined })}
              />{" "}
              Todas
            </label>
            {Object.entries(AVAILABILITY_LABEL).map(([value, label]) => (
              <label key={value} className={styles.option}>
                <input
                  type="radio"
                  name="disp"
                  checked={search.disponibilidade === value}
                  onChange={() => update({ disponibilidade: value })}
                />{" "}
                {label}
              </label>
            ))}
          </fieldset>
          {hasFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setTerm("");
                navigate({ to: "/produtos", search: {}, replace: true });
              }}
            >
              Limpar filtros
            </Button>
          )}
        </aside>

        <div>
          <div className={styles.toolbar}>
            <form
              role="search"
              className={styles.search}
              onSubmit={(e) => {
                e.preventDefault();
                update({ q: term });
              }}
            >
              <Input
                aria-label="Pesquisar no catálogo"
                placeholder="Pesquisar no catálogo..."
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                trailing={<Search size={18} aria-hidden="true" />}
              />
            </form>
            <Button
              variant="secondary"
              className={styles.filterToggle}
              aria-expanded={filtersOpen}
              aria-controls="filtros"
              onClick={() => setFiltersOpen((o) => !o)}
            >
              <SlidersHorizontal size={18} /> Filtros
            </Button>
            <label className={styles.sortLabel}>
              Ordenar
              <select
                className={styles.select}
                value={search.ordem ?? "relevancia"}
                onChange={(e) => update({ ordem: e.target.value })}
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {catalogState === "ready" && (
            <p
              className={styles.result}
              aria-live="polite"
            >{`${results.length} ${results.length === 1 ? "produto encontrado" : "produtos encontrados"}`}</p>
          )}

          {catalogState === "ready" && results.length === 0 ? (
            <div className={styles.empty}>
              <PackageSearch size={44} strokeWidth={1.4} aria-hidden="true" />
              <h2 style={{ fontSize: 20 }}>
                {products.length === 0
                  ? "Nenhum produto cadastrado no momento"
                  : "Nenhum produto encontrado"}
              </h2>
              <p style={{ color: "var(--color-text-muted)" }}>
                {products.length === 0
                  ? "Estamos preparando o catálogo. Volte em breve."
                  : "Tente outro termo ou remova alguns filtros."}
              </p>
              {products.length > 0 && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setTerm("");
                    navigate({ to: "/produtos", search: {}, replace: true });
                  }}
                >
                  Ver todos os produtos
                </Button>
              )}
            </div>
          ) : catalogState === "ready" ? (
            <>
              <ProductGrid products={shown} />
              {results.length > PAGE_SIZE && (
                <div className={styles.more}>
                  <span>
                    Exibindo {shown.length} de {results.length}
                  </span>
                  {shown.length < results.length && (
                    <Button variant="outline" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
                      Carregar mais
                    </Button>
                  )}
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
