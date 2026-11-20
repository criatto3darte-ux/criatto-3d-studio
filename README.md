# Criatto 3D Studio

Loja virtual da Criatto 3D: catálogo público, carrinho, pedidos pelo WhatsApp e
painel administrativo com MFA.

## Arquitetura

- **Frontend:** React + TanStack Router, gerado como SPA estática (`vite build`)
  e hospedado na Locaweb.
- **Backend:** Supabase (Postgres com RLS, Auth com MFA/AAL2, Storage e Edge
  Functions `checkout-order`, `catalog-media` e `banner-media`).
  - Produção: `criatto3d-producao` (`tdawygjcqmclwlrermpl`)
  - Homologação: `criatto3d-homolog` (`ugwuxczcqlrdjkpjsdqb`)

## Desenvolvimento

Requer [Bun](https://bun.sh) 1.2.

```sh
bun install
bun run dev
```

Copie `.env.example` para `.env.local` e preencha as variáveis públicas
(`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_APP_URL`). Nunca coloque a
`service_role` ou outros segredos no frontend.

## Verificação

```sh
npx tsc --noEmit
bun run test
bun run build
```

## Publicação

- Homologação: automática a cada integração na `main` (`deploy-homolog`), com
  testes de ponta a ponta no site publicado.
- Produção: `deploy-producao` (manual, digitando `PUBLICAR`), aceito só quando a
  homologação do mesmo commit passou. Detalhes em
  `docs/CR-017-HOMOLOGACAO-AUTOMATICA.md`.
- Plano B: `pacote-homolog` / `pacote-producao` geram o ZIP para envio manual.

Documentação detalhada das etapas em `docs/`.
