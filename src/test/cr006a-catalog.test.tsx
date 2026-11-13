import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryHistory, createRootRoute, createRoute, createRouter, Outlet, RouterProvider } from "@tanstack/react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CatalogPage } from "@/features/store/pages/CatalogPage";
import { parseCatalogSearch, sortProducts } from "@/features/catalog/catalog.logic";
import { demoProducts } from "@/features/catalog/products.mock";

// Only isolate catalog data and product links; search and navigation use the real router.
vi.mock("@/features/catalog/catalog.service", async () => {
  const { demoProducts } = await import("@/features/catalog/products.mock");
  const { categories } = await import("@/features/catalog/categories");
  return { useStoreCatalog: () => ({ products: demoProducts, categories }) };
});
vi.mock("@/features/store/components/ProductCard", () => ({
  ProductGrid: ({ products }: { products: typeof demoProducts }) => <ul>{products.map((p) => <li key={p.id}>{p.name}</li>)}</ul>,
}));

afterEach(() => { cleanup(); vi.useRealTimers(); });

async function openCatalog() {
  const root = createRootRoute({ component: Outlet });
  const store = createRoute({ getParentRoute: () => root, id: "_store", component: Outlet });
  const catalog = createRoute({ getParentRoute: () => store, path: "produtos", validateSearch: parseCatalogSearch, component: CatalogPage });
  const router = createRouter({ routeTree: root.addChildren([store.addChildren([catalog])]), history: createMemoryHistory({ initialEntries: ["/produtos"] }) });
  await router.load();
  render(<RouterProvider router={router} />);
  await screen.findByRole("textbox", { name: "Pesquisar no catálogo" });
  return router;
}

describe("CR-006A catalog", () => {
  it("orders both directions using the effective promotional price without mutating products", () => {
    const base = demoProducts[0];
    if (!base) throw new Error("Missing product fixture");
    const products = [{ ...base, id: "promo", priceCents: 10000, promoPriceCents: 1000 }, { ...base, id: "regular", priceCents: 2000 }];
    expect(sortProducts(products, "preco-asc").map((p) => p.id)).toEqual(["promo", "regular"]);
    expect(sortProducts(products, "preco-desc").map((p) => p.id)).toEqual(["regular", "promo"]);
    expect(products.map((p) => p.id)).toEqual(["promo", "regular"]);
  });

  it("keeps the latest typed query together with rapid category, availability and sort changes", async () => {
    const router = await openCatalog();
    const input = screen.getByRole("textbox", { name: "Pesquisar no catálogo" });
    fireEvent.change(input, { target: { value: "vas" } });
    fireEvent.click(screen.getByRole("radio", { name: "Vasos e Jardinagem" }));
    fireEvent.change(input, { target: { value: "vaso" } });
    fireEvent.click(screen.getByRole("radio", { name: "Sob encomenda" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Ordenar" }), { target: { value: "preco-asc" } });
    await waitFor(() => expect(router.state.location.search).toEqual({ q: "vaso", categoria: "vasos-jardinagem", disponibilidade: "sob-demanda", ordem: "preco-asc" }));
    expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual(["Vaso Autoirrigável"]);
  });

  it("cancels pending typing when filters are cleared and accepts an external query", async () => {
    const router = await openCatalog();
    fireEvent.click(screen.getByRole("radio", { name: "Sob encomenda" }));
    await waitFor(() => expect(router.state.location.search).toEqual({ disponibilidade: "sob-demanda" }));
    vi.useFakeTimers();
    fireEvent.change(screen.getByRole("textbox", { name: "Pesquisar no catálogo" }), { target: { value: "dragao" } });
    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(router.state.location.search).toEqual({});
    vi.useRealTimers();
    await act(async () => { await router.navigate({ to: "/produtos", search: { q: "LUMINARIA" } }); });
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Pesquisar no catálogo" })).toHaveValue("LUMINARIA"));
    expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual(["Luminária Lua"]);
  });
});