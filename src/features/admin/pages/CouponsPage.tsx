import { Card } from "@/shared/ui/Card";
import { adminStyles as s } from "../ui/AdminUI";

/**
 * Cupons ainda não são aplicados no carrinho nem no checkout real
 * (create_checkout_order grava desconto zero). Para não exibir cupons que
 * não funcionam, a tela informa o estado atual em vez de usar dados fictícios.
 */
export function CouponsPage() {
  return (
    <div className={s.stack}>
      <Card>
        <h2 className={s.h2}>Cupons ainda não disponíveis</h2>
        <p className={s.muted}>
          O checkout da loja ainda não aplica cupons de desconto: todo pedido é registrado com o
          preço do produto e o desconto pode ser combinado no atendimento pelo WhatsApp.
        </p>
        <p className={s.muted}>
          A criação de cupons será liberada junto com a etapa que aplica o desconto no checkout.
        </p>
      </Card>
    </div>
  );
}
