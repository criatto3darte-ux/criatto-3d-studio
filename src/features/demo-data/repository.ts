import { useSyncExternalStore } from "react";
import { createSeed } from "./seed";
import { isDemoData } from "./rules";
import { DEMO_SCHEMA_VERSION, type DemoData, type DemoEnvelope } from "./model";
import { recoverDemoData } from "./validation";
import { validOrderUpdates } from "./order.rules";

/**
 * Repositório central de demonstração (LocalStorage, versionado).
 * Contrato pensado para ser trocado por funções de servidor com Lovable Cloud depois:
 * `get`, `update`, `reset`, `subscribe`. Componentes usam apenas `useDemoData`/`demoRepository`.
 */
export const DEMO_STORAGE_KEY = "criatto3d:demo-data";

export interface DemoRepository {
  get(): DemoData;
  update(fn: (d: DemoData) => DemoData): boolean;
  reset(): boolean;
  subscribe(listener: () => void): () => void;
}

let serverSnapshot: DemoData | null = null;
export function getServerSnapshot(): DemoData {
  return (serverSnapshot ??= createSeed());
}

let current: DemoData | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
export interface DemoStorageStatus {
  readError: boolean;
  writeError: boolean;
  recoveryRequired: boolean;
  issues: string[];
  rejected: boolean;
}
const clearStatus: DemoStorageStatus = { readError: false, writeError: false, recoveryRequired: false, issues: [], rejected: false };
let status = clearStatus;
let recoveryApproved = false;

export function getDemoStorageStatus() { return status; }
export function useDemoStorageStatus() {
  // Initialize data and status together, without exposing browser-only state during SSR.
  useDemoData();
  return useSyncExternalStore(demoRepository.subscribe, getDemoStorageStatus, () => clearStatus);
}
export function acceptRecoveredDemoData() {
  recoveryApproved = true;
  status = { ...status, recoveryRequired: false };
  emit();
}

function read(): DemoData {
  try {
    const raw = window.localStorage.getItem(DEMO_STORAGE_KEY);
    if (!raw) { status = clearStatus; return createSeed(); }
    const env: unknown = JSON.parse(raw);
    if (!env || typeof env !== "object" || Array.isArray(env)) throw new Error("invalid envelope");
    const envelope = env as Record<string, unknown>;
    if (envelope.schemaVersion !== DEMO_SCHEMA_VERSION || typeof envelope.savedAt !== "string" || !Number.isFinite(Date.parse(envelope.savedAt))) throw new Error("invalid version/date");
    const recovered = recoverDemoData(envelope.data, createSeed());
    status = { ...clearStatus, recoveryRequired: recovered.issues.length > 0, issues: recovered.issues };
    return recovered.data;
  } catch {
    let readError = false;
    try { window.localStorage.getItem(DEMO_STORAGE_KEY); } catch { readError = true; }
    status = { ...clearStatus, readError, recoveryRequired: !readError, issues: [readError ? "Não foi possível ler o armazenamento." : "JSON, versão ou envelope inválido; conteúdo original preservado."] };
    return current ?? createSeed();
  }
}

function write(data: DemoData) {
  try {
    const env: DemoEnvelope = { schemaVersion: DEMO_SCHEMA_VERSION, savedAt: new Date().toISOString(), data };
    window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(env));
    status = { ...clearStatus };
    return true;
  } catch {
    status = { ...status, writeError: true };
    return false;
  }
}

let storageBound = false;
function bindStorage() {
  if (storageBound || typeof window === "undefined") return;
  storageBound = true;
  window.addEventListener("storage", (e) => {
    if (e.key !== DEMO_STORAGE_KEY && e.key !== null) return;
    recoveryApproved = false;
    if (status.writeError) {
      status = { ...status, recoveryRequired: true, issues: [...status.issues, "Outra aba alterou os dados; o rascunho não salvo foi preservado na memória."] };
      emit();
      return;
    }
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
    this.get();
    // A failed write is an in-memory draft: do not replace it with older storage.
    if (!status.writeError && !status.recoveryRequired && !recoveryApproved) {
      const previous = current;
      const latest = read();
      current = JSON.stringify(previous) === JSON.stringify(latest) ? previous : latest;
    }
    if (status.recoveryRequired) { emit(); return false; }
    let next: DemoData;
    try { next = fn(structuredClone(this.get())); }
    catch { status = { ...status, rejected: true }; emit(); return false; }
    if (!isDemoData(next) || !validOrderUpdates(this.get().orders, next.orders)) { status = { ...status, rejected: true }; emit(); return false; }
    current = next;
    const saved = write(next);
    if (saved) recoveryApproved = false;
    emit();
    return saved;
  },
  reset() {
    current = createSeed();
    const saved = write(current);
    emit();
    return saved;
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
  status = clearStatus;
  recoveryApproved = false;
}

export function useDemoData(): DemoData {
  return useSyncExternalStore(demoRepository.subscribe, () => demoRepository.get(), getServerSnapshot);
}

export function useDemoSelector<T>(select: (d: DemoData) => T): T {
  return select(useDemoData());
}
