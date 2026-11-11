import { createFileRoute } from "@tanstack/react-router";
import { Hero } from "@/features/store/home/Hero";
import { StagePlaceholder } from "@/shared/ui/StagePlaceholder";

export const Route = createFileRoute("/_store/")({
  head: () => ({
    meta: [
      { title: "Criatto 3D — Suas ideias ganham forma" },
      { name: "description", content: "Produtos 3D criativos para transformar seu dia a dia: decoração, geek, casa, vasos, presentes e peças personalizadas." },
      { property: "og:title", content: "Criatto 3D — Suas ideias ganham forma" },
      { property: "og:description", content: "Produtos 3D criativos para transformar seu dia a dia." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  return (
    <>
      <Hero />
      <div className="container">
        <StagePlaceholder
          title="Categorias e destaques"
          description="Os cards de categorias e os produtos em destaque da Criatto 3D entram na próxima etapa."
          stage="CR-002"
        />
      </div>
    </>
  );
}
