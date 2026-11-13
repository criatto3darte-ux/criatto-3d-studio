import { useSyncExternalStore } from "react";
import { createSeed } from "./seed";
import { isDemoData } from "./rules";
import { DEMO_SCHEMA_VERSION, type DemoData, type DemoEnvelope } from "./model";

/**
 * Repositório central de demonstração (LocalStorage, versionado).
 * Contrato pensado para ser trocado por funções de servidor com Lovable Cloud depois:
 * `get`, `update`, `reset`, `subscribe`. Componentes usam apenas `useDemoData`/`demoRepository`.
 */
export const DEMO_STORAGE_KEY = "criatto3d:demo-data";

export interface DemoRepository {
  get(): DemoData;
  update(fn: (d: DemoData) => DemoData): void;
  reset(): void;
  subscribe(listener: () => void): () => void;
}

let serverSnapshot: DemoData | null = null;
export function getServerSnapshot(): DemoData {
  return (serverSnapshot ??= createSeed());
}

let current: DemoData | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function read(): DemoData {
  try {
    const raw = window.localStorage.getItem(DEMO_STORAGE_KEY);
    if (raw) {
      const env = JSON.parse(raw) as Partial<DemoEnvelope>;
      if (env.schemaVersion === DEMO_SCHEMA_VERSION && isDemoData(env.data)) return env.data;
    }
  } catch {
    /* corrupted or unavailable storage → fall back to seed */
  }
  return createSeed();
}

function write(data: DemoData) {
  try {
    const env: DemoEnvelope = { schemaVersion: DEMO_SCHEMA_VERSION, savedAt: new Date().toISOString(), data };
    window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(env));
  } catch {
    /* quota or private mode: keep in memory only */
  }
}

let storageBound = false;
function bindStorage() {
  if (storageBound || typeof window === "undefined") return;
  storageBound = true;
  window.addEventListener("storage", (e) => {
    if (e.key !== DEMO_STORAGE_KEY && e.key !== null) return;
    current = read();
    emit();
  });
}

export const demoRepository: DemoRepository = {
  get() {
    if (typeof window === "undefined") return getServerSnapshot();
    bindStorage();
    return (current ??= read());
  },
  update(fn) {
    const next = fn(this.get());
    if (!isDemoData(next)) throw new Error("Dados inválidos; alteração descartada.");
    current = next;
    write(next);
    emit();
  },
  reset() {
    current = createSeed();
    try { window.localStorage.removeItem(DEMO_STORAGE_KEY); } catch { /* ignore */ }
    write(current);
    emit();
  },
  subscribe(listener) {
    bindStorage();
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

/** Test helper: forget the in-memory cache. */
export function __resetDemoCache() {
  current = null;
}

export function useDemoData(): DemoData {
  return useSyncExternalStore(demoRepository.subscribe, () => demoRepository.get(), getServerSnapshot);
}

export function useDemoSelector<T>(select: (d: DemoData) => T): T {
  return select(useDemoData());
}
