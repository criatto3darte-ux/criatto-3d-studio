// /auth/done — tela de conclusão do onboarding.
//
// O que o usuário vê aqui:
//   - Confirmação de que a conta está pronta.
//   - Aviso de que o ACESSO administrativo ainda não está liberado
//     (aguardando o bootstrap SQL por um operador).
//   - Instruções para:
//       * guardar os recovery codes do TOTP (se não o fez);
//       * fechar esta janela e aguardar contato do operador;
//       * fazer logout.
//
// Nesta tela o usuário ESTÁ autenticado mas não tem role 'proprietario' ainda,
// então as políticas RLS de admin o barram de ver qualquer dado administrativo.
// Isso é proposital e é uma confirmação de que o isolamento funciona.
import { createFileRoute } from "@tanstack/react-router";
import { AuthCard, InfoBox, SuccessBox } from "@/features/auth/ui/AuthCard";
import { Button } from "@/shared/ui/Button";
import { getSupabase, useSession } from "@/lib/supabase/client";
import { useCallback } from "react";

export const Route = createFileRoute("/auth/done")({
  head: () => ({
    meta: [
      { title: "Cadastro concluído — Criatto 3D" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AuthDone,
});

function AuthDone() {
  const session = useSession();
  const email = session.status === "authenticated" ? session.session.user.email : null;

  const signOut = useCallback(async () => {
    await getSupabase().auth.signOut();
    window.location.href = "/";
  }, []);

  return (
    <AuthCard
      title="Onboarding concluído"
      subtitle={
        email
          ? `Conta ${email} confirmada e MFA configurado.`
          : "Conta confirmada e MFA configurado."
      }
      step="done"
    >
      <SuccessBox>
        Seu cadastro foi confirmado.{" "}
        <strong>O acesso administrativo ainda não está liberado</strong>: um operador precisa
        executar o bootstrap de segurança para conceder o papel de proprietário.
      </SuccessBox>

      <InfoBox>
        Por favor:
        <ul style={{ margin: "0.4rem 0 0 1.2rem", padding: 0 }}>
          <li>
            Confira que salvou os códigos de recuperação MFA (se apresentados pelo aplicativo).
          </li>
          <li>Feche esta janela e aguarde o contato do operador para liberação do painel.</li>
          <li>
            Não tente acessar <code>/admin</code> ainda — o acesso é negado por RLS até que o papel
            de proprietário seja concedido.
          </li>
        </ul>
      </InfoBox>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.6rem", flexWrap: "wrap" }}>
        <a href="/" style={{ all: "unset" }}>
          <Button type="button" variant="secondary">
            Voltar à loja
          </Button>
        </a>
        <Button type="button" onClick={signOut}>
          Sair
        </Button>
      </div>
    </AuthCard>
  );
}
