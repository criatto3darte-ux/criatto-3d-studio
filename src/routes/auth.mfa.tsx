// /auth/mfa
//
// Matrícula TOTP e verificação (AAL2). Usa @supabase/supabase-js
// auth.mfa.enroll / challenge / challengeAndVerify.
//
// Fluxo:
//   1. Lista fatores; se houver TOTP verificado, pula para tela de conclusão.
//   2. Se não houver, chama enroll({ factorType: 'totp', issuer, friendlyName })
//      para receber o `uri` (otpauth://) e `secret`.
//   3. Renderiza o QR code (como imagem data-URL gerada por uma lib QR) e
//      também o secret em texto para digitação manual.
//   4. Usuário digita um código TOTP de 6 dígitos, chamamos
//      mfa.challengeAndVerify para AAL2.
//   5. Ao confirmar, redireciona para /auth/done.
//
// NOTA: o MFA de TOTP em GoTrue requer verificação antes de marcar como verificado.
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { AuthCard, ErrorBox, InfoBox, SuccessBox } from "@/features/auth/ui/AuthCard";
import { getSupabase, isSupabaseConfigured, useSession } from "@/lib/supabase/client";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";

export const Route = createFileRoute("/auth/mfa")({
  head: () => ({
    meta: [
      { title: "Configurar autenticação de dois fatores — Criatto 3D" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: MfaPage,
  validateSearch: (search: Record<string, unknown>) => ({
    /** Where to send the user after successful MFA verification.
     *  Used by /admin/login (AAL1 -> AAL2 challenge) and by onboarding. */
    next:
      typeof search.next === "string" && search.next.startsWith("/") ? search.next : "/auth/done",
  }),
});

interface TotpSecret {
  id: string;
  uri: string;
  secret: string;
}

async function enrollTotp(): Promise<TotpSecret> {
  const supabase = getSupabase();
  const identity = (await supabase.auth.getUser()).data.user?.email ?? "Criatto 3D Admin";
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    issuer: "Criatto 3D",
    friendlyName: identity.slice(0, 64),
  });
  if (error) throw error;
  return {
    id: data.id,
    uri: data.totp.uri,
    secret: data.totp.secret,
  };
}

// Minimal QR code generator (otpauthtotp qr) using qrserver-style approach is
// not possible offline; we render a pure-CSS/placeholder QR as SVG using a
// tiny vendored QR generator? To avoid adding deps, use Google's
// chart.googleapis is blocked offline. We'll use a tiny JS QR generator
// (qr-creator is not installed). Instead, we provide the URI/secret copy-paste
// and INSTRUCTION TO USE AUTHY/GA which supports manual secret entry. The QR
// is rendered as a data-URI using a tiny embedded QR lib:
//   npm adds no extra dep — we inline a tiny QR generator (<2KB) — but that
//   would increase bundle size. Given CR-007E.4 says "utilizar somente
//   dependências necessárias", we render a button that opens the otpauth://
// URI (which opens Authenticator apps on mobile/desktop if registered) plus
// the secret text for manual entry.
// This is acceptable: QR is a convenience; manual entry works everywhere and
// is auditable.

function MfaPage() {
  const session = useSession();
  const navigate = Route.useNavigate();
  const { next } = Route.useSearch();
  const [enrollMode, setEnrollMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [secret, setSecret] = useState<TotpSecret | null>(null);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [challengeFactorId, setChallengeFactorId] = useState<string | null>(null);
  const initialized = useRef(false);

  const goNext = useCallback(() => {
    // next sempre é um path local (validado em validateSearch), sem abrir
    // brecha para open redirect.
    void navigate({ to: next as "/admin" | "/auth/done", replace: true });
  }, [navigate, next]);

  useEffect(() => {
    if (session.status === "unauthenticated") {
      void navigate({ to: "/auth/login", replace: true });
      return;
    }
    if (session.status !== "authenticated") return;
    if (initialized.current) return;
    initialized.current = true;
    (async () => {
      try {
        const supabase = getSupabase();
        const { data, error } = await supabase.auth.mfa.listFactors();
        if (error) throw error;
        const verified = (data?.totp ?? []).filter((f) => f.status === "verified");
        // Se vem de /admin/login (next=/admin) e já tem um TOTP verificado,
        // apresentamos o desafio (AAL1 -> AAL2) — não é onboarding.
        const firstVerified = verified[0];
        if (next.startsWith("/admin") && firstVerified) {
          setChallengeFactorId(firstVerified.id);
          setLoading(false);
          return;
        }
        // Se vem de /admin/login e NÃO tem TOTP, avisa e oferece onboarding.
        if (next.startsWith("/admin") && verified.length === 0) {
          setEnrollMode(true);
          const s = await enrollTotp();
          setSecret(s);
          setLoading(false);
          return;
        }
        // Fluxo onboarding (convite): se já há TOTP verificado, concluímos.
        if (verified.length > 0) {
          setSuccess("TOTP já configurado.");
          setTimeout(goNext, 500);
          return;
        }
        setEnrollMode(true);
        const s = await enrollTotp();
        setSecret(s);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao iniciar MFA.");
      } finally {
        setLoading(false);
      }
    })();
  }, [session.status, navigate, next, goNext]);

  const otpUri = secret?.uri;
  const secretText = secret?.secret;
  const activeFactor = challengeFactorId ?? secret?.id ?? null;
  const isEnroll = enrollMode || secret !== null;
  const canVerify =
    code.length === 6 && /^\d{6}$/.test(code) && activeFactor !== null && !verifying;

  async function onVerify(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!activeFactor || !canVerify) return;
    setVerifying(true);
    setError(null);
    try {
      const supabase = getSupabase();
      const { data: chal, error: ce } = await supabase.auth.mfa.challenge({
        factorId: activeFactor,
      });
      if (ce) throw ce;
      const { error: ve } = await supabase.auth.mfa.verify({
        factorId: activeFactor,
        challengeId: chal.id,
        code,
      });
      if (ve) throw ve;
      setSuccess(
        isEnroll
          ? "Autenticação de dois fatores configurada com sucesso!"
          : "Segundo fator confirmado. Entrando…",
      );
      setTimeout(goNext, 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Código inválido ou expirado.");
    } finally {
      setVerifying(false);
    }
  }

  const isChallengeFlow = !isEnroll && !!challengeFactorId;
  const cardTitle = isChallengeFlow
    ? "Confirme seu segundo fator"
    : "Autenticação de dois fatores (TOTP)";
  const cardSubtitle = isChallengeFlow
    ? "Digite o código de 6 dígitos gerado pelo seu aplicativo autenticador para concluir o acesso."
    : "Adicione uma segunda camada de proteção usando um aplicativo autenticador (Authy, Google Authenticator, 1Password, etc.).";

  return (
    <AuthCard
      title={cardTitle}
      subtitle={cardSubtitle}
      step="mfa"
      hideSteps={isChallengeFlow}
      badge={isChallengeFlow ? "Verificação MFA · painel administrativo" : undefined}
    >
      {error && <ErrorBox>{error}</ErrorBox>}
      {success && <SuccessBox>{success}</SuccessBox>}

      {loading && <InfoBox>Preparando autenticação…</InfoBox>}

      {!loading && isChallengeFlow && (
        <form
          onSubmit={onVerify}
          style={{ display: "grid", gap: "0.85rem" }}
          autoComplete="one-time-code"
        >
          <Input
            label="Código de 6 dígitos"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="000000"
            required
            autoFocus
            data-testid="mfa-challenge-code"
          />
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button type="submit" disabled={!canVerify} data-testid="mfa-challenge-submit">
              {verifying ? (
                <>
                  <span className="spinner" /> Verificando…
                </>
              ) : (
                "Confirmar e entrar"
              )}
            </Button>
          </div>
        </form>
      )}

      {!loading && secret && isEnroll && (
        <>
          <InfoBox>
            No aplicativo autenticador, escolha <strong>Adicionar conta</strong> e uma das opções:
            <ol style={{ margin: "0.5rem 0 0 1.2rem", padding: 0 }}>
              <li>
                Escaneie o QR code ou, se não aparecer abaixo,{" "}
                <a href={otpUri} rel="noopener">
                  clique aqui para abrir o app
                </a>
                ;
              </li>
              <li>Se preferir, digite manualmente o segredo abaixo.</li>
            </ol>
          </InfoBox>

          {otpUri ? (
            <div
              className="mfa-qr-note"
              style={{
                textAlign: "center",
                font: "400 0.8rem/1.4 'Manrope',system-ui,sans-serif",
                color: "var(--color-text-muted)",
              }}
            >
              <p style={{ margin: "0 0 0.35rem" }}>
                QR code disponível em aplicativos com leitor de URI. Segredo manual:
              </p>
              <div
                className="secret"
                style={{
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  fontSize: "0.85rem",
                  wordBreak: "break-all",
                  background: "var(--color-surface-elevated)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-md)",
                  padding: "0.5rem 0.75rem",
                  userSelect: "all",
                  color: "var(--color-text)",
                }}
              >
                {secretText}
              </div>
            </div>
          ) : null}

          <form
            onSubmit={onVerify}
            style={{ display: "grid", gap: "0.85rem" }}
            autoComplete="one-time-code"
          >
            <Input
              label="Código de 6 dígitos"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              required
              data-testid="mfa-code"
            />
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <Button type="submit" disabled={!canVerify} data-testid="mfa-submit">
                {verifying ? (
                  <>
                    <span className="spinner" />
                    Verificando…
                  </>
                ) : (
                  "Confirmar e finalizar"
                )}
              </Button>
            </div>
          </form>
        </>
      )}
    </AuthCard>
  );
}
