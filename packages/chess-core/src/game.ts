/**
 * Public, immutable game API.
 *
 * All functions are pure: they never mutate the `GameState` they receive and
 * return fresh state objects, which makes them ideal arguments to a reducer.
 */

import { INITIAL_FEN, loadFen, positionKey } from './fen';
import {
  EMPTY,
  FLAG_CASTLE_KING,
  FLAG_CASTLE_QUEEN,
  FLAG_DOUBLE,
  FLAG_EN_PASSANT,
  FLAG_PROMOTION,
  applyMove,
  fromInternal,
  generateLegalMoves,
  hasLegalMoves,
  isCheckmateInternal,
  isInCheck,
  isInsufficientMaterial,
  isStalemateInternal,
  moveFlags,
  moveFrom,
  movePromotion,
  moveTo,
  toInternal,
  typeOf,
  type InternalPosition,
} from './internal';
import { moveToSan } from './san';
import type { DrawReason, GameState, GameStatus, Move, PieceType, Square } from './types';

export interface MoveInput {
  readonly from: Square;
  readonly to: Square;
  readonly promotion?: PieceType | null;
}

/** Create a fresh game, optionally from a FEN string. */
export function createGame(fen: string = INITIAL_FEN): GameState {
  return loadFen(fen);
}

function toPublicMove(pos: InternalPosition, move: number, legalMoves: readonly number[]): Move {
  const from = moveFrom(move);
  const to = moveTo(move);
  const flags = moveFlags(move);
  const pieceCode = pos.board[from] as number;

  let capturedCode = pos.board[to] as number;
  if (flags === FLAG_EN_PASSANT) {
    capturedCode = pos.turn === 'white' ? 7 : 1; // black pawn / white pawn
  }

  const isCastle =
    flags === FLAG_CASTLE_KING ? 'king' : flags === FLAG_CASTLE_QUEEN ? 'queen' : null;

  return {
    from,
    to,
    piece: typeOf(pieceCode),
    color: pos.turn,
    captured: capturedCode === EMPTY ? null : typeOf(capturedCode),
    promotion: flags === FLAG_PROMOTION ? typeOf(movePromotion(move)) : null,
    isEnPassant: flags === FLAG_EN_PASSANT,
    isCastle,
    isDoublePush: flags === FLAG_DOUBLE,
    san: moveToSan(pos, move, legalMoves),
  };
}

/**
 * All legal moves in the position. Pass `square` to restrict the result to
 * moves originating from that square.
 */
export function getLegalMoves(state: GameState, square?: Square): Move[] {
  const pos = toInternal(state);
  const internal = generateLegalMoves(pos, square);
  return internal.map((move) => toPublicMove(pos, move, internal));
}

function findInternalMove(
  legalMoves: readonly number[],
  input: MoveInput,
): number | undefined {
  const promotion = input.promotion ?? null;
  for (const move of legalMoves) {
    if (moveFrom(move) !== input.from || moveTo(move) !== input.to) continue;
    if (moveFlags(move) === FLAG_PROMOTION) {
      if (promotion !== null && typeOf(movePromotion(move)) === promotion) return move;
    } else if (promotion === null) {
      return move;
    }
  }
  return undefined;
}

/**
 * Apply a legal move and return the next state. Throws when the move is not
 * legal in the current position.
 */
export function makeMove(state: GameState, input: Move | MoveInput): GameState {
  const pos = toInternal(state);
  const legalMoves = generateLegalMoves(pos);
  const internalMove = findInternalMove(legalMoves, input);
  if (internalMove === undefined) {
    throw new Error(
      `Illegal move: ${JSON.stringify({ from: input.from, to: input.to, promotion: input.promotion ?? null })}`,
    );
  }

  const publicMove = toPublicMove(pos, internalMove, legalMoves);
  applyMove(pos, internalMove);

  const history = [...state.history, publicMove];
  const next = fromInternal(pos, history, state.repetitions);
  const key = positionKey(next);
  const count = (state.repetitions[key] ?? 0) + 1;

  return { ...next, repetitions: { ...state.repetitions, [key]: count } };
}

/** Look up a legal move by squares (and promotion) without applying it. */
export function findMove(state: GameState, input: MoveInput): Move | null {
  const pos = toInternal(state);
  const legalMoves = generateLegalMoves(pos);
  const internalMove = findInternalMove(legalMoves, input);
  if (internalMove === undefined) return null;
  return toPublicMove(pos, internalMove, legalMoves);
}

export function isCheck(state: GameState): boolean {
  const pos = toInternal(state);
  return isInCheck(pos, state.turn);
}

export function hasAnyLegalMove(state: GameState): boolean {
  return hasLegalMoves(toInternal(state));
}

export function isCheckmate(state: GameState): boolean {
  return isCheckmateInternal(toInternal(state));
}

export function isStalemate(state: GameState): boolean {
  return isStalemateInternal(toInternal(state));
}

export function isInsufficientMaterialState(state: GameState): boolean {
  return isInsufficientMaterial(toInternal(state).board);
}

export function isFiftyMoveRule(state: GameState): boolean {
  return state.halfmoveClock >= 100;
}

export function isThreefoldRepetition(state: GameState): boolean {
  return (state.repetitions[positionKey(state)] ?? 0) >= 3;
}

export function getDrawReason(state: GameState): DrawReason | null {
  if (isFiftyMoveRule(state)) return 'fifty-move';
  if (isThreefoldRepetition(state)) return 'threefold-repetition';
  if (isInsufficientMaterialState(state)) return 'insufficient-material';
  return null;
}

export function isDraw(state: GameState): boolean {
  return getDrawReason(state) !== null;
}

export function isGameOver(state: GameState): boolean {
  return isCheckmate(state) || isStalemate(state) || isDraw(state);
}

export function getGameStatus(state: GameState): GameStatus {
  if (isCheckmate(state)) return 'checkmate';
  if (isStalemate(state)) return 'stalemate';
  if (isDraw(state)) return 'draw';
  if (isCheck(state)) return 'check';
  return 'ongoing';
}
