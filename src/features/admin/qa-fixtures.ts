/**
 * Registros do robô de testes na homologação (ver AGENTS.md): o painel os
 * marca para ninguém editar, ativar ou reaproveitar por engano.
 */
const QA_MARK = /qa\s*e2e/i;
export const QA_PRODUCT_SLUG = "produto-qa-e2e";
export const QA_FIXTURE_NOTICE =
  "Uso do robô de testes automáticos. Não edite nem ative: o robô depende deste registro como está.";

export function isQaBanner(banner: { title: string; highlight: string }): boolean {
  return QA_MARK.test(`${banner.title} ${banner.highlight}`);
}

export function isQaProduct(product: { slug: string; name: string }): boolean {
  return product.slug === QA_PRODUCT_SLUG || QA_MARK.test(product.name);
}
