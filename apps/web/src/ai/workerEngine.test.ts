import { describe, expect, it } from 'vitest';
import type { SearchInfo } from './types';
import { WorkerEngine, type WorkerLike } from './workerEngine';

/** A hand-rolled worker double that records commands and injects UCI lines. */
class FakeWorker implements WorkerLike {
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  readonly posted: string[] = [];
  terminated = false;

  postMessage(message: unknown): void {
    if (typeof message === 'string') this.posted.push(message);
  }

  terminate(): void {
    this.terminated = true;
  }

  emit(line: string): void {
    this.onmessage?.({ data: line } as unknown as MessageEvent<unknown>);
  }

  raise(message: string): void {
    this.onerror?.({ message } as unknown as ErrorEvent);
  }

  get last(): string | undefined {
    return this.posted[this.posted.length - 1];
  }
}

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

interface Ready {
  worker: FakeWorker;
  engine: WorkerEngine;
}

async function readyEngine(): Promise<Ready> {
  const worker = new FakeWorker();
  const engine = new WorkerEngine(() => worker, 'test');
  const init = engine.init();

  await flush();
  expect(worker.posted).toEqual(['uci']);

  worker.emit('uciok');
  await flush();
  expect(worker.last).toBe('isready');

  worker.emit('readyok');
  await expect(init).resolves.toBeUndefined();

  return { worker, engine };
}

describe('WorkerEngine contract', () => {
  it('performs the UCI handshake exactly once', async () => {
    const { worker, engine } = await readyEngine();
    // A second init must reuse the resolved handshake.
    await expect(engine.init()).resolves.toBeUndefined();
    expect(worker.posted.filter((command) => command === 'uci')).toHaveLength(1);
  });

  it('sends a position command with the move list', async () => {
    const { worker, engine } = await readyEngine();
    engine.setPosition('startpos-fen', ['e2e4', 'e7e5']);
    expect(worker.last).toBe('position fen startpos-fen moves e2e4 e7e5');

    engine.setPosition('startpos-fen');
    expect(worker.last).toBe('position fen startpos-fen');
  });

  it('builds the go command from depth and movetime and resolves on bestmove', async () => {
    const { worker, engine } = await readyEngine();

    const pending = engine.go({ depth: 5, movetime: 400 });
    expect(worker.last).toBe('go depth 5 movetime 400');

    worker.emit('info depth 5 score cp 34 pv e2e4 e7e5');
    worker.emit('bestmove e2e4 ponder e7e5');

    await expect(pending).resolves.toEqual({ bestMove: 'e2e4', eval: 34 });
  });

  it('uses no move when the engine reports (none)', async () => {
    const { worker, engine } = await readyEngine();
    const pending = engine.go({ depth: 1 });
    expect(worker.last).toBe('go depth 1');
    worker.emit('bestmove (none)');
    await expect(pending).resolves.toEqual({ bestMove: '(none)', eval: undefined });
  });

  it('streams search info to onInfo listeners', async () => {
    const { worker, engine } = await readyEngine();
    const seen: SearchInfo[] = [];
    const unsubscribe = engine.onInfo((info) => seen.push(info));

    const pending = engine.go({ depth: 3 });
    worker.emit('info depth 3 score mate 1 pv d8h4');
    worker.emit('bestmove d8h4');
    await pending;

    expect(seen).toHaveLength(1);
    expect(seen[0]?.score).toEqual({ type: 'mate', value: 1 });
    expect(seen[0]?.pv).toEqual(['d8h4']);

    unsubscribe();
    const second = engine.go({ depth: 3 });
    worker.emit('info depth 3 score cp 10 pv e2e4');
    worker.emit('bestmove e2e4');
    await second;
    expect(seen).toHaveLength(1);
  });

  it('supersedes a pending search when a new one starts', async () => {
    const { worker, engine } = await readyEngine();
    const first = engine.go({ depth: 8 });
    const second = engine.go({ depth: 2 });

    await expect(first).resolves.toEqual({ bestMove: '(none)', eval: undefined });

    worker.emit('bestmove e2e4');
    await expect(second).resolves.toEqual({ bestMove: 'e2e4', eval: undefined });
  });

  it('sends stop and quit and terminates the worker', async () => {
    const { worker, engine } = await readyEngine();
    engine.stop();
    expect(worker.last).toBe('stop');

    engine.quit();
    expect(worker.posted).toContain('quit');
    expect(worker.terminated).toBe(true);
  });

  it('rejects init when the host reports a load failure', async () => {
    const worker = new FakeWorker();
    const engine = new WorkerEngine(() => worker, 'test');
    const init = engine.init();
    await flush();

    worker.emit('engineerror stockfish-lite-single.wasm 404 Not Found');
    await expect(init).rejects.toThrow(/404 Not Found/);
  });

  it('rejects init when the worker raises an error event', async () => {
    const worker = new FakeWorker();
    const engine = new WorkerEngine(() => worker, 'test');
    const init = engine.init();
    await flush();

    worker.raise('boom');
    await expect(init).rejects.toThrow('boom');
  });

  it('rejects go before init', async () => {
    const worker = new FakeWorker();
    const engine = new WorkerEngine(() => worker, 'test');
    await expect(engine.go({ depth: 1 })).rejects.toThrow(/not initialised/);
  });
});
