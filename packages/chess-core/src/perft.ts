/**
 * Perft: count leaf nodes of the legal-move tree to a given depth. This is the
 * standard correctness harness for a chess move generator.
 */

import {
  applyMove,
  generateLegalMoves,
  moveFrom,
  moveTo,
  toInternal,
  undoMove,
  type InternalPosition,
} from './internal';
import { squareName } from './san';
import type { GameState } from './types';

function perftInternal(pos: InternalPosition, depth: number): number {
  const moves = generateLegalMoves(pos);
  if (depth <= 1) return moves.length;

  let nodes = 0;
  for (const move of moves) {
    const undo = applyMove(pos, move);
    nodes += perftInternal(pos, depth - 1);
    undoMove(pos, move, undo);
  }
  return nodes;
}

/** Total number of leaf nodes reachable in `depth` half-moves from `state`. */
export function perft(state: GameState, depth: number): number {
  if (depth <= 0) return 1;
  return perftInternal(toInternal(state), depth);
}

/** Per-root-move node counts (keys are UCI-like `e2e4` strings). */
export function perftDivide(state: GameState, depth: number): Record<string, number> {
  const pos = toInternal(state);
  const result: Record<string, number> = {};

  for (const move of generateLegalMoves(pos)) {
    const undo = applyMove(pos, move);
    const nodes = depth <= 1 ? 1 : perftInternal(pos, depth - 1);
    undoMove(pos, move, undo);
    result[`${squareName(moveFrom(move))}${squareName(moveTo(move))}`] = nodes;
  }

  return result;
}
