// /admin/login — Login administrativo (e-mail + senha + MFA obrigatório).
//
// Esta rota substitui o placeholder anterior.
//
// Segurança:
//   * Cadastro público continua fechado (disable_signup=true) — não há link
//     para criar conta nesta tela.
//   * Mensagens de erro são deliberadamente genéricas ("credenciais inválidas"
//     ou "sessão requer MFA") para não vazar existência de contas.
//   * Após signInWithPassword, se a sessão retornada for AAL1 (sem MFA),
//     redirecionamos para /auth/mfa/challenge para completar o segundo
//     fator antes de entrar no admin.
//   * A checagem final de autorização (AAL2 + role) é feita no
//     `adminBeforeLoad` de /admin (isAdminAuthorized), não aqui — esta
//     tela é só porta de entrada.
//   * O link "Esqueci minha senha" chama resetPasswordForEmail com
//     redirectTo apontando para /auth/callback (mesmo fluxo PKCE do
//     convite) e mostra uma confirmação genérica (não revela se o e-mail
//     existe).
//   * Logout é oferecido caso já exista uma sessão parcial (AAL1)
//     abandonada.
import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { AuthCard, ErrorBox, InfoBox, SuccessBox } from "@/features/auth/ui/AuthCard";
import {
  assertSupabaseConfigured,
  getSupabase,
  isSupabaseConfigured,
  useSession,
} from "@/lib/supabase/client";
import { Button, buttonClass } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { sessionAal, sessionRoles, isAdminAuthorized } from "@/features/auth/lib/guards";
import { getRedirectUrl } from "@/features/auth/lib/urls";
import { PASSWORD_POLICY } from "@/features/auth/lib/passwordPolicy";
import { sanitizeAuthError } from "@/features/auth/lib/authErrors";

type Mode = "login" | "recover";

