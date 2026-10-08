/**
 * @chess/chess-core — a framework-agnostic chess engine.
 *
 * Pure TypeScript: no React, no DOM, no I/O. Consumed by the web app (and any
 * other client) through the immutable API below.
 */

export type {
  Board,
  CastleSide,
  CastlingRights,
  Color,
  DrawReason,
  GameState,
  GameStatus,
  Move,
  Piece,
  PieceType,
  Square,
} from './types';

export {
  createGame,
  findMove,
  getDrawReason,
  getGameStatus,
  getLegalMoves,
  hasAnyLegalMove,
  isCheck,
  isCheckmate,
  isDraw,
  isFiftyMoveRule,
  isGameOver,
  isInsufficientMaterialState,
  isStalemate,
  isThreefoldRepetition,
  makeMove,
  type MoveInput,
} from './game';

export { getFen, INITIAL_FEN, loadFen, positionKey } from './fen';
export { getPgn, loadPgn } from './pgn';
export { perft, perftDivide } from './perft';
export { squareName } from './san';
