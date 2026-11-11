import { FlaskConical } from "lucide-react";
import styles from "./DemoNotice.module.css";

export function DemoNotice({ children = "Modo demonstração: os dados exibidos são simulados e não representam vendas reais." }: { children?: string }) {
  return (
    <p className={styles.notice} role="note">
      <FlaskConical size={16} aria-hidden="true" /> {children}
    </p>
  );
}
