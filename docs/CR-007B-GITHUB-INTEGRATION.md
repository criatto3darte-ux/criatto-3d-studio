# CRIATTO 3D — CR-007B.5
## Integração GitHub e preparação para homologação

Data: 13/11/2026. **Resultado: revisão local concluída com correção de segurança; publicação no GitHub bloqueada por ausência de canal autenticado de escrita. Homologação remota não autorizada nem executada.**

## 1. Repositório e base

Repositório oficial: https://github.com/criatto3darte-ux/criatto-3d-studio

Consulta pública `git ls-remote`, efetuada nesta etapa, retornou:

```text
d922aeffe0f3bb7d7629ff3e8c3f76203a5b129f HEAD
d922aeffe0f3bb7d7629ff3e8c3f76203a5b129f refs/heads/main
```

Esse é o mesmo SHA usado como base da CR-007B. Portanto **a main remota não avançou em relação à base validada** no instante da consulta: zero commits e zero diferenças de árvore entre a base e essa main. A branch de desenvolvimento não apareceu entre as refs anunciadas do repositório oficial. Isso não equivale a enumerar PRs ou branches em forks. Evidência: `docs/evidence/cr007b5/remote-refs.txt`.

Não houve checkout, commit, merge ou reset de main. Sua ref local continua no mesmo SHA. A comparação deve ser repetida pelo mantenedor imediatamente antes de um eventual push, pois o servidor pode avançar depois da consulta.

## 2. Branch e artefatos recuperados

Branch local: `feature/cr-007b-supabase-foundation`.

Localizados os quatro arquivos originais em `/home/user/`:

- `CR-007B-supabase-foundation.bundle`
- `CR-007B-supabase-foundation.patch`
- `CR-007B-PULL-REQUEST.md`
- `CR-007B-ARTIFACTS.txt`

Os checksums originais continuam correspondendo ao manifesto. Bundle verificado por `git bundle verify`, clone offline separado e `git fsck --full`. Contém histórico completo, sem pré-requisitos externos, e a ref esperada apontando para `c6b229c68a3862e4b2e192bab3a47ab4a0c9a15a`. Base `d922aef` é ancestral, com exatamente quatro commits adicionais. Foram conferidos os 28 arquivos modificados da entrega original e sua correspondência com schema/contratos/testes/documentação. Arquivos de evidência: `artifacts-validation.txt`, `commits.txt` e `files.txt` no subdiretório `docs/evidence/cr007b5/`.

A implementação já estava presente na branch local; não foi aplicada uma segunda vez. O clone do bundle foi usado somente para validação independente. **Patch não aplicado nesta etapa; bundle e patch não foram combinados.**

O bundle original foi preservado como artefato histórico, mas NÃO contém a correção desta auditoria. Para integração revisada, utilizar exclusivamente o novo `CR-007B5-supabase-foundation.bundle`, com manifesto `CR-007B5-ARTIFACTS.txt` e descrição `CR-007B5-PULL-REQUEST.md`. Não sobrescrever nem confundir checksums dos dois conjuntos.

## 3. Commits e preservação do histórico

Quatro commits originais, preservados sem amend, rebase ou squash:

```text
903d364f2dcba3b6960dc51b610fdf4808dc3bbe feat(db): add CR-007B schema, RLS and access invariants
41403490357084e6b5eeeff0ea06ed88a6267adc feat(contracts): define typed backend DTOs and async repositories
3e10efb4cafa6a8f3e0e4fb93c66830c360032a7 test(security): verify PostgreSQL 17 RLS and backend contracts
c6b229c68a3862e4b2e192bab3a47ab4a0c9a15a docs(cr007b): record architecture, verification and approval gates
```

Complementos desta revisão, sem reescrever os anteriores:

- `502a1eb`: restringe mídia privada e processamento confiável, testes de regressão e novas evidências.
- Commit documental subsequente: este relatório, notas de atualização dos documentos anteriores e roadmap. Seu SHA completo e o HEAD final estão em `CR-007B5-ARTIFACTS.txt` para evitar referência circular dentro do próprio commit.

## 4. Resultado da auditoria e da importação

### Falha real encontrada e corrigida — privilégio indevido em mídia

**Severidade alta; bloqueadora para futura homologação com dados privados.** A política original de `media_assets` autorizava editor a ler qualquer linha e alterar metadados/estado. No PostgreSQL local foi comprovado que um editor:

