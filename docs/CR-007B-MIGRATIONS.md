# CR-007B — Migrations e procedimento de revisão

> **Atualização CR-007B.5:** este documento registra a entrega histórica de oito migrations/592 asserções. A revisão posterior encontrou e corrigiu excesso de privilégio de mídia, com nona migration incremental e 614 asserções. Consulte `CR-007B-GITHUB-INTEGRATION.md`; para integração use o bundle CR-007B5, não o bundle original isoladamente. Nenhum remoto foi escrito.

**Não executar em Supabase remoto nesta entrega.** Versões são identificadores de ordenação, não histórico de aplicação remota. Cada arquivo tem BEGIN/COMMIT. Modelo de referência: CR-007A-DATA-MODEL.md; matriz de segurança: CR-007A-SECURITY.md.

| Versão / sufixo `cr007b_*.sql` | Tabelas | Responsabilidade |
|---|---|---|
| 20261113120100 identity | admin_profiles, user_roles | Papéis, enums e helper ativo não recursivo |
| 20261113120200 catalog | categories, products, product_attribute_groups, product_attribute_options, product_variants, variant_option_values | Catálogo flexível, centavos e FKs compostas |
| 20261113120300 media | media_assets, product_images, category_images | Somente metadados, nenhum bucket |
| 20261113120400 orders | customers, orders, order_items, order_status_history, payments | PII privada, snapshots e eventos financeiros |
| 20261113120500 inventory | inventory, inventory_movements, order_allocations | Saldos e ledger; nenhuma reserva automática |
| 20261113120600 coupons_requests | coupons, coupon_redemptions, custom_requests, custom_request_images, custom_request_history | Cupons e orçamento manual privado |
| 20261113120700 content_audit | banners, store_settings, admin_audit_events | Conteúdo e singleton; auditoria privada |
| 20261113120800 access_invariants | Nenhuma tabela adicional | Views, invariantes diferidas, imutabilidade e último proprietário |

Total: **27 tabelas, 12 views**, sem seed. Todas as 27 tabelas usam RLS e FORCE RLS. Existem 11 projeções públicas e 1 resumo financeiro restrito. Grants e políticas de cada tabela já são aplicados no arquivo de criação; o oitavo arquivo complementa, não adia a proteção inicial.

## Execução local reproduzível

Pré-requisitos: Linux, Python 3, PostgreSQL 17 local em `/var/run/postgresql:5432`, psql e sudo local para postgres. Bun e dependências do lockfile para os gates da aplicação.

```bash
bun install --frozen-lockfile
# Usar exclusivamente um cluster local de teste, não um cluster compartilhado.
python3 tests/postgres/run.py
# Ou todos os gates:
BUN_BIN=bun tests/run-cr007b.sh
```

O harness usa explicitamente socket Unix e usuário postgres, ignora DATABASE_URL, valida major 17, cria papéis de teste sem login apenas se ausentes, prepara o schema auth simulado e usa UUIDs sintéticos determinísticos. Cria dois bancos de nome `cr007b_test_<aleatório>`, aplica as oito migrations em cada um e remove ambos, inclusive em falha. Papéis de cluster criados para o harness ficam no cluster local; não são usuários reais de Auth. Nenhum dump de cliente real é utilizado.

## Requisitos para uma futura homologação (não autorizada aqui)

1. Aprovação explícita, projeto dedicado e inventário de tabelas, usuários, extensões, grants e migrations já existentes.
2. Validar papel/ownership do executor, presença de auth.users/auth.uid(), anon/authenticated/service_role e pgcrypto/gen_random_uuid(). Owner dos helpers/views precisa bypass de RLS para evitar recursão e permitir projeções fechadas. Testar exatamente esse ownership em homologação.
3. Configurar backups, restauração e privilégios; nunca publicar chaves de servidor no bundle de browser.
4. Revisar colisões dos nomes de enums/tabelas/views. As migrations são de criação inicial e **não são idempotentes**: não rodar novamente em schema existente nem adicionar IF NOT EXISTS para esconder divergência.
5. Aplicar pelo mecanismo versionado aprovado apenas em homologação; repetir testes via Data API e Auth real antes de qualquer produção.
6. Verificar JWT/claims, PostgREST, allowlists de schemas expostos, storage privado, URLs de mídia, rate limit e logs sem PII.
7. Bootstrap/transferência do proprietário deve ser comando de servidor controlado, com auditoria. Não existe administrador inicial nem perfil ativo incluído em migration.

## Reversão

Não há down migration destrutiva automática. Como nenhum remoto foi modificado, a reversão desta entrega é descartar a branch local ou não integrar o patch. Para testes, o próprio harness elimina os bancos. Após uma futura aplicação aprovada, usar backup/restauração validada ou migration corretiva revisada; jamais apagar ledger, histórico ou tabelas de pedidos para desfazer schema em produção.

## Pontos de revisão

- Variantes compartilham preço/estoque do produto; não há SKU com saldo/preço independente.
- Publicação completa de atributos requer uma única transação por causa das constraints diferidas.
- Timestamps/version de agregados são atualizados pelo banco. expectedVersion e autorização de comando ainda precisam implementação.
- Preço promocional é estritamente positivo, conforme CR-007A. Frete/total nulos significam a combinar, não grátis.
- Ledger é append-only; consistência atômica ledger/saldo depende de um futuro comando, não de cinco chamadas REST.
- Nenhuma regra de reserva, consumo de cupom ou baixa de estoque foi ativada.
