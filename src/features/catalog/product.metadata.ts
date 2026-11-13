import type { MetaHTMLAttributes } from "react";
import type { Product } from "@/shared/types/catalog";

/** The server cannot certify a catalog edited only in browser storage. */
export function productMetadata(product: Product | undefined, slug: string, browserCatalog: boolean) {
  const title = product ? `${product.name} — Criatto 3D` : "Produto não encontrado — Criatto 3D";
  const description = product?.description || (product
    ? `${product.name}: produto de impressão 3D da Criatto 3D.`
    : "Este produto não existe ou foi removido do catálogo.");
  const path = `/produto/${encodeURIComponent(slug)}`;
  const meta: MetaHTMLAttributes<HTMLMetaElement>[] = [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: product ? "product" : "website" },
    { property: "og:url", content: path },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "robots", content: product && browserCatalog ? "index, follow" : "noindex, follow" },
  ];
  // Images in this demo have no guaranteed share-sized rendition. Do not
  // invent a URL or advertise an unsized original as a social preview.
  return { meta, links: [{ rel: "canonical", href: path }] };
}