1. Lê `object_key` de uma mídia vinculada a um personalizado privado.
2. Consegue mudar `state` de um asset para `verified`, contornando o processamento confiável previsto no modelo.

Não foi comprovado acesso ao arquivo real de Storage (não há bucket remoto nem teste remoto). A falha comprovada é de autorização de metadados e verificação, não uma inferência baseada apenas em leitura estática. A matriz anterior esperava que editor lesse ambas as mídias e, portanto, não identificava esse excesso de privilégio. Evidência de reprodução na base original: `original-postgres-with-reproduction.txt` (596 asserções: 592 anteriores + quatro verificações de reprodução nos dois rebuilds).

Correção: nona migration incremental `20261113120900_cr007b_media_privilege_hardening.sql`, preservando as oito originais:

- Revoga INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER de mídia para authenticated, inclusive proprietário via papel de aplicação. Ciclo de verificação passa exclusivamente por futuro comando confiável de servidor.
- Remove policies amplas de mídia. Proprietário continua lendo todas as mídias; editor lê somente mídia com vínculo editorial e sem vínculo a personalizado/evidência de pagamento.
- Mídia sem vínculo não fica legível para editor. Upload/editorial workflow será responsabilidade de comando de servidor posterior.
- Novo helper SECURITY DEFINER tem search_path fixo, EXECUTE restrito, exige editor ativo internamente e não retorna metadados privados.
- Testa negação de autoverificação/inserção/exclusão, helper por anon/roleless, vínculo editorial sobre anexo privado e atualização permitida ao papel confiável de servidor.

Não houve exploração remota nem dados reais. Correção apenas na branch local autorizada. O novo conjunto tem **9 migrations, 27 tabelas e 12 views**, não altera DTOs/UI/checkout/LocalStorage.

### Demais áreas revisadas

| Área | Resultado da revisão local |
|---|---|
| RLS / FORCE | 27 tabelas protegidas; matriz com sete atores e anon adicional |
| Policies e grants | Sem acesso anon a base; writes operacionais fechados; excesso de privilégio de mídia corrigido |
| Views públicas | 11 projeções fechadas, pais publicados, sem object_key/PII/notas; 1 resumo financeiro restrito |
| SECURITY DEFINER | search_path fixo `public, pg_temp`, sem EXECUTE anon/PUBLIC; novo helper também testado |
| Roles | Perfil ativo e papel persistido; sem autoconcessão; proprietário/editor/operador/financeiro segregados |
| Imutabilidade | UPDATE/DELETE/TRUNCATE barrados em itens/eventos; role de servidor sem esses grants |
| Estoque | CHECKs de saldos/deltas e FKs compostas; não existe comando comercial de alocação/baixa ativado |
| Constraints | PK/FK/CHECK/UNIQUE, índices e validações diferidas exercitados |
| Idempotência | Unique keys e contrato de replay/conflito; sem endpoint ou replay persistente implementado |
| TypeScript | strict sem diagnósticos, tipos branded/DTOs; sem mudanças de contratos nesta revisão |
| Segredos | Varredura heurística sem ocorrências de chaves privadas, tokens GitHub literais, access keys AWS ou JWTs literais nos arquivos varridos; não é certificação nem scanner completo |

Views owner-executed/security_barrier dependem do owner confiável de migrations com BYPASSRLS. Isso é uma decisão explícita de projeção, não uma view security_invoker fingindo esconder colunas. A configuração real exige validação em homologação.

## 5. Testes reexecutados

| Verificação | Resultado nesta etapa | Evidência em `docs/evidence/cr007b5/` |
|---|---|---|
| Bundle original | Verify + clone offline + fsck + ancestralidade aprovados | bundle.txt, artifacts-validation.txt |
| PostgreSQL 17.12 / RLS após correção | **614 asserções, 2 reconstruções limpas, 0 conexões remotas** | postgres.txt |
| Vitest | **152/152**, 12 arquivos | vitest.txt |
| TypeScript strict | **exit 0**, sem diagnósticos | typescript.txt, verification.txt |
| ESLint direcionado, --max-warnings 0 | **exit 0**, sem erros/avisos | eslint.txt, verification.txt |
| Build client/SSR/Nitro Cloudflare | **exit 0**, sem deploy | build.txt, verification.txt |
| Segurança dos arquivos | Sem achados nas heurísticas executadas | security-scan.json |

