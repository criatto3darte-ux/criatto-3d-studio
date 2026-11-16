import type { ReactNode } from "react";
import { StoreHeader } from "./StoreHeader";
import { StoreFooter } from "./StoreFooter";
import { PublicDemoBanner } from "./PublicDemoBanner";

export function StoreLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <a href="#conteudo" className="sr-only">
        Pular para o conteúdo
      </a>
      <PublicDemoBanner />
      <StoreHeader />
      <main id="conteudo">{children}</main>
      <StoreFooter />
    </>
  );
}
