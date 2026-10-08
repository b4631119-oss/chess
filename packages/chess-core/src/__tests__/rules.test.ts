import { beforeEach, describe, expect, it } from 'vitest';
import {
  createGame,
  findMove,
  getDrawReason,
  getGameStatus,
  getLegalMoves,
  isCheck,
  isCheckmate,
  isDraw,
  isFiftyMoveRule,
  isInsufficientMaterialState,
  isStalemate,
  isThreefoldRepetition,
  loadPgn,
  makeMove,
  type GameState,
} from '../index';

const FILES = 'abcdefgh';

function sq(name: string): number {
  return (Number(name[1]) - 1) * 8 + FILES.indexOf(name[0] as string);
}

function play(state: GameState, moves: ReadonlyArray<[string, string]>): GameState {
  let next = state;
  for (const [from, to] of moves) {
    next = makeMove(next, { from: sq(from), to: sq(to) });
  }
  return next;
}

const KIWIPETE_CASTLE_FEN = 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1';

describe('checks and mates', () => {
  it("detects checkmate (Scholar's mate)", () => {
    const state = loadPgn('1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7#');
    expect(isCheckmate(state)).toBe(true);
    expect(getGameStatus(state)).toBe('checkmate');
  });

  it("plays Fool's mate and reports the winner's result token", () => {
    const state = loadPgn('1. f3 e5 2. g4 Qh4#');
    expect(isCheckmate(state)).toBe(true);
    expect(getGameStatus(state)).toBe('checkmate');
  });

  it('detects check but not mate with a legal escape', () => {
    const state = createGame('4k3/8/8/8/8/8/8/4R1K1 b - - 0 1');
    expect(isCheck(state)).toBe(true);
    expect(isCheckmate(state)).toBe(false);
    expect(getGameStatus(state)).toBe('check');
  });
});

