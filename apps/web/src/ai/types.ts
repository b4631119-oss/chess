import type { MoveInput } from '@chess/chess-core';

/** Options for a single search request. */
export interface GoOptions {
  depth?: number;
  movetime?: number;
}

export interface GoResult {
  /** UCI move such as `e2e4`, `e7e8q`, or `(none)` when there is no move. */
  bestMove: string;
  /** Last centipawn score reported by the engine (side-to-move relative). */
  eval?: number;
}

export type EngineScore =
  | { readonly type: 'cp'; readonly value: number }
  | { readonly type: 'mate'; readonly value: number };

export interface SearchInfo {
  readonly depth?: number;
  readonly score?: EngineScore;
  readonly pv: ReadonlyArray<string>;
  readonly nodes?: number;
  readonly nps?: number;
  readonly timeMs?: number;
}

/**
 * The engine seam. Any implementation (Stockfish WASM, the built-in minimax, a
 * remote server) can be dropped in here without the UI knowing the difference.
 */
export interface Engine {
  init(): Promise<void>;
  setPosition(fen: string, moves?: string[]): void;
  go(opts: GoOptions): Promise<GoResult>;
  stop(): void;
  quit(): void;
  /** Optional live search info so the UI can show eval/depth while thinking. */
  onInfo?(listener: (info: SearchInfo) => void): () => void;
}

export type EngineKind = 'stockfish' | 'local';

export type Difficulty = 'easy' | 'medium' | 'hard' | 'max';

export type GameMode = 'human-vs-human' | 'ai-play-white' | 'ai-play-black' | 'ai-vs-ai';

export type AiStatus = 'loading' | 'idle' | 'thinking' | 'error';

/** A move coming out of an engine, in the shape the reducer accepts. */
export type EngineMove = MoveInput;