As 614 asserções são contadas nos dois rebuilds (592 anteriores + 22 novas de regressão); não significam 614 cenários distintos. Testes de reprodução sobre a base original são evidência separada e não devem ser somados ao número pós-correção.

Os logs TypeScript/ESLint ficam vazios porque não houve diagnóstico. A evidência de exit 0 está em verification.txt. As ferramentas de build podem imprimir avisos normais de dependências; não houve comando de deploy. Lint global da base continua com débito conhecido de 1111 erros e 14 avisos, registrado na CR-007B; não foi mascarado por lint direcionado.

O harness usa PostgreSQL real e `SET ROLE` com fixtures sintéticas; schema auth é substituto mínimo, não Supabase hospedado. Bancos temporários removidos ao final. Nenhum teste de UI visual foi executado nesta etapa: não houve mudança visual ou de runtime da aplicação.

## 6. Estado do GitHub e bloqueio exato

A descoberta oficial do conector `github` retornou **unsupported**. Não há GitHub CLI instalado, helper Git configurado ou variável padrão de autenticação GitHub presente no ambiente verificado. O acesso público de leitura por Git HTTPS funciona, mas isso **não demonstra autorização de escrita**.

Não foram procurados tokens em arquivos de usuário, solicitados PATs no chat ou improvisadas credenciais. Não foi tentado push não autenticado para provocar erro, nem usado token de outro serviço. O bloqueio é **ausência de canal GitHub autenticado suportado com escrita comprovada**, não uma afirmação de que o usuário não tenha permissão na conta GitHub.

**Push não realizado. Branch remota não criada por esta sessão.** Objetivo de publicação permanece pendente do mantenedor em ambiente autenticado oficial. Nenhum workflow remoto foi disparado por esta entrega. Conferir automações Lovable/GitHub antes do push do mantenedor: publicar branch pode disparar sincronização/CI/preview mesmo sem merge.

## 7. Pull Request

**PR não criado. Link: não disponível.** Não existe confirmação GitHub de criação nesta sessão. A listagem de PRs preexistentes não foi obtida; não presumir sua ausência. A descrição pronta para o conjunto atualizado está em `CR-007B5-PULL-REQUEST.md`. O mantenedor deve listar PRs antes de criar um, evitando duplicação.

## 8. Supabase somente leitura

Consultas atuais: credencial válida; organização selecionada/acessível `criatto3darte-ux's Org`, ID `akifnzwtxnmjxvaljjro`; `list_projects` retorna `items: []`.

Consequências:

- Nenhum ambiente de homologação identificado no escopo visível.
- Exclusividade de um projeto para Criatto 3D **não verificável**, porque não há projeto visível para inspecionar.
- Não é possível afirmar inexistência global de projetos: outra conta/organização ou autorização fora do escopo permanecem possíveis.
- Nenhum project_ref foi inventado. Nenhuma chave/secreto consultado, SQL remoto aplicado, RLS/usuário/bucket/projeto alterado.

Evidência sanitizada: `docs/evidence/cr007b5/supabase-readonly.json`.

## 9. Riscos residuais e pendências de homologação

1. Publicar a branch e abrir PR requer mantenedor autenticado; rever base/branch/PRs e automações imediatamente antes.
2. Aprovar a correção adicional: bundle original aprovado é histórico, não inclui hardening. Revisar a nona migration e o novo HEAD.
3. Identificar projeto dedicado de homologação, ownership, exclusividade, backups, inventário e grants reais. Não há autorização de aplicar SQL nesta etapa.
4. Testar Auth/JWT/PostgREST/Data API, schemas expostos, grants herdados/default privileges, owner/BYPASSRLS das views/helpers e Storage real. Harness local não substitui essa validação.
5. Definir workflow de mídia por servidor antes de uploads: editor não pode escrever metadados nem promover verificação. Operador/financeiro não recebem acesso direto a media_assets; resolução de anexos exigirá comando restrito futuro.
6. Proteção diferida de mídia e variantes valida estado visível na transação; não é prova de integridade sob toda concorrência. Testar disputa entre vínculo privado/publicação e seleção de variantes com locks apropriados antes de disponibilizar comandos. Varreduras globais de variantes precisam avaliação de desempenho.
7. Conferência concorrente de último proprietário foi executada em READ COMMITTED. Não estender a conclusão a estoque/pagamento; REPEATABLE READ é recusado e SERIALIZABLE precisa teste/retry.
8. Idempotência completa, cálculo de preços/cupons, soma de itens versus subtotal, estoque/ledger atômico, histórico/auditoria com comando, limites acumulados de pagamento, retenção/LGPD e rate limiting ainda não implementados. Writes correspondentes permanecem fechados ao cliente autenticado.
9. Grants de catálogo permitem edição autenticada autorizada, mas trilha de auditoria atômica por comando ainda é futura; não tratar fundação como backend comercial pronto.
10. Segredo de servidor/BYPASSRLS comprometido e DDL de superusuário estão fora da proteção RLS. Não existe certificação de produção por estes testes.

