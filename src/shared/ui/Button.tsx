import { forwardRef, type ButtonHTMLAttributes } from "react";
import styles from "./Button.module.css";
import { cx } from "@/shared/utils/cx";

export type ButtonVariant = "primary" | "outline" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  square?: boolean;
}

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", extra?: string) {
  return cx(styles.button, styles[variant], styles[size], extra);
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", block, square, className, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={buttonClass(variant, size, cx(block && styles.block, square && styles.square, className))}
      {...rest}
    />
  );
});
