/**
 * Public type vocabulary of the chess engine.
 *
 * Coordinates: a square is a number `0..63` where `0` is `a1` and `63` is
 * `h8`. File and rank are derived with `square & 7` and `square >> 3`.
 */

export type Color = 'white' | 'black';

export type PieceType = 'pawn' | 'knight' | 'bishop' | 'rook' | 'queen' | 'king';

/** Index of a square on the board (`0` = a1, `63` = h8). */
export type Square = number;

export interface Piece {
  readonly type: PieceType;
  readonly color: Color;
}

/** 64-squared board, index `0` is `a1`. Empty squares are `null`. */
export type Board = ReadonlyArray<Piece | null>;

/**
 * Castling availability. Fields are mutable so the engine can update rights
 * in place; `GameState.castling` is still only ever replaced immutably.
 */
export interface CastlingRights {
  whiteKingSide: boolean;
  whiteQueenSide: boolean;
  blackKingSide: boolean;
  blackQueenSide: boolean;
}

export type CastleSide = 'king' | 'queen';

export interface Move {
  readonly from: Square;
  readonly to: Square;
  /** The moving piece type (always a pawn for promotions). */
  readonly piece: PieceType;
  readonly color: Color;
  /** The captured piece type, or `null` when the move is quiet. */
  readonly captured: PieceType | null;
  /** Promoted-to piece type, or `null`. */
  readonly promotion: PieceType | null;
  readonly isEnPassant: boolean;
  readonly isCastle: CastleSide | null;
  readonly isDoublePush: boolean;
  /** Standard Algebraic Notation, generated against the pre-move position. */
  readonly san: string;
}

export type GameStatus = 'ongoing' | 'check' | 'checkmate' | 'stalemate' | 'draw';

export type DrawReason = 'fifty-move' | 'threefold-repetition' | 'insufficient-material';

export interface GameState {
  readonly board: Board;
  readonly turn: Color;
  readonly castling: CastlingRights;
  /** Target square for an en-passant capture, or `null`. */
  readonly enPassant: Square | null;
  readonly halfmoveClock: number;
  readonly fullmoveNumber: number;
  readonly history: ReadonlyArray<Move>;
  /** Position-key -> occurrence count, used for the threefold-repetition rule. */
  readonly repetitions: Readonly<Record<string, number>>;
}
