<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Criatto 3D architecture
- Production data architecture targets a client-owned Supabase project with TanStack Start hosted on Lovable; verify a dedicated staging database before migrations, because preview isolation alone does not protect production.
- Styling uses CSS Modules + tokens in src/styles/tokens.css (no Tailwind, per client brief); theme via `data-theme` on <html>.
- Store routes are `src/routes/_store.*` (pathless layout); admin routes are `src/routes/admin.*`; `/admin/login` is `admin_.login.tsx` to stay outside the sidebar layout.
- Shared UI lives in src/shared/ui; feature code in src/features/{store,admin,cart}; business rules stay in pure modules (e.g. cart.logic.ts) outside components.
- Work is delivered in stages CR-001..CR-006; wait for client approval between stages.
- tsconfig sets noPropertyAccessFromIndexSignature=false so CSS Module classes can be read as styles.foo; all other strict flags stay on.

## Criatto demo data
- Store and admin read one data source: `src/features/demo-data/repository.ts` (versioned LocalStorage, swap for server functions later); never add a second catalog or read mock files directly in UI.
- Business rules for demo data (validation, prices, stock, metrics) live in `src/features/demo-data/rules.ts` as pure functions with tests.
- Cart lines are reconciled against the public catalog (src/features/cart/cart.reconcile.ts) before display/checkout; never price checkout from stored cart prices. Future backend contracts live in src/features/data-contracts.
- Catalog filtering stays synchronous for the demo repository; URL updates merge the latest search state and price sorting uses effectivePriceCents, preventing stale filters and mismatched displayed prices.
- Cart stock limits live in cart.stock.ts and apply across variations for ready-stock products; mutations and checkout revalidate the public catalog, while stock reconciliation stays explicit (no reservation or deduction).
- Cart persistence uses cart.repository.ts with useSyncExternalStore, sanitized legacy arrays and non-echoing storage events; mutations read the latest snapshot and persistence failures remain visible without crashing.
- Product route metadata uses the repository's publicProducts projection, like the visible catalog; pass the hydrated snapshot through router context and invalidate only that route after hydration or repository changes. Initial hydration must use the server snapshot to avoid orphaned React 19 head tags; SSR's seed-only metadata is noindex because browser-only publication changes cannot be verified on the server.
- Validate every demo collection and relationship through demo-data/validation.ts on reads and writes; recover independent safe records without rewriting corrupted storage until explicit approval, so corruption cannot crash screens or silently destroy records.
- Persisted URLs use shared safe-url.ts (HTTPS or unambiguous root-relative paths; social hosts restricted); validate again at rendering, allowing temporary object URLs only when created by the local image picker, to prevent unsafe navigation and requests.
- Order transitions and payment events use demo-data/order.rules.ts; repository writes preserve snapshots and append-only history, while legacy histories accept reachable forward skips to preserve valid demo records.
- Dashboard, reports and daily charts share orderMetrics in demo-data/rules.ts so pending estimates, confirmed sales and received payments cannot diverge for the same orders.
- Store header/footer pass repository settings into the shared Logo; safe images fall back to the existing mark on failure so saved branding actually appears without breaking navigation.
