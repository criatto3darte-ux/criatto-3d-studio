/**
 * CR-008B — Static build compatibility tests.
 *
 * Estes testes não rodam o build, mas verificam propriedades estruturais do
 * código-fonte que são necessárias para o build estático funcionar.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "../..");

describe("CR-008B static build", () => {
  it("index.html (SPA shell) exists at project root", () => {
    expect(fs.existsSync(path.join(root, "index.html"))).toBe(true);
  });

  it("src/main.tsx (client entry) exists", () => {
    expect(fs.existsSync(path.join(root, "src/main.tsx"))).toBe(true);
  });

  it("vite.config.ts does NOT import @lovable.dev/vite-tanstack-config", () => {
    const cfg = fs.readFileSync(path.join(root, "vite.config.ts"), "utf8");
    // Apenas comentários podem mencionar o pacote antigo; imports não.
    const importLine = cfg
      .split("\n")
      .filter((l) => l.trim().startsWith("import"))
      .join("\n");
    expect(importLine.includes("@lovable.dev/vite-tanstack-config")).toBe(false);
  });

  it("package.json does NOT depend on @lovable.dev/vite-tanstack-config", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const all = { ...pkg.dependencies, ...pkg.devDependencies };
    expect(all["@lovable.dev/vite-tanstack-config"]).toBeUndefined();
  });

  it("package.json does NOT depend on nitro (no SSR build)", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const all = { ...pkg.dependencies, ...pkg.devDependencies };
    expect(all.nitro).toBeUndefined();
  });

  it("public/_redirects exists for SPA fallback (Netlify/Locaweb)", () => {
    expect(fs.existsSync(path.join(root, "public/_redirects"))).toBe(true);
    const content = fs.readFileSync(path.join(root, "public/_redirects"), "utf8");
    expect(content).toMatch(/\/\*/);
    expect(content).toContain("/index.html");
  });

  it("public/.htaccess exists for Apache/Locaweb fallback", () => {
    expect(fs.existsSync(path.join(root, "public/.htaccess"))).toBe(true);
  });

  it("index.html bootstraps theme before React (no FOUC)", () => {
    const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
    expect(html).toContain("criatto3d-theme");
    expect(html).toContain("/src/main.tsx");
  });

  it("no route file imports @tanstack/react-start (start-only APIs)", () => {
    const routesDir = path.join(root, "src/routes");
    const files = fs.readdirSync(routesDir).filter((f) => f.endsWith(".tsx"));
    for (const f of files) {
      const content = fs.readFileSync(path.join(routesDir, f), "utf8");
      if (content.includes("@tanstack/react-start")) {
        throw new Error(`Route file ${f} imports @tanstack/react-start (SSR-only API)`);
      }
    }
  });

  it("auth routes exist for the onboarding flow", () => {
    expect(fs.existsSync(path.join(root, "src/routes/auth.tsx"))).toBe(true);
    expect(fs.existsSync(path.join(root, "src/routes/auth.callback.tsx"))).toBe(true);
    expect(fs.existsSync(path.join(root, "src/routes/auth.set-password.tsx"))).toBe(true);
    expect(fs.existsSync(path.join(root, "src/routes/auth.mfa.tsx"))).toBe(true);
    expect(fs.existsSync(path.join(root, "src/routes/auth.done.tsx"))).toBe(true);
    expect(fs.existsSync(path.join(root, "src/routes/auth.error.tsx"))).toBe(true);
    expect(fs.existsSync(path.join(root, "src/routes/auth.login.tsx"))).toBe(true);
  });
});
