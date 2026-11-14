// /auth/callback
//
// Ponto de entrada após o usuário clicar no link de convite (e também após
// redefinição de senha ou magic-link, embora neste onboarding ele seja usado
// apenas para o convite inicial e o MFA challenge).
//
// Responsabilidades:
//   1. Trocar `code` (PKCE) + code_verifier armazenado pelo SDK por uma sessão
//      usando `supabase.auth.exchangeCodeForSession`.
//   2. Detectar erros (link expirado, inválido, já usado) e redirecionar para
//      /auth/error com mensagem segura.
//   3. Em caso de sucesso, encaminhar para /auth/set-password para definir a
//      senha inicial (o fluxo de convite do Supabase deixa o usuário logado mas
//      com recovery/invite flow; nesta primeira etapa garantimos que o usuário
//      defina a senha antes de seguir).
//
// Segurança: nenhum token é exibido no console/UI. O troca do código ocorre
// via POST TLS direto ao domínio do Supabase; não há proxies.
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AuthCard } from "@/features/auth/ui/AuthCard";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";

export const Route = createFileRoute("/auth/callback")({
  head: () => ({
    meta: [
      { title: "Autenticando… — Criatto 3D" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AuthCallback,
  validateSearch: (search: Record<string, unknown>) => {
    const out: Record<string, unknown> = {};
    for (const k of ["code", "token_hash", "error", "error_description", "type"] as const) {
      if (typeof search[k] === "string") out[k] = search[k];
    }
    return out as Record<string, string | undefined>;
  },
});

function AuthCallback() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [msg, setMsg] = useState("Validando seu acesso…");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!isSupabaseConfigured()) {
          setMsg("Aplicação não configurada (VITE_SUPABASE_*).");
          return;
        }
        const supabase = getSupabase();
        if (search.error) {
          throw new Error(search.error_description ?? search.error);
        }
        // Preferimos PKCE: se `code` estiver presente, trocamos por sessão.
        if (search.code) {
          const { error } = await supabase.auth.exchangeCodeForSession(search.code);
          if (error) throw error;
        } else if (search.token_hash && search.type) {
          // Fluxo com token_hash (convites antigos ou magic link): verificamos
          // usando verifyOtp com type do search. O tipo pode ser 'invite','signup',
          // 'recovery','email','magiclink','email_change'.
          const { error } = await supabase.auth.verifyOtp({
            token_hash: search.token_hash,
            type: search.type as
              "invite" | "signup" | "recovery" | "email" | "magiclink" | "email_change",
          });
          if (error) throw error;
        } else {
          throw new Error("Nenhum código de confirmação encontrado na URL.");
        }
        if (cancelled) return;
        // Sucesso: seguir para definição de senha/MFA.
        await navigate({ to: "/auth/set-password", replace: true });
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        // Preserve a mensagem mas limite o tamanho / não logue tokens.
        console.error("[auth/callback] exchange failed:", err);
        await navigate({
          to: "/auth/error",
          replace: true,
          search: {
            error: "auth_callback_failed",
            description: message.slice(0, 200),
          },
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [search, navigate]);

  return (
    <AuthCard
      title="Autenticando…"
      subtitle="Aguarde enquanto validamos seu convite. NÃO recarregue a página."
      step="accept"
    >
      <div style={{ display: "grid", placeItems: "center", padding: "1rem 0" }}>
        <span
          className="spinner"
          style={{
            width: "1.5rem",
            height: "1.5rem",
            borderTopColor: "transparent",
            borderColor: "var(--color-primary)",
            borderRightColor: "var(--color-primary)",
          }}
        />
      </div>
      <p style={{ margin: 0, color: "var(--color-text-muted)", font: "var(--font-body-sm)" }}>
        {msg}
      </p>
    </AuthCard>
  );
}

// Styled spinner — uses the same keyframe as in AuthCard.module.css but we
// rely on the .spinner class there already.
