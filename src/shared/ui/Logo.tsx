// Logo oficial da Criatto 3D (versão 2026).
//
// Variantes de imagem (em /branding/) geradas a partir do PNG oficial enviado
// pelo cliente (1535×1024). O fundo preto original foi removido (canal alpha)
// para que o logo funcione em qualquer superfície, tanto no tema claro quanto
// no escuro, sem moldura artificial. Os gradientes do cubo e da tipografia
// (azul→ciano→magenta→laranja) são preservados.
//
//  - logo-full-dark.png / .webp  : logotipo completo (cubo + "Criatto 3D" + tagline "PRODUTOS 3D").
//  - logo-mark-dark.png / .webp  : apenas o cubo/símbolo (mobile, sidebar colapsada, fav-like usos).
//
// Um logo customizado (definido em store settings) substitui o oficial
// se fornecido; caso contrário usamos os assets aprovados.

import { useEffect, useState } from "react";
import styles from "./Logo.module.css";
import { cx } from "@/shared/utils/cx";
import { safeUrl } from "@/shared/utils/safe-url";

const FULL_WEBP = "/branding/logo-full-dark.webp";
const FULL_PNG = "/branding/logo-full-dark.png";
const MARK_WEBP = "/branding/logo-mark-dark.webp";
const MARK_PNG = "/branding/logo-mark-dark.png";

function supportsWebP(): boolean {
  if (typeof document === "undefined") return false;
  const cached = (supportsWebP as { _c?: boolean })._c;
  if (cached !== undefined) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const ok = canvas.toDataURL("image/webp").startsWith("data:image/webp");
  (supportsWebP as { _c?: boolean })._c = ok;
  return ok;
}

type LogoVariant = "full" | "mark";

interface LogoProps {
  /** Usa só o símbolo (header mobile, sidebar colapsada, menu admin). */
  compact?: boolean;
  /** Exibe o texto ao lado do símbolo (default: true). */
  showText?: boolean;
  /** Nome da loja (default: "Criatto 3D"). */
  name?: string;
  /** URL de logo customizado vindo de store settings — substitui o mark oficial. */
  logo?: string;
  /** Variante visual. Se omitido, `compact ⇒ mark`, senão `full`. */
  variant?: LogoVariant;
  /** Classe extra aplicada ao <span> raiz. */
  className?: string | undefined;
  /** Atributo alt (acessibilidade). Default depende de `name`. */
  alt?: string | undefined;
}

/** Alias legado: o Hero da landing renderiza o cubo grande decorativo. */
export function LogoMark({ className }: { className?: string | undefined }) {
  return (
    <span className={cx(styles.logo, styles.markOnly, styles.logoMark, className)}>
      <img
        src={MARK_PNG}
        className={styles.image}
        alt=""
        aria-hidden
        width={156}
        height={156}
        loading="lazy"
        decoding="async"
        draggable={false}
      />
    </span>
  );
}

export function Logo({
  compact = false,
  showText = true,
  name = "Criatto 3D",
  logo = "",
  variant,
  className,
  alt,
}: LogoProps) {
  // Hidrata no cliente para escolher WebP ou PNG; em SSR renderiza PNG (seguro).
  const [webp, setWebp] = useState(false);
  useEffect(() => {
    setWebp(supportsWebP());
  }, []);

  const effectiveVariant: LogoVariant = variant ?? (compact ? "mark" : showText ? "full" : "mark");
  const customSrc = safeUrl(logo);
  const src =
    customSrc ||
    (webp
      ? effectiveVariant === "full"
        ? FULL_WEBP
        : MARK_WEBP
      : effectiveVariant === "full"
        ? FULL_PNG
        : MARK_PNG);

  const isFull = effectiveVariant === "full";

  return (
    <span
      className={cx(
        styles.logo,
        compact && styles.compact,
        isFull ? styles.full : styles.markOnly,
        className,
      )}
    >
      <img
        key={src}
        src={src}
        className={styles.image}
        alt={alt ?? (customSrc ? `Logotipo de ${name}` : `${name} — logotipo oficial`)}
        loading="eager"
        decoding="async"
        width={isFull ? 68 : 42}
        height={isFull ? 44 : 42}
        draggable={false}
      />
    </span>
  );
}