## 10. Fluxo seguro de integração oficial e parada

Utilizar **somente o novo bundle**, sem aplicar o patch antigo. Nenhuma operação a seguir foi executada remotamente pela Arena; são instruções para o mantenedor, após revisão/aprovação e verificação de automações.

### Revisão offline

```bash
sha256sum CR-007B5-supabase-foundation.bundle
# Comparar com CR-007B5-ARTIFACTS.txt por canal confiável.
git clone -b feature/cr-007b-supabase-foundation \
  /caminho/CR-007B5-supabase-foundation.bundle criatto-cr007b5-review
cd criatto-cr007b5-review
git bundle verify /caminho/CR-007B5-supabase-foundation.bundle
git fsck --full
git merge-base --is-ancestor c6b229c68a3862e4b2e192bab3a47ab4a0c9a15a HEAD
git log --oneline d922aeffe0f3bb7d7629ff3e8c3f76203a5b129f..HEAD
```

### Conferência remota e autenticação do mantenedor

```bash
# origin neste clone aponta para o bundle local, não para o GitHub.
git remote add official https://github.com/criatto3darte-ux/criatto-3d-studio.git
git fetch official
test "$(git rev-parse official/main)" = d922aeffe0f3bb7d7629ff3e8c3f76203a5b129f
# Se divergir, PARAR: revisar commits/diff sem merge ou rebase automático.
git ls-remote --heads official feature/cr-007b-supabase-foundation
```

Se a branch já existir: comparar SHAs/ancestralidade antes de publicar; não usar `+` em refspec nem force. Se houver trabalho remoto divergente, parar e coordenar com mantenedores.

Autenticar localmente por fluxo oficial do GitHub CLI (`gh auth login --web`), Git Credential Manager ou SSH próprio. **Nunca enviar PAT/token pelo chat ou gravá-lo em URL/arquivo do repositório.** Confirmar conta/host e acesso de escrita no repositório. Auditar workflows/sincronização Lovable para impedir deploy automático indesejado antes de publicar.

### Push e PR (somente pelo mantenedor autorizado)

```bash
git push official \
  refs/heads/feature/cr-007b-supabase-foundation:refs/heads/feature/cr-007b-supabase-foundation

# Conferir SHA remoto igual ao HEAD local:
git rev-parse HEAD
git ls-remote --heads official feature/cr-007b-supabase-foundation

# Inspecionar resultado e reutilizar PR existente, se houver:
gh pr list --repo criatto3darte-ux/criatto-3d-studio \
  --head feature/cr-007b-supabase-foundation --state all

# Somente se não houver PR a reutilizar e após conferir o estado:
gh pr create --repo criatto3darte-ux/criatto-3d-studio \
  --base main --head feature/cr-007b-supabase-foundation \
  --title "CR-007B: fundação de dados e hardening de mídia (CR-007B.5)" \
  --body-file /caminho/CR-007B5-PULL-REQUEST.md
```

Se push for rejeitado, parar e revisar; não insistir com force. Registrar URL e estado efetivamente retornados pelo GitHub. Deixar PR aberto; não habilitar auto-merge, não realizar merge/deploy/migrations. Manter CR-007C não iniciada.

**Conclusão:** fundação e correção local prontas para revisão por bundle; integração remota bloqueada pelo canal de escrita indisponível, homologação bloqueada pela ausência de projeto visível e autorização específica. Aguardando aprovação explícita para a próxima etapa.
