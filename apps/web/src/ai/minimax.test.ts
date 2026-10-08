import { describe, expect, it } from 'vitest';
import { createGame, getLegalMoves, isCheckmate, makeMove, type GameState } from '@chess/chess-core';
import { LOCAL_MAX_DEPTH, searchBestMove } from './minimax';
import { toUci } from './uci';

const FILES = 'abcdefgh';

function sq(name: string): number {
  return (Number(name[1]) - 1) * 8 + FILES.indexOf(name[0] as string);
}

function play(state: GameState, moves: ReadonlyArray<readonly [string, string]>): GameState {
  let next = state;
  for (const [from, to] of moves) next = makeMove(next, { from: sq(from), to: sq(to) });
  return next;
}

describe('searchBestMove', () => {
  it('returns a legal move from the starting position', () => {
    const game = createGame();
    const result = searchBestMove(game, 2);
    if (result === null) throw new Error('expected a move');

    const legal = getLegalMoves(game);
    expect(legal.some((move) => move.from === result.from && move.to === result.to)).toBe(true);
    expect(result.nodes).toBeGreaterThan(0);
  });

  it("finds mate in one (Fool's mate) as Black with depth 1", () => {
    const position = play(createGame(), [
      ['f2', 'f3'],
      ['e7', 'e5'],
      ['g2', 'g4'],
    ]);
    expect(position.turn).toBe('black');

    const result = searchBestMove(position, 1);
    if (result === null) throw new Error('expected a move');
    expect(toUci(result)).toBe('d8h4');

    const mated = makeMove(position, {
      from: result.from,
      to: result.to,
      promotion: result.promotion,
    });
    expect(isCheckmate(mated)).toBe(true);
  });

  it('returns null when there are no legal moves', () => {
    // Classic stalemate: Black is not in check and has no moves.
    expect(searchBestMove(createGame('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1'), 2)).toBeNull();
  });

  it('clamps the requested depth to its own limit', () => {
    const result = searchBestMove(createGame(), 99);
    if (result === null) throw new Error('expected a move');
    expect(result.depth).toBe(LOCAL_MAX_DEPTH);
  });

  it('prefers material gain', () => {
    // Black queen is hanging on d5 in front of White's rook; White should take it.
    const position = createGame('4k3/8/8/3q4/8/8/8/3RK3 w - - 0 1');
    const result = searchBestMove(position, 2);
    if (result === null) throw new Error('expected a move');
    expect(toUci(result)).toBe('d1d5');
  });
});
