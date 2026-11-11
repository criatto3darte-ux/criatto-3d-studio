import type { ReactNode } from "react";
import styles from "./Badge.module.css";
import { cx } from "@/shared/utils/cx";

export type BadgeTone = "neutral" | "primary" | "success" | "warning" | "danger" | "purple" | "yellow" | "cyan" | "magenta";

export function Badge({ tone = "neutral", children, className }: { tone?: BadgeTone; children: ReactNode; className?: string | undefined }) {
  return <span className={cx(styles.badge, styles[tone], className)}>{children}</span>;
}
