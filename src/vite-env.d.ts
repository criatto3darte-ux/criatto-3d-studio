/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Supabase project URL (ex.: https://ugwuxczcqlrdjkpjsdqb.supabase.co).
   *
   * Safe to bundle in the browser: identificador público do projeto.
   */
  readonly VITE_SUPABASE_URL?: string;
  /**
   * Supabase anon/publishable key.
   *
   * Safe to bundle in the browser: é a chave pública (pode ser exposta),
   * usada em conjunto com RLS no Postgres. NUNCA coloque a service_role aqui.
   */
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
