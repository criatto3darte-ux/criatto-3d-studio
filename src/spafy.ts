// SPA-mode shim for @tanstack/react-start APIs.
//
// The application's root route (__root.tsx) uses `HeadContent` and `Scripts`
// from @tanstack/react-router (available in SPA mode), and `createStart` is
// only referenced from `src/start.ts`. No server functions are used by the
// application, so the runtime for `@tanstack/react-start/server-entry` is
// unreachable. We avoid pulling @tanstack/react-start into the client bundle
// entirely by stubbing out the tiny Start helpers used by `src/start.ts`.
//
// The router itself comes from @tanstack/react-router (pure client), which
// works identically in SPA mode — loader/beforeLoad/head/meta all resolve
// client-side.
//
// This file is intentionally side-effect free beyond exports: it just
// satisfies the `import "./spafy"` in main.tsx.
export {};
