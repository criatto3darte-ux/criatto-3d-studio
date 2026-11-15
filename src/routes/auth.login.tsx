// Página de entrada amigável quando o usuário cai em /auth/* sem convite.
//
// Ela NÃO implementa login/senha administrativo (esse fluxo só é aberto
// DEPOIS do bootstrap e do MFA, em tela própria do /admin_/login).
// Esta tela explica como funciona o convite e redireciona o usuário para
// o link do convite caso o tenha recebido.
import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthCard, InfoBox } from "@/features/auth/ui/AuthCard";
import { Button, buttonClass } from "@/shared/ui/Button";

export const Route = createFileRoute("/auth/login")({
  head: () => ({
    meta: [
      { title: "Convite administrativo — Criatto 3D" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AuthLoginEntry,
});

function AuthLoginEntry() {
  return (
    <AuthCard
      title="Acesso administrativo por convite"
      subtitle="O painel administrativo é acessível apenas por convite. Se você recebeu um e-mail de convite da Criatto 3D, clique no link do e-mail para continuar."
      step="accept"
    >
      <InfoBox>
        Por segurança:
        <ul style={{ margin: "0.4rem 0 0 1.2rem", padding: 0 }}>
          <li>Cadastro público está desabilitado.</li>
          <li>O link de convite expira em 1 hora.</li>
          <li>Você precisará cadastrar uma senha forte e configurar MFA TOTP.</li>
        </ul>
      </InfoBox>
      <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
        <Link to="/" className={buttonClass("secondary")}>
          Voltar à loja
        </Link>
        <Button type="button" onClick={() => window.location.reload()}>
          Eu já abri o link do convite
        </Button>
      </div>
    </AuthCard>
  );
}
