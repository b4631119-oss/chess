import type { Engine, EngineKind } from './types';
import { WorkerEngine, type CreateWorker } from './workerEngine';
import { WORKER_FACTORIES } from './workers';

/**
 * Build an engine behind the `Engine` seam. Swapping Stockfish for the built-in
 * search (or a future remote engine) is a one-line change here; no UI code
 * references a concrete implementation.
 */
export function createEngine(kind: EngineKind, createWorker?: CreateWorker): Engine {
  if (createWorker !== undefined) {
    return new WorkerEngine(createWorker, kind);
  }
  return new WorkerEngine(WORKER_FACTORIES[kind], kind);
}
