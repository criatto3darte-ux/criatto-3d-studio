import { Link } from "@tanstack/react-router";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { Button, buttonClass } from "@/shared/ui/Button";
import { PageHeader } from "../components/Section";
import styles from "./CheckoutPage.module.css";

/** CR-010C will enable checkout after server-side pricing, order persistence and idempotency exist. */
export function CheckoutPage() {
  return (
    <div className="container">
      <PageHeader
        eyebrow="Finalizar pedido"
        title="Checkout em preparação"
        text="Ainda não criamos pedidos nesta loja. O checkout será liberado após a validação de preços, estoque e persistência no Supabase."
      />
      <p role="status" className={styles.errorSummary}>
        Nenhum pedido foi enviado ou confirmado. Para dúvidas sobre os produtos publicados, fale
        diretamente com a Criatto 3D pelo canal oficial.
      </p>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Link to="/carrinho" className={buttonClass("outline")}>
          <ArrowLeft size={16} /> Voltar ao carrinho
        </Link>
        <Button disabled title="O checkout via WhatsApp será habilitado após a CR-010C">
          <MessageCircle size={18} /> Finalização indisponível
        </Button>
      </div>
    </div>
  );
}
