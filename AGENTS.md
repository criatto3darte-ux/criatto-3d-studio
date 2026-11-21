## Criatto 3D architecture
- Production data architecture targets a client-owned Supabase project with the TanStack Router SPA built as static files and hosted on Locaweb (no Lovable); production Supabase is `tdawygjcqmclwlrermpl`, homologation is `ugwuxczcqlrdjkpjsdqb`; verify a dedicated staging database before migrations, because preview isolation alone does not protect production.
- Styling uses CSS Modules + tokens in src/styles/tokens.css (no Tailwind, per client brief); theme via `data-theme` on <html>, saved under `criatto3d:theme` (index.html boot script and ThemeProvider must use the same key).
- Store routes are `src/routes/_store.*` (pathless layout); admin routes are `src/routes/admin.*`; `/admin/login` is `admin_.login.tsx` to stay outside the sidebar layout.
- Shared UI lives in src/shared/ui; feature code in src/features/{store,admin,cart,catalog,checkout}; business rules stay in pure modules (e.g. cart.logic.ts, admin-metrics.ts) outside components, with tests.
- Work is delivered in stages numbered CR-0xx (latest: CR-018; next: CR-019); keep this numbering in migrations, docs and PRs, and wait for client approval between stages.
- tsconfig sets noPropertyAccessFromIndexSignature=false so CSS Module classes can be read as styles.foo; all other strict flags stay on.

## Live data (Supabase)
- Store and admin read and write Supabase only, through services in src/features/catalog (*.service.ts, supabase-catalog.ts), src/features/checkout/orders.service.ts and src/features/admin/admin-metrics.ts. The LocalStorage demo repository (src/features/demo-data/repository.ts) is legacy and only exercised by tests: never use it in screens, never add a second catalog or read mock files in UI.
- src/features/demo-data/rules.ts and validation.ts remain the shared pure validators (banner, product, settings forms); keep them pure and tested.
- The anonymous storefront reads only the `public_*` views (security-barrier projections, SELECT-only); base tables keep RLS and admin writes require the role plus MFA (`require_aal2()`). Never disable RLS or widen grants to fix a bug.
- Cart lines are reconciled against the public catalog (src/features/cart/cart.reconcile.ts) before display/checkout; stock limits live in cart.stock.ts; cart persistence uses cart.repository.ts with useSyncExternalStore. Never price anything from stored cart prices.
- Persisted URLs use shared safe-url.ts (HTTPS or unambiguous root-relative paths; social hosts restricted) and are validated again at rendering.
- Images are validated by content (catalog-media.ts magic bytes), converted to WebP and uploaded only through the authenticated `catalog-media` / `banner-media` Edge Functions.

## Orders, payments and shipping (rules for CR-019+)
- The `checkout-order` Edge Function is the only way to create an order: it recalculates prices, stock, shipping and totals on the server and ignores amounts sent by the browser.
- Only the server confirms a payment: a provider notice (PagBank webhook) only triggers a server-side lookup with the store's key; the order becomes paid when that lookup matches the order id and the total. Opening WhatsApp or returning from the payment page never marks an order as paid.
- Every payment event is recorded once (idempotent on the provider's id); order status history and payments stay append-only; status changes go through the SQL transition functions.
- Payment and shipping credentials (PagBank, Melhor Envio) live only in Edge Function secrets, never in the frontend, the repository or logs.
- Customer personal data (CPF, address, e-mail, phone) is visible only in the MFA-protected admin; public order tracking shows a random tracking code lookup with first name, items and status only.

## Delivery workflow
- Work on a branch and open a PR; pushing a work branch is fine. Merging to main, deploying, applying remote migrations, changing secrets, auth settings or remote data require the owner's explicit authorization for that operation and environment (merges: "pode integrar o PR N").
- Merging to main triggers `deploy-homolog`: build, `scripts/validar-pacote.sh`, FTP upload to homolog.criatto3d.art.br and the Playwright suite (e2e/) in desktop and mobile, light and dark themes. These automated homolog runs and the read-only production check are pre-authorized.
- Production is published only through `deploy-producao` (input `PUBLICAR`), which refuses commits whose homolog run did not pass, then runs the `@somente-leitura` checks. Never write test data to production.
- Homolog keeps robot fixtures: the e2e admin user, category `qa-automacao`, product `produto-qa-e2e` and the inactive "Banner QA E2E". Do not delete, activate or reuse them.
- Every migration is versioned in supabase/migrations with the CR number, gets its sha256 pinned in tests/postgres/run.py (CI fails otherwise) plus harness checks, and is applied to homolog before production.
- Report checks honestly: say what was run and its result, what was not run and why; never claim a test passed that did not run.
- If another AI tool (e.g. ChatGPT Work) also edits this repository, each tool works on its own branch and delivers through PRs; never push to or rewrite another tool's branch.
