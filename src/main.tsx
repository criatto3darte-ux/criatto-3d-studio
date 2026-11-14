// Entry point for the static SPA build (client-side only).
//
// Mounts the TanStack Router app into #root. Hydration/SSR is not used —
// this is a pure client-side SPA suitable for static hosting.
import React from "react";
import ReactDOM from "react-dom/client";

// Global stylesheet (CSS Modules, design tokens and resets are pulled from here).
import "./styles.css";

import { RouterProvider } from "@tanstack/react-router";
import { getRouter } from "./router";

// TanStack Start expects `startInstance` from `src/start.ts` to be imported as
// a side effect (installing middleware). In SPA mode we skip it (no server
// functions, no CSRF middleware needed on the client), but we keep a stub
// import-safe no-op so no code path crashes if a future change references it.
import "./spafy";

const router = getRouter();

// Register the router instance for type safety.
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

// Dark/Light theme is already applied by the boot script in index.html before
// React mounts, so we don't need to do anything else here.
const container = document.getElementById("root");
if (!container) {
  throw new Error("Root container #root not found; check index.html.");
}
ReactDOM.createRoot(container).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
