import { useEffect } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useStoreCatalog } from "@/features/catalog/catalog.service";
import { productMetadata } from "@/features/catalog/product.metadata";
import { getServerSnapshot, useDemoData } from "@/features/demo-data/repository";
import { publicProducts } from "@/features/demo-data/rules";
import { ProductPage } from "@/features/store/pages/ProductPage";
import { SystemPage } from "@/shared/ui/SystemPage";
import { buttonClass } from "@/shared/ui/Button";

export const Route = createFileRoute("/_store/produto/$slug")({
  // SSR sees only the repository's seed snapshot, never a visitor's LocalStorage.
  head: ({ params, match }) => productMetadata(
    publicProducts(match.context.productMetadataCatalog ?? getServerSnapshot()).find((p) => p.slug === params.slug),
    params.slug,
    match.context.productMetadataCatalog !== undefined,
  ),
  component: Page,
});

function NotFoundProduct() {
  return <SystemPage code="404" title="Produto não encontrado" text="Este produto não existe ou foi removido do catálogo." actions={<Link to="/produtos" className={buttonClass("primary")}>Ver produtos</Link>} />;
}

function Page() {
  const { slug } = Route.useParams();
  const router = useRouter();
  const data = useDemoData();
  const product = useStoreCatalog().bySlug(slug);
  // Re-evaluate the route-owned head after hydration and same-/cross-tab edits.
  // No manual document tags or second head manager: navigation removes these tags.
  useEffect(() => {
    router.update({ context: { ...router.options.context, productMetadataCatalog: data } });
    void router.invalidate({ filter: (match) => match.routeId === Route.id });
  }, [router, data, slug]);
  if (!product) return <NotFoundProduct />;
  return <ProductPage key={product.id} product={product} />;
}
