import { useEffect } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useStoreCatalog } from "@/features/catalog/catalog.service";
import { productMetadata } from "@/features/catalog/product.metadata";
import { ProductPage } from "@/features/store/pages/ProductPage";
import { SystemPage } from "@/shared/ui/SystemPage";
import { buttonClass } from "@/shared/ui/Button";

export const Route = createFileRoute("/_store/produto/$slug")({
  head: ({ params, match }) =>
    productMetadata(
      match.context.productMetadataCatalog?.find((product) => product.slug === params.slug),
      params.slug,
      match.context.productMetadataCatalog !== undefined,
    ),
  component: Page,
});

function NotFoundProduct() {
  return (
    <SystemPage
      code="404"
      title="Produto não encontrado"
      text="Este produto não existe ou não está publicado no catálogo."
      actions={
        <Link to="/produtos" className={buttonClass("primary")}>
          Ver produtos
        </Link>
      }
    />
  );
}

function Page() {
  const { slug } = Route.useParams();
  const router = useRouter();
  const catalog = useStoreCatalog();
  const product = catalog.bySlug(slug);

  useEffect(() => {
    if (catalog.state !== "ready") return;
    router.update({
      context: { ...router.options.context, productMetadataCatalog: catalog.products },
    });
    void router.invalidate({ filter: (match) => match.routeId === Route.id });
  }, [router, catalog.state, catalog.products, slug]);

  if (catalog.state === "loading")
    return (
      <SystemPage
        title="Carregando produto"
        text="Consultando o catálogo da Criatto 3D…"
        actions={
          <Link to="/produtos" className={buttonClass("outline")}>
            Voltar ao catálogo
          </Link>
        }
      />
    );
  if (catalog.state === "error")
    return (
      <SystemPage
        title="Catálogo indisponível"
        text={catalog.error ?? "Não foi possível consultar os produtos."}
        actions={
          <Link to="/produtos" className={buttonClass("outline")}>
            Voltar ao catálogo
          </Link>
        }
      />
    );
  if (!product) return <NotFoundProduct />;
  return <ProductPage key={product.id} product={product} />;
}
