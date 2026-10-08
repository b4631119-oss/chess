/**
 * A tiny typed facade over the worker global scope.
 *
 * The app compiles with the DOM lib (for React), so `self` is typed as
 * `Window`; casting once here keeps worker code honest without sprinkling
 * `any` around.
 */
export interface WorkerScope {
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
  postMessage(message: unknown): void;
  close(): void;
}

export const workerScope = globalThis as unknown as WorkerScope;
