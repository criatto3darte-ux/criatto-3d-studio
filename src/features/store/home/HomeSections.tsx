import { Link } from "@tanstack/react-router";
import { ArrowRight, Headset, Layers, Palette, ShieldCheck, Sparkles } from "lucide-react";
import { buttonClass } from "@/shared/ui/Button";
import { DemoNotice } from "@/shared/ui/DemoNotice";
import { useStoreCatalog } from "@/features/catalog/catalog.service";
import { countByCategory } from "@/features/catalog/catalog.logic";
import { CategoryGrid } from "../components/CategoryCard";
import { ProductGrid } from "../components/ProductCard";
import { Section, sectionLinkClass } from "../components/Section";
import styles from "./HomeSections.module.css";

const benefits = [
  { icon: ShieldCheck, title: "Qualidade e precisão", text: "Cada peça é conferida antes de ser entregue." },
  { icon: Layers, title: "Produção sob demanda", text: "Fabricamos o que você escolheu, evitando desperdício." },
  { icon: Palette, title: "Cores e tamanhos", text: "Escolha as variações que combinam com você." },
  { icon: Headset, title: "Atendimento personalizado", text: "Tire dúvidas e finalize seu pedido conversando com a gente." },
];

export function HomeSections() {
  const catalogService = useStoreCatalog();
  const { products, categories } = catalogService;
  return (
    <div className="container">
      <Section id="home-categorias" eyebrow="Explore" title="Categorias" action={<Link to="/categorias" className={sectionLinkClass}>Ver todas <ArrowRight size={16} /></Link>}>
        <CategoryGrid items={categories.map((c) => ({ category: c, count: countByCategory(products, c.slug) }))} />
      </Section>

      <Section id="home-destaques" eyebrow="Seleção" title="Produtos em destaque" action={<Link to="/produtos" className={sectionLinkClass}>Ver catálogo <ArrowRight size={16} /></Link>}>
        <DemoNotice>Produtos de demonstração: nomes, preços e estoques são fictícios.</DemoNotice>
        <div style={{ height: 16 }} />
        <ProductGrid products={catalogService.featured().slice(0, 8)} />
      </Section>

      <Section id="home-novidades" eyebrow="Acabou de chegar" title="Novidades">
        <ProductGrid products={catalogService.newest().slice(0, 4)} />
      </Section>

      <section className={styles.custom} aria-labelledby="home-personalizados">
        <div>
          <p className={styles.eyebrow}>Sob medida</p>
          <h2 id="home-personalizados">Tem uma ideia? A gente imprime.</h2>
          <p className={styles.muted}>Conte o que você imagina — tamanho, cores e uma imagem de referência — e preparamos uma peça exclusiva.</p>
          <div className={styles.actions}>
            <Link to="/personalizados" className={buttonClass("primary")}><Sparkles size={18} /> Solicitar personalizado</Link>
            <Link to="/produtos" search={{ categoria: "personalizados" }} className={buttonClass("outline")}>Ver exemplos</Link>
          </div>
        </div>
        <ol className={styles.steps}>
          {["Descreva sua ideia", "Receba o orçamento", "Aprovou? Produzimos"].map((s, i) => (
            <li key={s}><span className={styles.num}>{i + 1}</span> {s}</li>
          ))}
        </ol>
      </section>

      <Section id="home-beneficios" eyebrow="Por que a Criatto 3D" title="Benefícios">
        <ul className={styles.benefits}>
          {benefits.map(({ icon: Icon, title, text }) => (
            <li key={title} className={styles.benefit}><Icon size={28} strokeWidth={1.6} aria-hidden="true" /><h3>{title}</h3><p className={styles.muted}>{text}</p></li>
          ))}
        </ul>
      </Section>

      <section className={styles.cta} aria-labelledby="home-contato">
        <h2 id="home-contato">Ficou com alguma dúvida?</h2>
        <p className={styles.muted}>Fale com a Criatto 3D. Os pedidos são finalizados pelo WhatsApp, sem cadastro.</p>
        <div className={styles.actions}>
          <Link to="/contato" className={buttonClass("primary")}>Fale conosco</Link>
          <Link to="/sobre" className={buttonClass("secondary")}>Conheça a Criatto 3D</Link>
        </div>
      </section>
    </div>
  );
}