export const Route = createFileRoute("/admin_/login")({
  head: () => ({
    title: "Acesso administrativo — Criatto 3D",
    meta: [
      { name: "description", content: "Entre no painel administrativo da Criatto 3D." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  beforeLoad: () => {
    if (typeof window === "undefined") return;
    if (!isSupabaseConfigured()) {
      throw redirect({ to: "/", replace: true, search: { adminDisabled: "1" } });
    }
  },
  validateSearch: (search: Record<string, unknown>) => {
    const out: { mode: Mode; requested?: string } = {
      mode: search.mode === "recover" ? "recover" : "login",
    };
    if (typeof search.requested === "string") out.requested = search.requested;
    return out;
  },
  component: AdminLoginPage,
});

function AdminLoginPage() {
  const navigate = useNavigate();
  const { mode: initialMode } = Route.useSearch();
  const session = useSession();

  const [mode, setMode] = useState<Mode>(initialMode ?? "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  // Se a sessão já está autenticada E autorizada (AAL2 + role admin), joga
  // direto para o admin. Se está autenticada mas em AAL1 ou sem role,
  // redireciona para o desafio MFA (o usuário estava no meio do fluxo).
  useEffect(() => {
    if (session.status !== "authenticated") return;
    if (isAdminAuthorized(session.session)) {
      void navigate({ to: "/admin", replace: true });
      return;
    }
    if (sessionAal(session.session) === "aal1") {
      // Aguarde o submit se estiver em andamento: a resposta do login
      // determina se o segundo fator deve ser cadastrado ou desafiado.
      if (submitting) return;
      void getSupabase().auth.mfa.listFactors().then(({ data, error }) => {
        if (error) return;
        const verified = (data?.totp ?? []).some((factor) => factor.status === "verified");
        void navigate({
          to: "/auth/mfa",
          replace: true,
          search: { next: verified ? "/admin" : "/auth/done" },
        });
      });
    }
  }, [session.status, session.session, navigate, submitting]);

  useEffect(() => {
    emailRef.current?.focus();
  }, [mode]);

  const emailValid = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()), [email]);
  const pwValid = password.length >= 1;
  const canSubmitLogin = emailValid && pwValid && !submitting;
  const canSubmitRecover = emailValid && !submitting;

  async function onLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!canSubmitLogin) return;
    setSubmitting(true);
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      if (!data.session) throw new Error("Não foi possível iniciar a sessão.");
      // Se a sessão voltou já com AAL2 E roles admin, entra direto.
      if (isAdminAuthorized(data.session)) {
        await navigate({ to: "/admin", replace: true });
        return;
      }
      // Caso contrário: verificar se MFA está configurado. O GoTrue pode
      // retornar a sessão em AAL1; manda para o desafio TOTP.
      const { data: factors, error: fErr } = await supabase.auth.mfa.listFactors();
      if (fErr) throw fErr;
      const hasVerifiedTotp = (factors?.totp ?? []).some((f) => f.status === "verified");
      if (!hasVerifiedTotp) {
        // A conta já autenticou por senha, mas ainda precisa cadastrar TOTP.
        // Não encerramos a sessão: /auth/mfa precisa dela para enroll().
        // Depois da primeira configuração, /auth/done orienta sobre a
        // liberação administrativa, que depende de role separada no banco.
        await navigate({
          to: "/auth/mfa",
          replace: true,
          search: { next: "/auth/done" },
        });
        return;
      }
      await navigate({ to: "/auth/mfa", replace: true, search: { next: "/admin" } });
    } catch (err) {
      setError(sanitizeAuthError(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function onRecover(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!canSubmitRecover) return;
    setSubmitting(true);
    try {
      const supabase = getSupabase();
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: getRedirectUrl("/auth/callback"),
      });
      if (error) throw error;
      // Mensagem genérica — não confirma se o e-mail existe.
      setSuccess(
        "Se o e-mail estiver cadastrado, enviamos um link de redefinição de senha. Verifique sua caixa de entrada e também a pasta de spam.",
      );
      setEmail("");
    } catch (err) {
      setError(sanitizeAuthError(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function signOut() {
    setSubmitting(true);
    try {
      await getSupabase().auth.signOut();
    } finally {
      setSubmitting(false);
      window.location.reload();
    }
  }

  const isLogin = mode === "login";

  return (
    <AuthCard
      title={isLogin ? "Acesso administrativo" : "Redefinir senha"}
      subtitle={
        isLogin
          ? "Entre com seu e-mail e senha. O segundo fator (MFA) é obrigatório."
          : "Enviaremos um link para redefinir sua senha se o e-mail estiver cadastrado."
      }
      step={isLogin ? "login" : "recover"}
      hideSteps
      badge="Painel administrativo · homologação"
      footer={
        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            flexWrap: "wrap",
            justifyContent: "space-between",
          }}
        >
          {isLogin ? (
            <button
              type="button"
              onClick={() => {
                setMode("recover");
                setError(null);
                setSuccess(null);
                void navigate({ to: "/admin/login", search: { mode: "recover" }, replace: true });
              }}
              className={buttonClass("ghost", "sm")}
              disabled={submitting}
            >
              Esqueci minha senha
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError(null);
                setSuccess(null);
                void navigate({ to: "/admin/login", search: { mode: "login" }, replace: true });
              }}
              className={buttonClass("ghost", "sm")}
              disabled={submitting}
            >
              Voltar ao login
            </button>
          )}
          <Link to="/" className={buttonClass("secondary", "sm")}>
            Voltar à loja
          </Link>
        </div>
      }
    >
      {error && <ErrorBox>{error}</ErrorBox>}
      {success && <SuccessBox>{success}</SuccessBox>}

      {isLogin ? (
        <>
          {session.status === "authenticated" ? (
            <InfoBox>
              Há uma sessão parcial em andamento (e-mail {session.session.user.email ?? "—"}).
              Deseja encerrar e entrar com outra conta?
              <div style={{ marginTop: "0.5rem" }}>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={signOut}
                  disabled={submitting}
                >
                  Encerrar sessão
                </Button>
              </div>
            </InfoBox>
          ) : null}

          <form
            onSubmit={onLogin}
            autoComplete="on"
            aria-label="Formulário de login"
            style={{ display: "grid", gap: "0.85rem" }}
          >
            <Input
              ref={emailRef}
              label="E-mail"
              type="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@criatto3d.art.br"
              required
              data-testid="login-email"
            />
            <Input
              label="Senha"
              type={showPw ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="senha cadastrada"
              minLength={PASSWORD_POLICY.minLength}
              required
              data-testid="login-password"
              trailing={
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  aria-label={showPw ? "Ocultar senha" : "Mostrar senha"}
                  title={showPw ? "Ocultar senha" : "Mostrar senha"}
                  style={{
                    padding: "0.25rem",
                    font: "400 0.75rem/1 Manrope,system-ui,sans-serif",
                    background: "transparent",
                    border: 0,
                    color: "var(--color-primary)",
                    cursor: "pointer",
                  }}
                >
                  {showPw ? "ocultar" : "mostrar"}
                </button>
              }
            />
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <Button type="submit" disabled={!canSubmitLogin} data-testid="login-submit">
                {submitting ? (
                  <>
                    <span className="spinner" /> Entrando…
                  </>
                ) : (
                  "Entrar"
                )}
              </Button>
            </div>
          </form>
          <InfoBox>Cadastro fechado ao público. Contas são criadas apenas por convite.</InfoBox>
        </>
      ) : (
        <form
          onSubmit={onRecover}
          autoComplete="on"
          aria-label="Solicitar redefinição de senha"
          style={{ display: "grid", gap: "0.85rem" }}
        >
          <Input
            ref={emailRef}
            label="E-mail cadastrado"
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@criatto3d.art.br"
            required
            data-testid="recover-email"
          />
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button type="submit" disabled={!canSubmitRecover} data-testid="recover-submit">
              {submitting ? (
                <>
                  <span className="spinner" /> Enviando…
                </>
              ) : (
                "Enviar link"
              )}
            </Button>
          </div>
        </form>
      )}
    </AuthCard>
  );
}

// sanitizeAuthError é importado de @/features/auth/lib/authErrors para
// permitir testes unitários e reutilização entre rotas.
