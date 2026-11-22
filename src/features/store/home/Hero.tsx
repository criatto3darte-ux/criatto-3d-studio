import { ArrowRight, Headset, Rocket, ShieldCheck, ShoppingCart, Truck } from "lucide-react";
import { buttonClass } from "@/shared/ui/Button";
import { Logo, LogoMark } from "@/shared/ui/Logo";
import { useStoreContent } from "@/features/catalog/store-content";
import styles from "./Hero.module.css";
import { cx } from "@/shared/utils/cx";
import { safeUrl } from "@/shared/utils/safe-url";

export function Hero() {
  const { state, settings, banner } = useStoreContent();
  const loading = state === "loading";
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
  const href = safeUrl(banner?.buttonUrl) ?? "/produtos";
  const image = safeUrl(banner?.image);
  const external = /^https:\/\//.test(href);
  const showLogo = banner?.heroStyle === "logo";
  const headline = [title, highlight].filter(Boolean).join(" ") || settings.name;
  return (
    <section className={styles.hero} aria-labelledby="hero-title">
      <div className={cx("container", styles.inner)}>
        <div aria-busy={loading || undefined}>
          {loading ? (
            // Primeira visita: espaço neutro até o banner salvo chegar,
            // sem mostrar textos padrão que logo seriam trocados.
            <h1 id="hero-title" className={styles.skeletonTitle}>
              <span className="sr-only">{settings.name}</span>
              <span className={styles.skeletonLine} aria-hidden />
              <span className={styles.skeletonLineShort} aria-hidden />
            </h1>
          ) : showLogo ? (
            <h1 id="hero-title" className={styles.logoTitle}>
              <Logo variant="full" size="hero" name={settings.name} logo={settings.logo} alt={headline} />
            </h1>
          ) : (
            <>
              <p className={styles.eyebrow}>Criatividade sem limites</p>
              <h1 id="hero-title" className={styles.title}>
                {title}{highlight && <> <span className="text-gradient">{highlight}</span></>}
              </h1>
              {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
            </>
          )}
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
          ) : loading ? null : (
            <LogoMark className={styles.cube} />
          )}
        </div>
      </div>
    </section>
  );
}
