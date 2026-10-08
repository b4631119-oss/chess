import type { Move } from '@chess/chess-core';

/** Uniformly pick one of the legal moves, or null when the game is over. */
export function pickRandomMove(moves: ReadonlyArray<Move>): Move | null {
  if (moves.length === 0) return null;
  const index = Math.floor(Math.random() * moves.length);
  return moves[index] ?? null;
}
