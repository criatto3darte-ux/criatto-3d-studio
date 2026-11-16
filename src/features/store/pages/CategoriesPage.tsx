import { useStoreCatalog } from "@/features/catalog/catalog.service";
import { countByCategory } from "@/features/catalog/catalog.logic";
import { CategoryGrid } from "../components/CategoryCard";
import { PageHeader } from "../components/Section";

export function CategoriesPage() {
  const catalog = useStoreCatalog();
  return (
    <div className="container">
      <PageHeader
        eyebrow="Explore"
        title="Categorias"
        text="Escolha uma categoria para ver os produtos."
      />
      {catalog.categories.length > 0 ? (
        <CategoryGrid
          items={catalog.categories.map((category) => ({
            category,
            count: countByCategory(catalog.products, category.slug),
          }))}
        />
      ) : (
        <p role={catalog.state === "error" ? "alert" : "status"}>
          {catalog.state === "loading"
            ? "Carregando categorias…"
            : catalog.state === "error"
              ? catalog.error
              : "Ainda não há categorias publicadas."}
        </p>
      )}
    </div>
  );
}
