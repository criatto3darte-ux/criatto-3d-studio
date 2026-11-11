import { Link } from "@tanstack/react-router";
import { Boxes, PackageCheck, Paintbrush, PenTool } from "lucide-react";
import { buttonClass } from "@/shared/ui/Button";
import { PageHeader, Section } from "../components/Section";
import styles from "./InfoPages.module.css";

const steps = [
  { icon: PenTool, title: "Modelagem", text: "A ideia vira um modelo digital pronto para impressão." },
  { icon: Boxes, title: "Impressão 3D", text: "A peça é fabricada camada por camada." },
  { icon: Paintbrush, title: "Acabamento", text: "Retiramos suportes e conferimos cada detalhe." },
  { icon: PackageCheck, title: "Entrega", text: "Embalamos com cuidado e combinamos a entrega com você." },
];

export function AboutPage() {
  return (
    <div className="container">
      <PageHeader eyebrow="Quem somos" title="Sobre a Criatto 3D" />
      <div className={styles.prose}>
        <p>A Criatto 3D cria produtos por impressão 3D para decorar, organizar e presentear, com qualidade, precisão e atendimento personalizado.</p>
        <p className={styles.muted}>Texto provisório: a história da marca será incluída quando for enviada pela Criatto 3D.</p>
      </div>
      <Section id="processo" eyebrow="Como trabalhamos" title="Do arquivo à sua mão">
        <ol className={styles.steps}>
          {steps.map(({ icon: Icon, title, text }) => (
            <li key={title} className={styles.step}><Icon size={28} strokeWidth={1.6} aria-hidden="true" /><h3>{title}</h3><p className={styles.muted}>{text}</p></li>
          ))}
        </ol>
      </Section>
      <div style={{ marginTop: 32, display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Link to="/produtos" className={buttonClass("primary")}>Ver produtos</Link>
        <Link to="/personalizados" className={buttonClass("outline")}>Solicitar personalizado</Link>
      </div>
    </div>
  );
}
