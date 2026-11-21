// Gera dist/sitemap.xml da loja de produção: páginas fixas + produtos
// publicados (view pública public_products, lida com a chave publicável).
// Uso: node scripts/gerar-sitemap.mjs <site> <supabase-url> <chave-publicavel>
// Se o catálogo não responder, publica só as páginas fixas (não trava o deploy).
import { writeFileSync } from "node:fs";

const [site, supabaseUrl, key] = process.argv.slice(2);
if (!/^https:\/\/[a-z0-9.-]+$/i.test(site ?? "") || !/^https:\/\//.test(supabaseUrl ?? "") || !key) {
  console.error("Uso: node scripts/gerar-sitemap.mjs <site> <supabase-url> <chave-publicavel>");
  process.exit(2);
}

const STATIC_PAGES = [
  ["/", "daily", "1.0"],
  ["/produtos", "daily", "0.9"],
  ["/categorias", "weekly", "0.7"],
  ["/personalizados", "monthly", "0.6"],
  ["/sobre", "monthly", "0.5"],
  ["/contato", "monthly", "0.5"],
];
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

let slugs = [];
try {
  const response = await fetch(`${supabaseUrl}/rest/v1/public_products?select=slug&order=slug`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const rows = await response.json();
  slugs = rows.map((row) => row?.slug).filter((slug) => typeof slug === "string" && SLUG.test(slug));
} catch (error) {
  console.warn(`::warning::Sitemap sem produtos (catálogo indisponível: ${error.message}).`);
}

const today = new Date().toISOString().slice(0, 10);
const entry = (path, changefreq, priority) =>
  `  <url><loc>${site}${path}</loc><lastmod>${today}</lastmod>` +
  `<changefreq>${changefreq}</changefreq><priority>${priority}</priority></url>`;
const xml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...STATIC_PAGES.map(([path, freq, prio]) => entry(path, freq, prio)),
  ...slugs.map((slug) => entry(`/produto/${slug}`, "weekly", "0.8")),
  "</urlset>",
  "",
].join("\n");

writeFileSync("dist/sitemap.xml", xml);
console.log(`sitemap.xml: ${STATIC_PAGES.length} páginas fixas + ${slugs.length} produtos`);
