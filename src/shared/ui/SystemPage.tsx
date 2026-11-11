import type { ReactNode } from "react";
import styles from "./SystemPage.module.css";

export function SystemPage({ code, title, text, actions }: { code?: string; title: string; text: string; actions: ReactNode }) {
  return (
    <div className={styles.page}>
      <div className={styles.box}>
        {code && <p className={`${styles.code} text-gradient`}>{code}</p>}
        <h1>{title}</h1>
        <p className={styles.text}>{text}</p>
        <div className={styles.actions}>{actions}</div>
      </div>
    </div>
  );
}
