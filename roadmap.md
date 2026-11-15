# CR-006 — Estabilização

- [x] CR-006A: busca/filtros e preço efetivo corrigidos; 52 testes passaram; navegador validado em quatro tamanhos e dois temas; relatório entregue.
- [x] CR-006B: limites compartilhados, reconciliação, persistência e sincronização corrigidos; 63 testes passaram; navegador validado; relatório entregue.
- [x] CR-006C: metadados sincronizados com o catálogo público; HTML inicial conservador/noindex; 70 testes passaram; cadastro, edição, navegação e temas validados; relatório entregue para aprovação.
- [x] CR-006D: validação completa, recuperação explícita e URLs seguras; testes e navegador validados; relatório entregue para aprovação.
- [x] CR-006E: transições/pagamentos protegidos, indicadores unificados, logo aplicada e encomendas revisadas; 122 testes aprovados, compra e painel validados em navegador; relatórios entregues para aprovação.

Sem banco, autenticação ou publicação comercial nesta etapa.

## CR-007 — Planejamento de produção

- [x] CR-007A: auditoria documental concluída; cinco documentos entregues em docs/CR-007A-*.md; 122 testes existentes aprovados; nenhuma alteração funcional ou conexão; CR-007B aguarda autorização expressa.
- [x] CR-007B: fundação local autorizada e implementada na branch `feature/cr-007b-supabase-foundation`: oito migrations, 27 tabelas RLS/FORCE, contratos TypeScript e documentação. PostgreSQL 17.12: 592 asserções em dois bancos descartáveis; Vitest: 152/152; TypeScript, lint direcionado e build aprovados. Relatório em `docs/CR-007B-FINAL-REPORT.md`; aguardando revisão/aprovação.
- [ ] Integração da CR-007B e homologação remota: bloqueadas até aprovação explícita, projeto dedicado e inventário confirmado. Conector válido, mas zero projetos visíveis; nenhum remoto alterado. Bundle/patch e descrição de PR entregues localmente, sem push/merge.
- [ ] CR-007C: não iniciada; depende de autorização expressa. Comandos comerciais, autenticação real e storage não foram ativados pela fundação SQL.
## CR-007B.5 — Revisão para integração

- [x] Bundle original validado; main remota consultada em leitura e segue `d922aef`. Quatro commits originais preservados.
- [x] Falha de privilégio de mídia reproduzida/corrigida por nona migration incremental; 614 asserções PostgreSQL em dois rebuilds, 152 testes Vitest, TypeScript, lint direcionado e build aprovados.
- [x] Relatório `docs/CR-007B-GITHUB-INTEGRATION.md` e conjunto de artefatos CR-007B5 preparados para revisão.
- [ ] Push/PR pendentes: conector GitHub unsupported e sem canal autenticado de escrita disponível. Nenhum push/merge/deploy executado.
- [ ] Homologação remota bloqueada: zero projetos Supabase visíveis; exclusividade não verificável; nenhuma migration remota autorizada/aplicada.
- [ ] Próxima etapa aguarda aprovação; CR-007C não iniciada.
