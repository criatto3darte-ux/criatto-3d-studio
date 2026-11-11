import { ArrowRight, Headset, Rocket, ShieldCheck, ShoppingCart, Truck } from "lucide-react";
import { buttonClass } from "@/shared/ui/Button";
import { LogoMark } from "@/shared/ui/Logo";
import { useHeroBanner, useStoreSettings } from "@/features/catalog/catalog.service";
import styles from "./Hero.module.css";
import { cx } from "@/shared/utils/cx";

export function Hero() {
  const settings = useStoreSettings();
  const banner = useHeroBanner();
  const features = [
    { icon: ShieldCheck, label: "Qualidade e precisão" },
    { icon: Rocket, label: "Produção sob demanda" },
    ...(settings.offersNationalShipping ? [{ icon: Truck, label: "Envio para todo o Brasil" }] : []),
    { icon: Headset, label: "Atendimento personalizado" },
  ];
  const title = banner?.title ?? "Suas ideias";
  const highlight = banner ? banner.highlight : "ganham forma.";
  const subtitle = banner?.subtitle ?? "Produtos 3D criativos para transformar seu dia a dia.";
  const cta = banner?.buttonText ?? "Explorar produtos";
  const href = banner?.buttonUrl ?? "/produtos";
  const image = banner?.image ?? "";
  const external = /^https:\/\//.test(href);
  return (
    <section className={styles.hero} aria-labelledby="hero-title">
      <div className={cx("container", styles.inner)}>
        <div>
          <p className={styles.eyebrow}>Criatividade sem limites</p>
          <h1 id="hero-title" className={styles.title}>
            {title}{highlight && <> <span className="text-gradient">{highlight}</span></>}
          </h1>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          <a href={href} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})} className={cx(buttonClass("primary", "lg"), styles.cta)}>
            <ShoppingCart size={20} /> {cta} <ArrowRight size={20} />
          </a>
          <ul className={styles.features}>
            {features.map(({ icon: Icon, label }) => (
              <li key={label} className={styles.feature}><Icon size={26} strokeWidth={1.6} /> {label}</li>
            ))}
          </ul>
        </div>
        <div className={styles.visual}>
          {image ? (
            <img className={styles.photo} src={image} alt="Produtos impressos em 3D da Criatto 3D" fetchPriority="high" />
          ) : (
            <>
              <LogoMark className={styles.cube} />
              <span className={styles.placeholderTag}>Espaço reservado para a foto do banner</span>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
