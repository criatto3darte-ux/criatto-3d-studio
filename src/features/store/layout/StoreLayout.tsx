import type { ReactNode } from "react";
import { StoreHeader } from "./StoreHeader";
import { StoreFooter } from "./StoreFooter";

export function StoreLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <a href="#conteudo" className="sr-only">Pular para o conteúdo</a>
      <StoreHeader />
      <main id="conteudo">{children}</main>
      <StoreFooter />
    </>
  );
}
