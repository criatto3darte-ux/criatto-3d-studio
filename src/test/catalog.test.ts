import { describe, expect, it } from "vitest";
import { demoProducts } from "@/features/catalog/products.mock";
import { filterProducts, parseCatalogSearch, queryCatalog, sortProducts, countByCategory, relatedProducts } from "@/features/catalog/catalog.logic";

describe("catalog rules", () => {
  it("search ignores accents and case", () => {
    expect(filterProducts(demoProducts, { q: "LUMINARIA" }).map((p) => p.slug)).toEqual(["luminaria-lua"]);
  });
  it("filters by category", () => {
    expect(filterProducts(demoProducts, { categoria: "vasos-jardinagem" })).toHaveLength(3);
  });
  it("filters by availability", () => {
    const r = filterProducts(demoProducts, { disponibilidade: "indisponivel" });
    expect(r.map((p) => p.slug)).toEqual(["organizador-cabos"]);
  });
  it("sorts by price ascending and name", () => {
    expect(sortProducts(demoProducts, "preco-asc")[0]!.priceCents).toBe(1990);
    expect(sortProducts(demoProducts, "preco-desc")[0]!.slug).toBe("luminaria-lua");
    expect(sortProducts(demoProducts, "nome-asc")[0]!.name).toBe("Cachepô Facetado");
  });
  it("combines filters", () => {
    expect(queryCatalog(demoProducts, { categoria: "geek-nerd", ordem: "preco-asc" }).map((p) => p.slug)).toEqual(["suporte-controle", "suporte-headset", "dragao-articulado"]);
  });
  it("drops invalid search params", () => {
    expect(parseCatalogSearch({ q: "  ", categoria: "x", ordem: "y", disponibilidade: "sob-demanda" })).toEqual({ disponibilidade: "sob-demanda" });
  });
  it("counts and relates by category", () => {
    expect(countByCategory(demoProducts, "personalizados")).toBe(2);
    const p = demoProducts.find((x) => x.slug === "placa-nome")!;
    expect(relatedProducts(demoProducts, p).map((x) => x.slug)).toEqual(["chaveiro-personalizado"]);
  });
});
