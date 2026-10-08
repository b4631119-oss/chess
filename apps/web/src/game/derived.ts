import type { Color, GameState, PieceType, Square } from '@chess/chess-core';

export interface CapturedPiece {
  /** History index of the capturing move — unique key for rendering. */
  readonly id: number;
  readonly type: PieceType;
  readonly color: Color;
}

/** Squares in render order: rank 8 first (top), file a first (left). */
export const BOARD_SQUARES: readonly Square[] = Array.from({ length: 64 }, (_, index) => {
  const rank = 7 - Math.floor(index / 8);
  const file = index % 8;
  return rank * 8 + file;
});

/**
 * Square colour as CSS class. Matches the original board: `black` squares are
 * the light-blue ones (a1, ...) and `white` squares the tan ones (a8, ...).
 */
export function squareColorClass(square: Square): 'white' | 'black' {
  const file = square & 7;
  const rank = square >>> 3;
  return (file + rank) % 2 === 1 ? 'white' : 'black';
}

export function capturedPieces(game: GameState): {
  white: CapturedPiece[];
  black: CapturedPiece[];
} {
  const white: CapturedPiece[] = [];
  const black: CapturedPiece[] = [];

  game.history.forEach((move, index) => {
    if (move.captured === null) return;
    const color: Color = move.color === 'white' ? 'black' : 'white';
    const entry: CapturedPiece = { id: index, type: move.captured, color };
    if (color === 'white') white.push(entry);
    else black.push(entry);
  });

  return { white, black };
}
