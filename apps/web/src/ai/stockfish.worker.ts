/**
 * Host worker for the real Stockfish WASM engine.
 *
 * The nmrugg/stockfish.js build is an Emscripten script that *itself* expects to
 * be the worker (it installs `self.onmessage` / `postMessage` to speak UCI). It
 * is therefore started as its own classic worker, and this module worker is the
 * thin, typed bridge to the app. Stockfish still never touches the UI thread.
 *
 * The wasm build is the single-threaded "lite" one: no SharedArrayBuffer, so no
 * COOP/COEP headers are required, and it is ~1.8 MB instead of ~99 MB.
 */

import { ENGINE_ERROR_PREFIX, UCI_QUIT } from './protocol';
import { workerScope } from './workerScope';

const ENGINE_SCRIPT = `${import.meta.env.BASE_URL}stockfish/stockfish-lite-single.js`;

let engine: Worker | null = null;

function reportError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  workerScope.postMessage(`${ENGINE_ERROR_PREFIX} ${message}`);
}

try {
  engine = new Worker(ENGINE_SCRIPT);
  engine.onmessage = (event: MessageEvent<unknown>): void => {
    if (typeof event.data === 'string') workerScope.postMessage(event.data);
  };
  engine.onerror = (event: ErrorEvent): void => {
    reportError(event.message || `Failed to load ${ENGINE_SCRIPT}`);
  };
} catch (error) {
  reportError(error);
}

workerScope.onmessage = (event: MessageEvent<unknown>): void => {
  const command = event.data;
  if (typeof command !== 'string') return;

  if (command === UCI_QUIT) {
    engine?.terminate();
    engine = null;
    workerScope.close();
    return;
  }

  engine?.postMessage(command);
};
