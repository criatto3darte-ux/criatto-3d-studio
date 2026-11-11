import type { CSSProperties, ReactNode } from "react";
import styles from "./MediaImage.module.css";
import { cx } from "@/shared/utils/cx";

export interface MediaImageProps {
  src?: string | undefined;
  alt: string;
  /** CSS aspect-ratio, keeps layout stable and avoids distortion. */
  ratio?: string;
  /** Icon shown when there is no photo yet. */
  fallbackIcon?: ReactNode;
  accent?: string | undefined;
  showTag?: boolean;
  eager?: boolean;
  className?: string | undefined;
}

/** Image that works with a real file or a labelled placeholder (no fake photos). */
export function MediaImage({ src, alt, ratio = "1 / 1", fallbackIcon, accent, showTag = true, eager, className }: MediaImageProps) {
  const style = { aspectRatio: ratio, ...(accent ? { "--accent": accent } : {}) } as CSSProperties;
  return (
    <div className={cx(styles.frame, className)} style={style}>
      {src ? (
        <img className={styles.img} src={src} alt={alt} loading={eager ? "eager" : "lazy"} decoding="async" />
      ) : (
        <div className={styles.placeholder} role="img" aria-label={`${alt} (imagem ilustrativa)`}>
          {fallbackIcon}
          {showTag && <span className={styles.tag} aria-hidden="true">Imagem ilustrativa</span>}
        </div>
      )}
    </div>
  );
}
