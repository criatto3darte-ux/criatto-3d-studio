# CR-013 — Endurecimento de segurança para produção

## Escopo

Esta correção prepara as permissões das views públicas antes da promoção da
homologação. Ela não altera dados, RLS, autenticação, funções, Storage ou o
comportamento comercial da loja.

## Problema confirmado

As views `public_catalog_images` e `public_site_banners` removiam privilégios
somente de `PUBLIC`. Privilégios explícitos herdados por `anon`,
`authenticated` e `service_role` permaneceram ativos, incluindo operações além
de leitura. O catálogo precisava apenas de `SELECT`.

## Correção

A migration `20261118004549_cr013_production_security_hardening.sql`:

- remove todos os privilégios explícitos das 13 projeções públicas e da view
  financeira;
- concede somente `SELECT` a `anon`, `authenticated` e `service_role` nas
  projeções da loja;
- mantém a view financeira inacessível a `anon` e concede somente `SELECT` a
  `authenticated` e `service_role`;
- valida existência, `security_barrier`, permissões necessárias e ausência de
  escrita antes do `COMMIT`;
- executa em uma única transação, revertendo integralmente se uma validação
  falhar.

## Views `security_definer`

As views continuam deliberadamente executadas pelo proprietário e protegidas
por `security_barrier=true`. As tabelas-base não possuem grants anônimos e a
view `public_availability` oculta o saldo exato do estoque. Trocar diretamente
para `security_invoker=true` quebraria o catálogo ou exigiria conceder acesso às
tabelas-base, ampliando a exposição. A migração corrige o privilégio excessivo
sem enfraquecer essa fronteira.

Os alertas do advisor para as seis funções `SECURITY DEFINER` também foram
revisados. Elas têm `search_path` fixo, `PUBLIC` revogado e execução limitada aos
papéis necessários; as funções administrativas ainda aplicam função interna e
AAL2. Nenhum grant dessas funções foi ampliado.

## Testes automatizados

O conjunto PostgreSQL 17 passa a verificar:

- `SELECT` nas projeções públicas para os papéis previstos;
- ausência de `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES` e
  `TRIGGER` nessas views;
- ausência de acesso anônimo ao resumo financeiro;
- permanência de `security_barrier=true` em todas as views públicas;
- integridade SHA-256 da nova migration.

## Operações remotas pendentes

Esta branch não aplica a migration remotamente. Após revisão e CI verde, a
promoção exige autorização específica para:

1. aplicar a migration no Supabase de homologação;
2. repetir o advisor e os testes funcionais da loja;
3. habilitar proteção contra senhas vazadas no Auth, avaliando antes o impacto
   no login e na recuperação de senha;
4. somente depois preparar a janela de produção.

Produção, DNS, Locaweb e `main` permanecem inalterados.
