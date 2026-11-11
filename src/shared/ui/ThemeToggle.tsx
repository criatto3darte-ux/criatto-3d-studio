import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/shared/theme/ThemeProvider";
import { Button } from "./Button";
import styles from "./ThemeToggle.module.css";
import { cx } from "@/shared/utils/cx";

/** Icon-only toggle for headers. */
export function ThemeToggleButton() {
  const { theme, toggle } = useTheme();
  const label = theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro";
  return (
    <Button variant="ghost" size="icon" onClick={toggle} aria-label={label} title={label}>
      {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
    </Button>
  );
}

/** Segmented "Claro / Escuro" control, as in the admin reference. */
export function ThemeSegmented({ full }: { full?: boolean }) {
  const { theme, setTheme } = useTheme();
  return (
    <div className={cx(styles.segmented, full && styles.full)} role="radiogroup" aria-label="Tema">
      <button type="button" role="radio" aria-checked={theme === "light"} className={cx(styles.segment, theme === "light" && styles.active)} onClick={() => setTheme("light")}>
        <Sun size={16} /> Claro
      </button>
      <button type="button" role="radio" aria-checked={theme === "dark"} className={cx(styles.segment, theme === "dark" && styles.active)} onClick={() => setTheme("dark")}>
        <Moon size={16} /> Escuro
      </button>
    </div>
  );
}
