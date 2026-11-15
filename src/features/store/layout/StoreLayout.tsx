import type { ReactNode } from "react";
import { StoreHeader } from "./StoreHeader";
import { StoreFooter } from "./StoreFooter";
import { StorageNotice } from "@/features/demo-data/StorageNotice";
import { PublicDemoBanner } from "./PublicDemoBanner";

export function StoreLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <a href="#conteudo" className="sr-only">Pular para o conteúdo</a>
      <PublicDemoBanner />
      <StoreHeader />
      <main id="conteudo">
        <div className="container">
          <StorageNotice />
        </div>
        {children}
      </main>
      <StoreFooter />
    </>
  );
}
