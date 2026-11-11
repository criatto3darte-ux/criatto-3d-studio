import { Link } from "@tanstack/react-router";
import { ArrowRight, Headset, Rocket, ShieldCheck, ShoppingCart, Truck } from "lucide-react";
import { buttonClass } from "@/shared/ui/Button";
import { LogoMark } from "@/shared/ui/Logo";
import { storeConfig } from "@/shared/config/store.config";
import styles from "./Hero.module.css";
import { cx } from "@/shared/utils/cx";

const features = [
  { icon: ShieldCheck, label: "Qualidade e precisão" },
  { icon: Rocket, label: "Produção sob demanda" },
  ...(storeConfig.offersNationalShipping ? [{ icon: Truck, label: "Envio para todo o Brasil" }] : []),
  { icon: Headset, label: "Atendimento personalizado" },
];

export function Hero() {
  return (
    <section className={styles.hero} aria-labelledby="hero-title">
      <div className={cx("container", styles.inner)}>
        <div>
          <p className={styles.eyebrow}>Criatividade sem limites</p>
          <h1 id="hero-title" className={styles.title}>
            Suas ideias <span className="text-gradient">ganham forma.</span>
          </h1>
          <p className={styles.subtitle}>Produtos 3D criativos para transformar seu dia a dia.</p>
          <Link to="/produtos" className={cx(buttonClass("primary", "lg"), styles.cta)}>
            <ShoppingCart size={20} /> Explorar produtos <ArrowRight size={20} />
          </Link>
          <ul className={styles.features}>
            {features.map(({ icon: Icon, label }) => (
              <li key={label} className={styles.feature}><Icon size={26} strokeWidth={1.6} /> {label}</li>
            ))}
          </ul>
        </div>
        <div className={styles.visual}>
          <LogoMark className={styles.cube} />
          <span className={styles.placeholderTag}>Espaço reservado para a foto do banner</span>
        </div>
      </div>
    </section>
  );
}
