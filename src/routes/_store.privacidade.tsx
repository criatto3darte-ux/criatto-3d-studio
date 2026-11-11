import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/features/store/components/Section";

export const Route = createFileRoute("/_store/privacidade")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade — Criatto 3D" },
      { name: "description", content: "Como a Criatto 3D usa os dados informados para atendimento e processamento de pedidos." },
      { property: "og:title", content: "Política de Privacidade — Criatto 3D" },
      { property: "og:description", content: "Como a Criatto 3D usa os dados informados nos pedidos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <div className="container" style={{ maxWidth: 820 }}>
      <PageHeader eyebrow="Versão provisória" title="Política de Privacidade" />
      <div style={{ display: "grid", gap: 16 }}>
        <p>Esta é uma versão provisória e será completada pela Criatto 3D antes da publicação definitiva da loja.</p>
        <h2 style={{ fontSize: 20 }}>Quais dados usamos</h2>
        <p>Para finalizar um pedido pedimos apenas nome completo, WhatsApp com DDD e, se você quiser, observações. Não pedimos senha, cadastro, data de nascimento ou CPF.</p>
        <h2 style={{ fontSize: 20 }}>Para que usamos</h2>
        <p>Os dados servem somente para atendimento e processamento do seu pedido na conversa pelo WhatsApp.</p>
        <h2 style={{ fontSize: 20 }}>Armazenamento</h2>
        <p>Neste site, seus dados pessoais não são salvos: eles são usados apenas para montar a mensagem do WhatsApp. O navegador guarda somente os itens do carrinho e a preferência de tema claro/escuro.</p>
        <p style={{ color: "var(--color-text-muted)" }}>Contato do responsável pelos dados: a ser informado pela Criatto 3D.</p>
      </div>
    </div>
  );
}
