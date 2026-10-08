/**
 * Standard Algebraic Notation generation.
 */

import {
  EMPTY,
  FLAG_CASTLE_KING,
  FLAG_CASTLE_QUEEN,
  FLAG_EN_PASSANT,
  FLAG_PROMOTION,
  applyMove,
  isCheckmateInternal,
  isInCheck,
  moveFlags,
  moveFrom,
  movePromotion,
  moveTo,
  typeOf,
  undoMove,
  type InternalPosition,
} from './internal';
import type { Color, PieceType, Square } from './types';

const FILE_CHARS = 'abcdefgh';

export function squareName(square: Square): string {
  return `${FILE_CHARS[square & 7]}${(square >>> 3) + 1}`;
}

const TYPE_LETTERS: Record<PieceType, string> = {
  pawn: '',
  knight: 'N',
  bishop: 'B',
  rook: 'R',
  queen: 'Q',
  king: 'K',
};

const PROMO_LETTERS: Record<PieceType, string> = {
  pawn: '',
  knight: 'N',
  bishop: 'B',
  rook: 'R',
  queen: 'Q',
  king: 'K',
};

export function moveToSan(pos: InternalPosition, move: number, legalMoves: readonly number[]): string {
  const flags = moveFlags(move);

  if (flags === FLAG_CASTLE_KING || flags === FLAG_CASTLE_QUEEN) {
    const san = flags === FLAG_CASTLE_KING ? 'O-O' : 'O-O-O';
    return san + checkSuffix(pos, move);
  }

  const from = moveFrom(move);
  const to = moveTo(move);
  const pieceType = typeOf(pos.board[from] as number);
  const isCapture = pos.board[to] !== EMPTY || flags === FLAG_EN_PASSANT;
  const destination = squareName(to);

  let san: string;
  if (pieceType === 'pawn') {
    san = isCapture ? `${FILE_CHARS[from & 7]}x${destination}` : destination;
    if (flags === FLAG_PROMOTION) {
      san += `=${PROMO_LETTERS[typeOf(movePromotion(move))]}`;
    }
  } else {
    san = TYPE_LETTERS[pieceType] + disambiguation(pos, move, legalMoves, pieceType, to);
    if (isCapture) san += 'x';
    san += destination;
  }

  return san + checkSuffix(pos, move);
}

function disambiguation(
  pos: InternalPosition,
  move: number,
  legalMoves: readonly number[],
  pieceType: PieceType,
  to: Square,
): string {
  const from = moveFrom(move);
  const fromFile = from & 7;
  const fromRank = from >>> 3;

  let sameFile = false;
  let sameRank = false;
  let ambiguous = false;

  for (const other of legalMoves) {
    if (other === move) continue;
    if (moveTo(other) !== to) continue;
    const otherFrom = moveFrom(other);
    if (typeOf(pos.board[otherFrom] as number) !== pieceType) continue;
    ambiguous = true;
    if ((otherFrom & 7) === fromFile) sameFile = true;
    if ((otherFrom >>> 3) === fromRank) sameRank = true;
  }

  if (!ambiguous) return '';
  if (!sameFile) return FILE_CHARS[fromFile] as string;
  if (!sameRank) return String(fromRank + 1);
  return `${FILE_CHARS[fromFile]}${fromRank + 1}`;
}

function checkSuffix(pos: InternalPosition, move: number): string {
  const undo = applyMove(pos, move);
  const opponent: Color = pos.turn;
  let suffix = '';
  if (isInCheck(pos, opponent)) {
    suffix = isCheckmateInternal(pos) ? '#' : '+';
  }
  undoMove(pos, move, undo);
  return suffix;
}
