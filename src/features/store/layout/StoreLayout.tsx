import { useEffect, type ReactNode } from "react";
import { startStorefrontRevalidation } from "@/features/catalog/store-content";
import { refreshPublicCatalog } from "@/features/catalog/supabase-catalog";
import { StoreHeader } from "./StoreHeader";
import { StoreFooter } from "./StoreFooter";

export function StoreLayout({ children }: { children: ReactNode }) {
  // Painel salvo em outra aba, aba voltando ao foco ou a cada minuto:
  // a loja aberta recarrega banner, configurações e catálogo sem piscar.
  useEffect(() => startStorefrontRevalidation(() => refreshPublicCatalog({ background: true })), []);
  return (
    <>
      <a href="#conteudo" className="sr-only">
        Pular para o conteúdo
      </a>
      <StoreHeader />
      <main id="conteudo">{children}</main>
      <StoreFooter />
    </>
  );
}
