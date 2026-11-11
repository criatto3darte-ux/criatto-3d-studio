import { Hammer } from "lucide-react";
import { Badge } from "./Badge";
import styles from "./StagePlaceholder.module.css";

/** Marks a screen whose content is scheduled for a later development stage. */
export function StagePlaceholder({ title, description, stage }: { title: string; description: string; stage: string }) {
  return (
    <section className={styles.wrap}>
      <div className={styles.box}>
        <div className={styles.icon}><Hammer size={26} /></div>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.text}>{description}</p>
        <div className={styles.stage}><Badge tone="primary">Previsto na etapa {stage}</Badge></div>
      </div>
    </section>
  );
}
