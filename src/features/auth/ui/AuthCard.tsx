import type { ReactNode } from "react";
import styles from "./AuthCard.module.css";
import { cx } from "@/shared/utils/cx";

interface AuthCardProps {
  title: string;
  subtitle?: string | undefined;
  step: "accept" | "password" | "mfa" | "done";
  children: ReactNode;
  footer?: ReactNode;
}

const STEPS: Array<{ key: AuthCardProps["step"]; label: string }> = [
  { key: "accept", label: "Convite" },
  { key: "password", label: "Senha" },
  { key: "mfa", label: "MFA" },
  { key: "done", label: "Concluído" },
];

export function AuthCard({ title, subtitle, step, children, footer }: AuthCardProps) {
  const activeIdx = STEPS.findIndex((s) => s.key === step);
  return (
    <main className={styles.shell} aria-labelledby="auth-card-title">
      <section className={styles.card} role="region" aria-label="Onboarding de acesso">
        <header className={styles.brand}>
          <div className={styles.logo} aria-hidden>
            C
          </div>
          <div className={styles.brandText}>
            <h1>Criatto 3D</h1>
            <p>Onboarding administrativo · homologação</p>
          </div>
        </header>

        <ol className={styles.steps} aria-label="Etapas do onboarding">
          {STEPS.map((s, i) => (
            <li
              key={s.key}
              className={cx(i < activeIdx && styles.done, i === activeIdx && styles.current)}
              aria-current={i === activeIdx ? "step" : undefined}
            >
              <span className={styles.dot} aria-hidden />
              <span>{s.label}</span>
            </li>
          ))}
        </ol>

        <h2 id="auth-card-title" className={styles.title}>
          {title}
        </h2>
        {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}

        {children}

        {footer ? <footer className={styles.footer}>{footer}</footer> : null}
      </section>
    </main>
  );
}

export function ErrorBox({ children }: { children: ReactNode }) {
  return (
    <div className={styles.errorBox} role="alert">
      {children}
    </div>
  );
}

export function SuccessBox({ children }: { children: ReactNode }) {
  return (
    <div className={styles.successBox} role="status">
      {children}
    </div>
  );
}

export function InfoBox({ children }: { children: ReactNode }) {
  return <div className={styles.infoBox}>{children}</div>;
}
