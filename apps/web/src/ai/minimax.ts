import {
  getLegalMoves,
  isCheck,
  makeMove,
  type GameState,
  type Move,
  type PieceType,
  type Square,
} from '@chess/chess-core';

/**
 * A deliberately small negamax search over `@chess/chess-core`. It exists so the
 * app still has a playable opponent when the WASM engine cannot load, and to
 * prove the `Engine` seam is genuinely swappable. Rules are never duplicated:
 * everything goes through the core API.
 */

const PIECE_VALUES: Record<PieceType, number> = {
  pawn: 100,
  knight: 320,
  bishop: 330,
  rook: 500,
  queen: 900,
  king: 0,
};

const MATE_SCORE = 100_000;

/** The search is intentionally shallow so it stays responsive. */
export const LOCAL_MAX_DEPTH = 3;

export interface LocalSearchResult {
  readonly from: Square;
  readonly to: Square;
  readonly promotion: PieceType | null;
  /** Score in centipawns from White's perspective. */
  readonly score: number;
  readonly depth: number;
  readonly nodes: number;
}

interface Counter {
  nodes: number;
}

function materialBalance(game: GameState): number {
  // Positive means White is better.
  let score = 0;
  for (const piece of game.board) {
    if (piece === null) continue;
    const value = PIECE_VALUES[piece.type];
    score += piece.color === 'white' ? value : -value;
  }
  return score;
}

function negamax(game: GameState, depth: number, alpha: number, beta: number, counter: Counter): number {
  counter.nodes += 1;

  const legal = getLegalMoves(game);
  if (legal.length === 0) {
    // Checkmate loses, stalemate is a draw. Prefer faster mates.
    return isCheck(game) ? -MATE_SCORE - depth : 0;
  }
  if (depth === 0) {
    const sign = game.turn === 'white' ? 1 : -1;
    return sign * materialBalance(game);
  }

  let best = -Infinity;
  let localAlpha = alpha;
  for (const move of legal) {
    const next = makeMove(game, move);
    const score = -negamax(next, depth - 1, -beta, -localAlpha, counter);
    if (score > best) best = score;
    if (best > localAlpha) localAlpha = best;
    if (localAlpha >= beta) break;
  }
  return best;
}

/**
 * Pick a move for the side to move. Ties are broken randomly so the engine
 * does not repeat itself in AI-vs-AI games.
 */
export function searchBestMove(game: GameState, requestedDepth: number): LocalSearchResult | null {
  const legal = getLegalMoves(game);
  if (legal.length === 0) return null;

  const depth = Math.max(1, Math.min(LOCAL_MAX_DEPTH, Math.trunc(requestedDepth)));
  const counter: Counter = { nodes: 0 };

  let bestScore = -Infinity;
  const scored: { move: Move; score: number }[] = [];

  for (const move of legal) {
    const next = makeMove(game, move);
    const score = -negamax(next, depth - 1, -Infinity, Infinity, counter);
    scored.push({ move, score });
    if (score > bestScore) bestScore = score;
  }

  // Random tie-break keeps play varied.
  const best = scored.filter((entry) => entry.score >= bestScore);
  const chosen = best[Math.floor(Math.random() * best.length)];
  if (chosen === undefined) return null;

  return {
    from: chosen.move.from,
    to: chosen.move.to,
    promotion: chosen.move.promotion ?? null,
    score: bestScore,
    depth,
    nodes: counter.nodes,
  };
}
