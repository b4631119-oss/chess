import { ENGINE_ERROR_PREFIX, UCI_QUIT } from './protocol';
import type { Engine, EngineScore, GoOptions, GoResult, SearchInfo } from './types';
import { parseBestMove, parseInfo } from './uci';

/**
 * The subset of `Worker` this module needs. Keeping it structural lets tests
 * inject a fake worker and drives the same class.
 */
export interface WorkerLike {
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  postMessage(message: unknown): void;
  terminate(): void;
}

export type CreateWorker = () => WorkerLike;

const INIT_TIMEOUT_MS = 20_000;
const GO_TIMEOUT_FLOOR_MS = 8_000;
const NO_MOVE = '(none)';

interface PendingGo {
  resolve: (result: GoResult) => void;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * Speaks UCI to a worker and exposes the engine-agnostic `Engine` interface.
 * Knows nothing about Stockfish specifically, so any UCI engine works.
 */
export class WorkerEngine implements Engine {
  private worker: WorkerLike | null = null;
  private readonly lineListeners = new Set<(line: string) => void>();
  private readonly infoListeners = new Set<(info: SearchInfo) => void>();
  private lastScore: EngineScore | undefined;
  private pendingGo: PendingGo | null = null;
  private startupReject: ((error: Error) => void) | null = null;
  private initialization: Promise<void> | null = null;

  constructor(
    private readonly createWorker: CreateWorker,
    private readonly label: string,
  ) {}

  init(): Promise<void> {
    this.initialization ??= this.start();
    return this.initialization;
  }

  private async start(): Promise<void> {
    const worker = this.createWorker();
    this.worker = worker;

    worker.onmessage = (event: MessageEvent<unknown>): void => {
      const line = event.data;
      if (typeof line === 'string') this.handleLine(line);
    };
    worker.onerror = (event: ErrorEvent): void => {
      this.fail(new Error(event.message || `${this.label}: worker error`));
    };

    await this.expect('uciok', () => this.send('uci'));
    await this.expect('readyok', () => this.send('isready'));
  }

  setPosition(fen: string, moves: string[] = []): void {
    const suffix = moves.length > 0 ? ` moves ${moves.join(' ')}` : '';
    this.send(`position fen ${fen}${suffix}`);
  }

  go(opts: GoOptions): Promise<GoResult> {
    if (this.worker === null) {
      return Promise.reject(new Error(`${this.label}: not initialised`));
    }

    // A new search supersedes any in-flight one.
    this.resolvePending({ bestMove: NO_MOVE });
    this.lastScore = undefined;

    return new Promise<GoResult>((resolve) => {
      const timeoutMs = Math.max(GO_TIMEOUT_FLOOR_MS, (opts.movetime ?? 0) + GO_TIMEOUT_FLOOR_MS);
      const timer = setTimeout(() => {
        this.pendingGo = null;
        resolve({ bestMove: NO_MOVE });
      }, timeoutMs);

      this.pendingGo = { resolve, timer };
      this.send(buildGoCommand(opts));
    });
  }

  stop(): void {
    this.send('stop');
  }

  quit(): void {
    if (this.worker === null) return;
    this.send(UCI_QUIT);
    this.worker.terminate();
    this.worker = null;
    this.resolvePending({ bestMove: NO_MOVE });
  }

  onInfo(listener: (info: SearchInfo) => void): () => void {
    this.infoListeners.add(listener);
    return () => {
      this.infoListeners.delete(listener);
    };
  }

  /** Last score reported during the most recent search. */
  get score(): EngineScore | undefined {
    return this.lastScore;
  }

  private handleLine(line: string): void {
    if (line.startsWith(ENGINE_ERROR_PREFIX)) {
      const message = line.slice(ENGINE_ERROR_PREFIX.length).trim();
      this.fail(new Error(message || `${this.label}: engine failed to start`));
      return;
    }

    for (const listener of [...this.lineListeners]) listener(line);

    const info = parseInfo(line);
    if (info !== null) {
      if (info.score !== undefined) this.lastScore = info.score;
      for (const listener of [...this.infoListeners]) listener(info);
    }

    const best = parseBestMove(line);
    if (best !== null) {
      const evalScore = this.lastScore?.type === 'cp' ? this.lastScore.value : undefined;
      this.resolvePending({ bestMove: best.move ?? NO_MOVE, eval: evalScore });
    }
  }

  private resolvePending(result: GoResult): void {
    const pending = this.pendingGo;
    if (pending === null) return;
    this.pendingGo = null;
    clearTimeout(pending.timer);
    pending.resolve(result);
  }

  private fail(error: Error): void {
    const reject = this.startupReject;
    this.startupReject = null;
    reject?.(error);
    this.resolvePending({ bestMove: NO_MOVE });
  }

  private send(command: string): void {
    this.worker?.postMessage(command);
  }

  private expect(token: string, send: () => void): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const cleanup = (): void => {
        clearTimeout(timer);
        this.lineListeners.delete(listener);
        if (this.startupReject === reject) this.startupReject = null;
      };

      const listener = (line: string): void => {
        if (line === token) {
          cleanup();
          resolve();
        }
      };

      const timer = setTimeout(() => {
        cleanup();
        reject(new Error(`${this.label}: timed out waiting for "${token}"`));
      }, INIT_TIMEOUT_MS);

      this.startupReject = reject;
      this.lineListeners.add(listener);

      try {
        send();
      } catch (error) {
        cleanup();
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }
}

function buildGoCommand(opts: GoOptions): string {
  const parts = ['go'];
  if (opts.depth !== undefined) parts.push('depth', String(opts.depth));
  if (opts.movetime !== undefined) parts.push('movetime', String(opts.movetime));
  return parts.join(' ');
}
