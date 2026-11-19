import type { ReactNode } from "react";
import styles from "./AuthCard.module.css";
import { cx } from "@/shared/utils/cx";
import { Logo } from "@/shared/ui/Logo";

type Step = "accept" | "password" | "mfa" | "done" | "login" | "recover";

interface AuthCardProps {
  title: string;
  subtitle?: string | undefined;
  step: Step;
  children: ReactNode;
  footer?: ReactNode;
  /** Hide the horizontal stepper (used on /admin/login and password recovery
   *  which don't fit the invite onboarding flow). */
  hideSteps?: boolean;
  /** Override the step label for non-onboarding flows. */
  badge?: string | undefined;
}

const STEPS: Array<{ key: Step; label: string }> = [
  { key: "accept", label: "Convite" },
  { key: "password", label: "Senha" },
  { key: "mfa", label: "MFA" },
  { key: "done", label: "Concluído" },
];

export function AuthCard({
  title,
  subtitle,
  step,
  children,
  footer,
  hideSteps = false,
  badge,
}: AuthCardProps) {
  const activeIdx = STEPS.findIndex((s) => s.key === step);
  const showSteps = !hideSteps && activeIdx >= 0;
  const brandSubtitle =
    badge ??
    (showSteps ? "Onboarding administrativo · homologação" : "Acesso ao painel · homologação");
  return (
    <main className={styles.shell} aria-labelledby="auth-card-title">
      <section className={styles.card} role="region" aria-label="Acesso administrativo">
        <header className={styles.brand}>
          <Logo variant="mark" compact className={styles.brandMark} alt="" aria-hidden />
          <div className={styles.brandText}>
            <h1>Criatto 3D</h1>
            <p>{brandSubtitle}</p>
          </div>
        </header>

        {showSteps ? (
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
        ) : null}

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
