// /auth/set-password
//
// Tela de definição da senha inicial do administrador convidado.
//
// O usuário chega aqui depois de /auth/callback trocar o código por sessão.
// Um convite por e-mail do Supabase tipicamente força a troca de senha no
// primeiro acesso (recovery/invite flow), mas aqui explicitamos um formulário
// com política forte (12+ caracteres, pelo menos 3 classes de caracteres),
// confirmação, e atualização via `supabase.auth.updateUser({ password })`.
//
// Após sucesso, redireciona para /auth/mfa para matrícula TOTP.
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { AuthCard, ErrorBox, InfoBox, SuccessBox } from "@/features/auth/ui/AuthCard";
import { getSupabase, isSupabaseConfigured, useSession } from "@/lib/supabase/client";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { checkPassword, PASSWORD_POLICY } from "@/features/auth/lib/passwordPolicy";

export const Route = createFileRoute("/auth/set-password")({
  head: () => ({
    meta: [
      { title: "Defina sua senha — Criatto 3D" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: SetPasswordPage,
  beforeLoad: () => {
    if (!isSupabaseConfigured()) return; // erro mostrado pelo componente
  },
});

function SetPasswordPage() {
  const session = useSession();
  const navigate = Route.useNavigate();
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Sem sessão → volta para o início.
    if (session.status === "unauthenticated") {
      void navigate({ to: "/auth/login", replace: true });
    }
  }, [session.status, navigate]);

  const policy = checkPassword(pw1);
  const canSubmit = policy.ok && pw1 === pw2 && pw1.length > 0 && !submitting;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const supabase = getSupabase();
      const { error } = await supabase.auth.updateUser({ password: pw1 });
      if (error) throw error;
      setInfo("Senha definida com sucesso. Encaminhando para MFA…");
      await new Promise((r) => setTimeout(r, 600));
      await navigate({ to: "/auth/mfa", replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao definir senha.");
    } finally {
      setSubmitting(false);
    }
  }

  const email = session.status === "authenticated" ? session.session.user.email : undefined;

  return (
    <AuthCard
      title="Defina sua senha"
      subtitle={
        email
          ? `Conectado como ${email}. Defina uma senha forte (mínimo 12 caracteres, ao menos 3 classes).`
          : "Defina uma senha forte para continuar."
      }
      step="password"
    >
      {error && <ErrorBox>{error}</ErrorBox>}
      {info && <SuccessBox>{info}</SuccessBox>}

      <form
        onSubmit={onSubmit}
        autoComplete="new-password"
        aria-label="Definir senha"
        style={{ display: "grid", gap: "0.85rem" }}
      >
        <Input
          label="Senha"
          id="new-password"
          type="password"
          autoComplete="new-password"
          value={pw1}
          onChange={(e) => setPw1(e.target.value)}
          placeholder="mínimo 12 caracteres"
          minLength={12}
          required
          data-testid="new-password"
        />
        <PasswordHint policy={policy} />
        <Input
          label="Confirmar senha"
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          value={pw2}
          onChange={(e) => setPw2(e.target.value)}
          placeholder="repita a senha"
          minLength={12}
          required
          error={pw2.length > 0 && pw1 !== pw2 ? "As senhas não coincidem." : undefined}
          data-testid="confirm-password"
        />
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "0.6rem",
            marginTop: "0.4rem",
          }}
        >
          <Button type="submit" disabled={!canSubmit} data-testid="submit-password">
            {submitting ? (
              <>
                <span className="spinner" />
                Salvando…
              </>
            ) : (
              "Continuar para o MFA"
            )}
          </Button>
        </div>
      </form>
    </AuthCard>
  );
}

function PasswordHint({ policy }: { policy: ReturnType<typeof checkPassword> }) {
  const Item = ({ ok, text }: { ok: boolean; text: string }) => (
    <li
      style={{
        color: ok ? "var(--color-success)" : "var(--color-text-muted)",
        paddingLeft: "0.15rem",
      }}
    >
      <span aria-hidden style={{ marginRight: "0.4rem" }}>
        {ok ? "✓" : "•"}
      </span>
      {text}
    </li>
  );
  return (
    <ul
      style={{
        listStyle: "none",
        padding: 0,
        margin: 0,
        font: "400 0.8rem/1.5 'Manrope',system-ui,sans-serif",
        display: "grid",
        gap: "0.15rem",
      }}
    >
      <Item ok={policy.lengthOk} text={`Pelo menos ${PASSWORD_POLICY.minLength} caracteres`} />
      <Item
        ok={policy.classesOk}
        text={`Ao menos ${PASSWORD_POLICY.requiredClasses} entre: maiúscula, minúscula, número, símbolo`}
      />
    </ul>
  );
}
