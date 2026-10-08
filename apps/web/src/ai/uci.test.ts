import { describe, expect, it } from 'vitest';
import { createGame, getLegalMoves } from '@chess/chess-core';
import {
  formatScore,
  parseBestMove,
  parseInfo,
  parseSquare,
  parseUciMove,
  resolveEngineMove,
  toUci,
  toWhitePerspective,
} from './uci';

describe('parseSquare', () => {
  it('maps algebraic names to 0..63', () => {
    expect(parseSquare('a1')).toBe(0);
    expect(parseSquare('e2')).toBe(12);
    expect(parseSquare('h8')).toBe(63);
  });

  it('rejects nonsense', () => {
    expect(parseSquare('i1')).toBeNull();
    expect(parseSquare('a9')).toBeNull();
    expect(parseSquare('a')).toBeNull();
    expect(parseSquare('a11')).toBeNull();
  });
});

describe('parseUciMove', () => {
  it('parses a quiet move', () => {
    expect(parseUciMove('e2e4')).toEqual({ from: 12, to: 28, promotion: null });
  });

  it('parses a promotion and uppercases/lowercases are equivalent', () => {
    expect(parseUciMove('e7e8q')).toEqual({ from: 52, to: 60, promotion: 'queen' });
    expect(parseUciMove('E7E8N')).toEqual({ from: 52, to: 60, promotion: 'knight' });
  });

  it('rejects malformed input', () => {
    expect(parseUciMove('')).toBeNull();
    expect(parseUciMove('e2')).toBeNull();
    expect(parseUciMove('e2e2')).toBeNull();
    expect(parseUciMove('e2e4x')).toBeNull();
    expect(parseUciMove('e7e8k')).toBeNull();
    expect(parseUciMove('x9z1')).toBeNull();
    expect(parseUciMove('bestmove')).toBeNull();
  });
});

describe('toUci', () => {
  it('round-trips through parseUciMove', () => {
    for (const uci of ['e2e4', 'g1f3', 'e7e8q', 'a7a8r']) {
      const parsed = parseUciMove(uci);
      expect(parsed).not.toBeNull();
      expect(toUci(parsed!)).toBe(uci);
    }
  });
});

describe('parseBestMove', () => {
  it('extracts the move and the ponder move', () => {
    expect(parseBestMove('bestmove e2e4 ponder e7e5')).toEqual({ move: 'e2e4', ponder: 'e7e5' });
    expect(parseBestMove('bestmove e7e8q')).toEqual({ move: 'e7e8q', ponder: null });
  });

  it('treats (none) as no move', () => {
    expect(parseBestMove('bestmove (none)')).toEqual({ move: null, ponder: null });
  });

  it('ignores other lines', () => {
    expect(parseBestMove('info depth 5')).toBeNull();
    expect(parseBestMove('')).toBeNull();
  });
});

describe('parseInfo', () => {
  it('parses depth, score and the principal variation', () => {
    const info = parseInfo('info depth 12 score cp 34 nodes 12345 nps 999 pv e2e4 e7e5 g1f3');
    expect(info).toEqual({
      depth: 12,
      score: { type: 'cp', value: 34 },
      pv: ['e2e4', 'e7e5', 'g1f3'],
      nodes: 12345,
      nps: 999,
      timeMs: undefined,
    });
  });

  it('parses mate scores and bound markers', () => {
    expect(parseInfo('info depth 3 score mate 2 pv d8h4')?.score).toEqual({ type: 'mate', value: 2 });
    expect(parseInfo('info depth 9 score cp -120 upperbound pv e2e4')?.score).toEqual({
      type: 'cp',
      value: -120,
    });
  });

  it('ignores non-search info lines', () => {
    expect(parseInfo('info string NNUE evaluation using nn-abc.nnue')).toBeNull();
    expect(parseInfo('uciok')).toBeNull();
  });
});

describe('resolveEngineMove', () => {
  const legal = getLegalMoves(createGame());

  it('accepts a legal move', () => {
    expect(resolveEngineMove('e2e4', legal)).toEqual({ from: 12, to: 28, promotion: null });
  });

  it('rejects an illegal but well-formed move', () => {
    expect(resolveEngineMove('e2e5', legal)).toBeNull();
    expect(resolveEngineMove('a1a8', legal)).toBeNull();
  });

  it('rejects garbage that is not UCI at all', () => {
    expect(resolveEngineMove('not-a-move', legal)).toBeNull();
    expect(resolveEngineMove('(none)', legal)).toBeNull();
  });

  it('requires the promotion piece to match', () => {
    const promotionPosition = createGame('7k/P7/8/8/8/8/8/K7 w - - 0 1');
    const promotionMoves = getLegalMoves(promotionPosition);
    expect(resolveEngineMove('a7a8q', promotionMoves)?.promotion).toBe('queen');
    expect(resolveEngineMove('a7a8r', promotionMoves)?.promotion).toBe('rook');
    // A promotion move without the piece suffix is not playable as-is.
    expect(resolveEngineMove('a7a8', promotionMoves)).toBeNull();
  });
});

describe('score formatting', () => {
  it('formats centipawn and mate scores', () => {
    expect(formatScore({ type: 'cp', value: 34 })).toBe('+0.34');
    expect(formatScore({ type: 'cp', value: -120 })).toBe('-1.20');
    expect(formatScore({ type: 'mate', value: 3 })).toBe('#3');
    expect(formatScore({ type: 'mate', value: -2 })).toBe('#-2');
    expect(formatScore(undefined)).toBe('—');
  });

  it('converts to White perspective', () => {
    expect(toWhitePerspective({ type: 'cp', value: 30 }, 'white')).toEqual({ type: 'cp', value: 30 });
    expect(toWhitePerspective({ type: 'cp', value: 30 }, 'black')).toEqual({ type: 'cp', value: -30 });
    expect(toWhitePerspective({ type: 'mate', value: 2 }, 'black')).toEqual({ type: 'mate', value: -2 });
  });
});
