import styles from "./Logo.module.css";
import { cx } from "@/shared/utils/cx";
import { useState } from "react";
import { safeUrl } from "@/shared/utils/safe-url";

/** Isometric gradient cube used as the Criatto 3D mark. Replace with the official SVG when available. */
export function LogoMark({ className }: { className?: string | undefined }) {
  return (
    <svg viewBox="0 0 64 64" className={cx(styles.mark, className)} aria-hidden="true">
      <defs>
        <linearGradient id="cr-top" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FFBF00" /><stop offset="1" stopColor="#FF4D6D" /></linearGradient>
        <linearGradient id="cr-left" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#E900D6" /><stop offset="1" stopColor="#A855F7" /></linearGradient>
        <linearGradient id="cr-right" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#00E5F0" /><stop offset="1" stopColor="#168BFF" /></linearGradient>
      </defs>
      <path d="M32 6 56 19 32 32 8 19Z" fill="url(#cr-top)" />
      <path d="M8 19 32 32v26L8 45Z" fill="url(#cr-left)" />
      <path d="M56 19 32 32v26l24-13Z" fill="url(#cr-right)" />
      <path d="M32 18 44 24.5 32 31 20 24.5Z" fill="#080B14" opacity=".55" />
    </svg>
  );
}

export function Logo({ compact, showText = true, name = "Criatto 3D", logo = "" }: { compact?: boolean; showText?: boolean; name?: string; logo?: string }) {
  const [failedSrc, setFailedSrc] = useState<string | undefined>();
  const src = safeUrl(logo);
  return (
    <span className={cx(styles.logo, compact && styles.compact)}>
      {src && failedSrc !== src ? <img key={src} src={src} className={styles.customMark} alt={`Logotipo de ${name}`} onError={() => setFailedSrc(src)} /> : <LogoMark />}
      {showText && (
        <span className={styles.text}>
          <span className={styles.name}>{name === "Criatto 3D" ? <>Criatto <span>3D</span></> : name}</span>
          <span className={styles.sub}>Produtos 3D</span>
        </span>
      )}
    </span>
  );
}
