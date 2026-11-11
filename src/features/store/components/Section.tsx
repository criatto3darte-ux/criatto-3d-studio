import type { ReactNode } from "react";
import styles from "./Section.module.css";

export function Section({ id, eyebrow, title, text, action, children }: { id: string; eyebrow?: string; title: string; text?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className={styles.section} aria-labelledby={id}>
      <div className={styles.head}>
        <div>
          {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
          <h2 id={id} className={styles.title}>{title}</h2>
          {text && <p className={styles.text}>{text}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function PageHeader({ eyebrow, title, text }: { eyebrow?: string; title: string; text?: string }) {
  return (
    <header className={styles.pageHead}>
      {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
      <h1 className={styles.pageTitle}>{title}</h1>
      {text && <p className={styles.text}>{text}</p>}
    </header>
  );
}

export const sectionLinkClass = styles.link;
