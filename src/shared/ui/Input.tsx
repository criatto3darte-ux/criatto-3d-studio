import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";
import styles from "./Input.module.css";
import { cx } from "@/shared/utils/cx";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  trailing?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ label, hint, error, trailing, className, id, ...rest }, ref) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <div className={cx(styles.field, className)}>
      {label && <label htmlFor={inputId} className={styles.label}>{label}</label>}
      <div className={styles.wrap}>
        <input ref={ref} id={inputId} aria-invalid={!!error || undefined} className={cx(styles.input, !!trailing && styles.withIcon)} {...rest} />
        {trailing && <span className={styles.iconSlot}>{trailing}</span>}
      </div>
      {error ? <span className={styles.error}>{error}</span> : hint ? <span className={styles.hint}>{hint}</span> : null}
    </div>
  );
});