describe('stalemate', () => {
  it('recognises a classic stalemate', () => {
    const state = createGame('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
    expect(isCheck(state)).toBe(false);
    expect(isStalemate(state)).toBe(true);
    expect(getLegalMoves(state)).toHaveLength(0);
    expect(getGameStatus(state)).toBe('stalemate');
  });
});

describe('castling', () => {
  it('offers both castling moves and moves the rook', () => {
    const state = createGame(KIWIPETE_CASTLE_FEN);
    const kingMoves = getLegalMoves(state, sq('e1'));
    const kingSide = kingMoves.find((move) => move.isCastle === 'king');
    const queenSide = kingMoves.find((move) => move.isCastle === 'queen');

    expect(kingSide).toBeDefined();
    expect(queenSide).toBeDefined();

    const castled = makeMove(state, kingSide ?? { from: sq('e1'), to: sq('g1') });
    expect(castled.board[sq('g1')]).toEqual({ type: 'king', color: 'white' });
    expect(castled.board[sq('f1')]).toEqual({ type: 'rook', color: 'white' });
    expect(castled.board[sq('h1')]).toBeNull();
    expect(castled.board[sq('e1')]).toBeNull();
    expect(castled.castling.whiteKingSide).toBe(false);
    expect(castled.castling.whiteQueenSide).toBe(false);
  });

  it('does not allow castling through attacked squares', () => {
    const state = createGame('r3k2r/8/8/8/8/8/6q1/R3K2R w KQkq - 0 1');
    const kingMoves = getLegalMoves(state, sq('e1'));
    expect(kingMoves.some((move) => move.isCastle === 'king')).toBe(false);
    expect(kingMoves.some((move) => move.isCastle === 'queen')).toBe(true);
  });

  it('loses castling rights when the rook moves', () => {
    const state = createGame(KIWIPETE_CASTLE_FEN);
    const afterRook = play(state, [['h1', 'h2']]);
    expect(afterRook.castling.whiteKingSide).toBe(false);
    expect(afterRook.castling.whiteQueenSide).toBe(true);
  });
});

describe('en passant', () => {
  it('captures a pawn that just advanced two squares', () => {
    const state = createGame('rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3');
    const epMove = getLegalMoves(state, sq('e5')).find((move) => move.isEnPassant);

    expect(epMove).toBeDefined();
    expect(epMove?.to).toBe(sq('f6'));

    const captured = makeMove(state, epMove ?? { from: sq('e5'), to: sq('f6') });
    expect(captured.board[sq('f6')]).toEqual({ type: 'pawn', color: 'white' });
    expect(captured.board[sq('f5')]).toBeNull();
  });

  it('expires the en-passant target on the next move', () => {
    const state = createGame('rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3');
    expect(state.enPassant).toBe(sq('f6'));
    const after = makeMove(state, { from: sq('g2'), to: sq('g3') });
    expect(after.enPassant).toBeNull();
  });
});

describe('promotion', () => {
  it('offers all four promotions and places the chosen piece', () => {
    const state = createGame('7k/P7/8/8/8/8/8/K7 w - - 0 1');
    const moves = getLegalMoves(state, sq('a7'));
    expect(moves).toHaveLength(4);
    expect(moves.map((move) => move.promotion).sort()).toEqual(['bishop', 'knight', 'queen', 'rook']);

    const promoted = makeMove(state, { from: sq('a7'), to: sq('a8'), promotion: 'queen' });
    expect(promoted.board[sq('a8')]).toEqual({ type: 'queen', color: 'white' });
  });

  it('rejects a promotion without a piece choice', () => {
    const state = createGame('7k/P7/8/8/8/8/8/K7 w - - 0 1');
    expect(() => makeMove(state, { from: sq('a7'), to: sq('a8') })).toThrow();
  });
});

describe('draw rules', () => {
  let state: GameState;

  beforeEach(() => {
    state = createGame();
  });

  it('applies the fifty-move rule', () => {
    const drawn = createGame('8/8/8/8/8/8/6k1/R5K1 w - - 100 80');
    expect(isFiftyMoveRule(drawn)).toBe(true);
    expect(isDraw(drawn)).toBe(true);
    expect(getDrawReason(drawn)).toBe('fifty-move');
  });

  it('applies the threefold repetition rule', () => {
    const repeated = loadPgn('1. Nf3 Nf6 2. Ng1 Ng8 3. Nf3 Nf6 4. Ng1 Ng8');
    expect(isThreefoldRepetition(repeated)).toBe(true);
    expect(getGameStatus(repeated)).toBe('draw');
  });

  it('does not claim a draw in the starting position', () => {
    expect(isDraw(state)).toBe(false);
    expect(isThreefoldRepetition(state)).toBe(false);
    expect(getGameStatus(state)).toBe('ongoing');
  });

  it('detects insufficient material', () => {
    expect(isInsufficientMaterialState(createGame('8/8/8/4k3/8/8/4K3/8 w - - 0 1'))).toBe(true);
    expect(isInsufficientMaterialState(createGame('8/8/8/4k3/8/8/4K3/6B1 w - - 0 1'))).toBe(true);
    expect(isInsufficientMaterialState(createGame('8/8/8/4k3/8/8/4K3/6Q1 w - - 0 1'))).toBe(false);
  });
});

describe('illegal moves', () => {
  it('throws when a move is not legal', () => {
    const state = createGame();
    expect(() => makeMove(state, { from: sq('e2'), to: sq('e5') })).toThrow(/Illegal move/);
  });

  it('leaves the original state untouched (immutability)', () => {
    const state = createGame();
    const before = state.board.map((piece) => (piece ? { ...piece } : null));
    makeMove(state, { from: sq('e2'), to: sq('e4') });
    expect(state.board).toEqual(before);
    expect(state.history).toHaveLength(0);
  });

  it('finds a legal move by squares', () => {
    const state = createGame();
    expect(findMove(state, { from: sq('g1'), to: sq('f3') })).not.toBeNull();
    expect(findMove(state, { from: sq('g1'), to: sq('g3') })).toBeNull();
  });
});
