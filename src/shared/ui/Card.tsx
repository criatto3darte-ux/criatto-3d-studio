import type { HTMLAttributes } from "react";
import styles from "./Card.module.css";
import { cx } from "@/shared/utils/cx";

export function Card({ padded = true, interactive, className, ...rest }: HTMLAttributes<HTMLDivElement> & { padded?: boolean; interactive?: boolean }) {
  return <div className={cx(styles.card, padded && styles.padded, interactive && styles.interactive, className)} {...rest} />;
}
