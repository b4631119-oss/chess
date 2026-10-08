import type { EngineKind } from './types';
import type { CreateWorker, WorkerLike } from './workerEngine';

/**
 * Engine workers are created with Vite's `new URL(..., import.meta.url)` form so
 * each one is bundled as its own chunk and loaded as an ES module.
 */
export function createStockfishWorker(): WorkerLike {
  return new Worker(new URL('./stockfish.worker.ts', import.meta.url), { type: 'module' });
}

export function createLocalWorker(): WorkerLike {
  return new Worker(new URL('./local.worker.ts', import.meta.url), { type: 'module' });
}

export const WORKER_FACTORIES: Record<EngineKind, CreateWorker> = {
  stockfish: createStockfishWorker,
  local: createLocalWorker,
};

export const ENGINE_LABELS: Record<EngineKind, string> = {
  stockfish: 'Stockfish 19 (WASM)',
  local: 'Встроенный minimax',
};

export interface EngineOption {
  readonly id: EngineKind;
  readonly label: string;
}

export const ENGINE_OPTIONS: readonly EngineOption[] = [
  { id: 'stockfish', label: ENGINE_LABELS.stockfish },
  { id: 'local', label: ENGINE_LABELS.local },
];

export function isEngineKind(value: string): value is EngineKind {
  return ENGINE_OPTIONS.some((option) => option.id === value);
}
