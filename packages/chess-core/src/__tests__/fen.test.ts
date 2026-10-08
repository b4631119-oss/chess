import { describe, expect, it } from 'vitest';
import { INITIAL_FEN, createGame, getFen, getLegalMoves, loadFen, makeMove } from '../index';

const KIWIPETE = 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1';

describe('getFen', () => {
  it('serializes the starting position', () => {
    expect(getFen(createGame())).toBe(INITIAL_FEN);
  });

  it('round-trips classic positions', () => {
    const positions = [
      KIWIPETE,
      '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1',
      'rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3',
      '4k3/8/8/8/8/8/8/4K3 b - - 42 100',
    ];
    for (const fen of positions) {
      expect(getFen(loadFen(fen))).toBe(fen);
    }
  });
});

describe('loadFen', () => {
  it('parses side to move, castling, en passant and counters', () => {
    const state = loadFen('4k3/8/8/8/8/8/8/4K3 b Kq e3 42 100');
    expect(state.turn).toBe('black');
    expect(state.castling.whiteKingSide).toBe(true);
    expect(state.castling.blackQueenSide).toBe(true);
    expect(state.castling.whiteQueenSide).toBe(false);
    expect(state.enPassant).toBe(20); // e3
    expect(state.halfmoveClock).toBe(42);
    expect(state.fullmoveNumber).toBe(100);
  });

  it('defaults the move counters when omitted', () => {
    const state = loadFen('4k3/8/8/8/8/8/8/4K3 w - -');
    expect(state.halfmoveClock).toBe(0);
    expect(state.fullmoveNumber).toBe(1);
  });

  it('rejects malformed FEN strings', () => {
    expect(() => loadFen('not a fen')).toThrow();
    expect(() => loadFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR x KQkq - 0 1')).toThrow();
    expect(() => loadFen('8/8/8/8/8/8/8/8 w - - 0 1')).toThrow(/king/);
  });
});

describe('fen round-trip through play', () => {
  it('produces an equivalent position after a move', () => {
    const before = createGame();
    const after = makeMove(before, { from: 12, to: 28 }); // e2-e4
    const reloaded = loadFen(getFen(after));
    expect(getFen(reloaded)).toBe(getFen(after));
    expect(getLegalMoves(reloaded).length).toBe(getLegalMoves(after).length);
  });
});
