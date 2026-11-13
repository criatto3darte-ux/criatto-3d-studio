import type { ReactNode } from "react";
import { StoreHeader } from "./StoreHeader";
import { StoreFooter } from "./StoreFooter";
import { StorageNotice } from "@/features/demo-data/StorageNotice";

export function StoreLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <a href="#conteudo" className="sr-only">Pular para o conteúdo</a>
      <StoreHeader />
      <main id="conteudo"><div className="container"><StorageNotice /></div>{children}</main>
      <StoreFooter />
    </>
  );
}
