import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { catalogService } from "@/features/catalog/catalog.service";
import { ProductPage } from "@/features/store/pages/ProductPage";
import { SystemPage } from "@/shared/ui/SystemPage";
import { buttonClass } from "@/shared/ui/Button";

export const Route = createFileRoute("/_store/produto/$slug")({
  loader: ({ params }) => {
    const product = catalogService.bySlug(params.slug);
    if (!product) throw notFound();
    return { product };
  },
  head: ({ loaderData }) => {
    const p = loaderData?.product;
    if (!p) return { meta: [{ title: "Produto não encontrado — Criatto 3D" }, { name: "robots", content: "noindex" }] };
    const title = `${p.name} — Criatto 3D`;
    return {
      meta: [
        { title },
        { name: "description", content: p.description },
        { property: "og:title", content: title },
        { property: "og:description", content: p.description },
        { property: "og:type", content: "product" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: Page,
  notFoundComponent: () => (
    <SystemPage code="404" title="Produto não encontrado" text="Este produto não existe ou foi removido do catálogo." actions={<Link to="/produtos" className={buttonClass("primary")}>Ver produtos</Link>} />
  ),
});

function Page() {
  const { product } = Route.useLoaderData();
  return <ProductPage key={product.id} product={product} />;
}
