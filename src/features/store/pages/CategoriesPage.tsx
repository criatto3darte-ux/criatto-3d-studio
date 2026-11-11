import { useStoreCatalog } from "@/features/catalog/catalog.service";
import { countByCategory } from "@/features/catalog/catalog.logic";
import { CategoryGrid } from "../components/CategoryCard";
import { PageHeader } from "../components/Section";

export function CategoriesPage() {
  const { products, categories } = useStoreCatalog();
  return (
    <div className="container">
      <PageHeader eyebrow="Explore" title="Categorias" text="Escolha uma categoria para ver os produtos." />
      <CategoryGrid items={categories.map((c) => ({ category: c, count: countByCategory(products, c.slug) }))} />
    </div>
  );
}
