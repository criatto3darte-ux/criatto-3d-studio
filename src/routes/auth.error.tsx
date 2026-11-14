// Link-expired / invalid-token page.
import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthCard, InfoBox } from "@/features/auth/ui/AuthCard";
import { Button, buttonClass } from "@/shared/ui/Button";

export const Route = createFileRoute("/auth/error")({
  head: () => ({
    meta: [
      { title: "Link inválido ou expirado — Criatto 3D" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AuthError,
  validateSearch: (search: Record<string, unknown>) => ({
    error: typeof search.error === "string" ? search.error : undefined,
    description: typeof search.description === "string" ? search.description : undefined,
  }),
});

function AuthError() {
  const { error, description } = Route.useSearch();
  return (
    <AuthCard
      title="Link inválido ou expirado"
      subtitle="Este link de convite já foi utilizado, expirou ou foi malformado. Solicite um novo convite a um administrador."
      step="accept"
    >
      <InfoBox>
        <strong>Motivo:</strong> {description ?? error ?? "token inválido"}.<br />
        Por segurança, nenhuma sessão foi criada.
      </InfoBox>
      <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
        <Link to="/" className={buttonClass("secondary")}>
          Voltar à loja
        </Link>
        <Button type="button" onClick={() => window.location.reload()}>
          Tentar novamente
        </Button>
      </div>
    </AuthCard>
  );
}
