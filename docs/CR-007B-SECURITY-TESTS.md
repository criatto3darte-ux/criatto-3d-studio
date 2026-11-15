# CR-007B — Evidências de testes e segurança

> **Atualização CR-007B.5:** este documento registra a entrega histórica de oito migrations/592 asserções. A revisão posterior encontrou e corrigiu excesso de privilégio de mídia, com nona migration incremental e 614 asserções. Consulte `CR-007B-GITHUB-INTEGRATION.md`; para integração use o bundle CR-007B5, não o bundle original isoladamente. Nenhum remoto foi escrito.

Execução local em 13/11/2026. Engine: PostgreSQL **17.12**, Debian 17.12-0+deb13u1. Não confundir testes locais do PostgreSQL com auditoria de produção Supabase.

## Resultado executado

| Gate | Resultado | Evidência |
|---|---|---|
| Baseline da aplicação antes das alterações | 11 arquivos, 122/122 casos | evidence/cr007b-baseline.txt |
| Vitest após CR-007B | 12 arquivos, 152/152 casos (30 novos) | evidence/cr007b-vitest.txt |
| PostgreSQL/RLS | 592 asserções; 2 reconstruções limpas; 0 conexões remotas | evidence/cr007b-postgres.txt |
| TypeScript strict | exit 0, sem diagnósticos | evidence/cr007b-typescript.txt e cr007b-verification.txt |
| ESLint dos 4 arquivos TS adicionados/modificados | exit 0, zero warnings (`--max-warnings 0`) | evidence/cr007b-eslint.txt e cr007b-verification.txt |
| Build client/SSR/Nitro Cloudflare | exit 0 | evidence/cr007b-build.txt |
| Lint global da base intacta | **falha preexistente: 1111 erros e 14 avisos** | evidence/cr007b-baseline-eslint.txt |

Arquivos de evidência vazios de TypeScript/ESLint representam ausência de diagnósticos; o runner com `set -euo pipefail` registra PASS somente depois do exit 0. Não foi usado `eslint --fix` em arquivos não relacionados. O build contém os avisos normais das ferramentas/dependências; não foi feito deploy.

## Como o RLS foi efetivamente exercitado

O harness executa SQL no PostgreSQL real com `SET LOCAL ROLE authenticated` ou `SET ROLE anon`, e usa um auth.uid() mínimo de teste baseado no claim local. Cada ator tem UUID próprio e papéis em tabelas reais, não permissões simuladas em React. A preparação de fixtures e inspeção do catálogo são feitas como superusuário; **as leituras de autorização são feitas com o papel de aplicação**. Transações de teste são revertidas e cada banco é descartado.

A matriz completa exercita as 27 tabelas, todas com fixtures, por sete atores: proprietário, editor, operador, financeiro, autenticado sem papel, administrador inativo e administrador com papel revogado. O proprietário lê todas; editor não lê PII/pedidos; operador não lê catálogo administrativo; financeiro lê pagamentos e resumo sem PII. Perfis e roles próprios são uma exceção intencional de leitura para authenticated, inclusive inativo; isso não concede autorização administrativa.

Anon é testado nas views públicas e recebe permission denied em tabelas-base de catálogo, pedidos, clientes, roles, mídia e auditoria. Inspeção de grants verifica ausência de acesso anônimo a todas as tabelas-base. Views não oferecem notas internas nem object_key. Rascunhos e produto com categoria inativa são ocultados. Mídia não publicada é ocultada. A disponibilidade é apenas boolean, não saldo físico exato.

## Cobertura de invariantes

- Contagem exata de 27 tabelas RLS/FORCE e 27 PKs; 8 arquivos de migration.
- FKs compostas e presença de índices no primeiro campo de todas as FKs; tipos bigint dos centavos.
- Helpers SECURITY DEFINER com search_path fixo e sem EXECUTE para anon; teste direto de negação do helper.
- Views com security_barrier e projeção sem campos privados.
- Matriz de SELECT de todas as tabelas; negação de autoconcessão de roles e escrita bruta de pedidos para todos os sete atores; editor autorizado e roleless negado em catálogo.
- Snapshot, histórico de pedido, pagamento, movimento de estoque, histórico personalizado e auditoria: UPDATE/DELETE/TRUNCATE negados, inclusive teste de grants para servidor.
- Estoque negativo/alocação excessiva, preço promocional inválido, prazo sob demanda, total inconsistente, teto de centavos, cupom percentual inválido e singleton inválido.
- Idempotency key única; referência de variante a produto errado; FKs de seleção com produto errado; variante ativa sem grupo obrigatório, opção inativa e selection_key forjada.
- Quantidade de alocação limitada ao item; pagamento em pedido pendente bloqueado; mídia privada não pode ser publicada; URL insegura e link social inválido negados.
- Remoção/desativação do último proprietário; remoção conjunta de perfil + role não contorna proteção.
- Concorrência real: duas sessões tentam revogar os dois últimos proprietários; exatamente uma transação confirma e uma falha, mantendo um proprietário ativo (READ COMMITTED).
- Fingerprint das colunas e tipos idêntico entre duas reconstruções independentes.

Os 592 checks são a soma das asserções repetidas em dois bancos; não representam 592 cenários distintos. Contagens de catálogo, por si só, não provariam políticas: por isso há fixtures e consultas reais por ator.

## O que os testes não demonstram

Não validam Auth hospedado, assinatura/expiração de JWT, MFA, PostgREST/Data API, Storage, RLS de buckets, SMTP, configuração de schema exposto, logs remotos, privilégios de um projeto ainda inexistente ou segurança de produção. O schema auth do harness é um substituto mínimo e não o Supabase completo. A concorrência testada é de identidade, não de confirmação de pedidos, inventário ou pagamentos.

Não há comandos operacionais implementados para testar cálculo de checkout, replay persistente, transações saldo/ledger/pedido, transições com histórico atômico, acumulação financeira, consumo de cupons ou uploads. Esses fluxos estão fechados a authenticated e precisam ser implementados/testados em etapa autorizada. Não foram feitos testes visuais em navegador nesta entrega porque nenhum arquivo de UI foi alterado; os 122 testes anteriores seguem verdes.
