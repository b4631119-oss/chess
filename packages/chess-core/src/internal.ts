/**
 * Internal engine representation.
 *
 * Everything here works on compact numeric codes and a mutable `Uint8Array`
 * board for speed (perft runs tens of millions of nodes). The public,
 * immutable API in `game.ts` converts to and from these structures.
 */

import type { CastleSide, CastlingRights, Color, GameState, Move, Piece, PieceType, Square } from './types';

// ---------------------------------------------------------------------------
// Piece codes (0 = empty, 1..6 = white pawn..king, 7..12 = black pawn..king)
// ---------------------------------------------------------------------------

export const EMPTY = 0;
export const W_PAWN = 1;
export const W_KNIGHT = 2;
export const W_BISHOP = 3;
export const W_ROOK = 4;
export const W_QUEEN = 5;
export const W_KING = 6;
export const B_PAWN = 7;
export const B_KNIGHT = 8;
export const B_BISHOP = 9;
export const B_ROOK = 10;
export const B_QUEEN = 11;
export const B_KING = 12;

export const PIECE_TYPES: readonly PieceType[] = [
  'pawn',
  'knight',
  'bishop',
  'rook',
  'queen',
  'king',
];

/** Code offset `0..5` (pawn..king) -> type. */
export const OFFSET_TO_TYPE: readonly PieceType[] = PIECE_TYPES;

export function colorOf(code: number): Color {
  return code <= W_KING ? 'white' : 'black';
}

export function typeOf(code: number): PieceType {
  return PIECE_TYPES[(code - 1) % 6] as PieceType;
}

/** Absolute code for a color/type pair. */
export function codeOf(color: Color, type: PieceType): number {
  const offset = PIECE_TYPES.indexOf(type) + 1;
  return color === 'white' ? offset : offset + 6;
}

export function isWhitePiece(code: number): boolean {
  return code >= W_PAWN && code <= W_KING;
}

export function isBlackPiece(code: number): boolean {
  return code >= B_PAWN && code <= B_KING;
}

// ---------------------------------------------------------------------------
// Move encoding (packed into a single integer)
//   bits  0-5  : from
//   bits  6-11 : to
//   bits 12-15 : promotion piece code (0 = none)
//   bits 16-18 : flags
// ---------------------------------------------------------------------------

export const FLAG_NORMAL = 0;
export const FLAG_DOUBLE = 1;
export const FLAG_EN_PASSANT = 2;
export const FLAG_CASTLE_KING = 3;
export const FLAG_CASTLE_QUEEN = 4;
export const FLAG_PROMOTION = 5;

export function encodeMove(from: number, to: number, promotion: number, flags: number): number {
  return from | (to << 6) | (promotion << 12) | (flags << 16);
}

export function moveFrom(move: number): Square {
  return move & 0x3f;
}

export function moveTo(move: number): Square {
  return (move >>> 6) & 0x3f;
}

export function movePromotion(move: number): number {
  return (move >>> 12) & 0xf;
}

export function moveFlags(move: number): number {
  return (move >>> 16) & 0x7;
}

export function isPromotionMove(move: number): boolean {
  return moveFlags(move) === FLAG_PROMOTION;
}

// ---------------------------------------------------------------------------
// Precomputed geometry
// ---------------------------------------------------------------------------

const fileOf = (square: number): number => square & 7;
const rankOf = (square: number): number => square >>> 3;
const squareAt = (file: number, rank: number): number => rank * 8 + file;
const onBoard = (file: number, rank: number): boolean =>
  file >= 0 && file < 8 && rank >= 0 && rank < 8;

const KNIGHT_DELTAS: ReadonlyArray<readonly [number, number]> = [
  [1, 2],
  [2, 1],
  [2, -1],
  [1, -2],
  [-1, -2],
  [-2, -1],
  [-2, 1],
  [-1, 2],
];

const KING_DELTAS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
  [0, -1],
  [1, -1],
];

const ROOK_DIRS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

const BISHOP_DIRS: ReadonlyArray<readonly [number, number]> = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

function buildJumpTable(
  deltas: ReadonlyArray<readonly [number, number]>,
): ReadonlyArray<readonly number[]> {
  const table: number[][] = [];
  for (let square = 0; square < 64; square++) {
    const file = fileOf(square);
    const rank = rankOf(square);
    const targets: number[] = [];
    for (const [df, dr] of deltas) {
      const nf = file + df;
      const nr = rank + dr;
      if (onBoard(nf, nr)) targets.push(squareAt(nf, nr));
    }
    table.push(targets);
  }
  return table;
}

function buildRayTable(
  dirs: ReadonlyArray<readonly [number, number]>,
): ReadonlyArray<readonly (readonly number[])[]> {
  const table: (readonly number[])[][] = [];
  for (let square = 0; square < 64; square++) {
    const rays: number[][] = [];
    for (const [df, dr] of dirs) {
      let file = fileOf(square) + df;
      let rank = rankOf(square) + dr;
      const ray: number[] = [];
      while (onBoard(file, rank)) {
        ray.push(squareAt(file, rank));
        file += df;
        rank += dr;
      }
      rays.push(ray);
    }
    table.push(rays);
  }
  return table;
}

export const KNIGHT_ATTACKS = buildJumpTable(KNIGHT_DELTAS);
export const KING_ATTACKS = buildJumpTable(KING_DELTAS);
export const ROOK_RAYS = buildRayTable(ROOK_DIRS);
export const BISHOP_RAYS = buildRayTable(BISHOP_DIRS);

const PAWN_DELTAS_WHITE: ReadonlyArray<readonly [number, number]> = [
  [-1, 1],
  [1, 1],
];
const PAWN_DELTAS_BLACK: ReadonlyArray<readonly [number, number]> = [
  [-1, -1],
  [1, -1],
];

/** Squares attacked *by* a pawn of the given color standing on `square`. */
export const WHITE_PAWN_ATTACKS = buildJumpTable(PAWN_DELTAS_WHITE);
export const BLACK_PAWN_ATTACKS = buildJumpTable(PAWN_DELTAS_BLACK);

function invertAttacks(
  attacks: ReadonlyArray<readonly number[]>,
): ReadonlyArray<readonly number[]> {
  const inverted: number[][] = Array.from({ length: 64 }, () => []);
  for (let square = 0; square < 64; square++) {
    for (const target of attacks[square] as readonly number[]) {
      inverted[target]!.push(square);
    }
  }
  return inverted;
}

/** Squares from which a white pawn attacks the given square. */
export const WHITE_PAWN_ATTACKERS = invertAttacks(WHITE_PAWN_ATTACKS);
/** Squares from which a black pawn attacks the given square. */
export const BLACK_PAWN_ATTACKERS = invertAttacks(BLACK_PAWN_ATTACKS);

// ---------------------------------------------------------------------------
// Position
// ---------------------------------------------------------------------------

export interface InternalPosition {
  board: Uint8Array;
  turn: Color;
  castling: CastlingRights;
  enPassant: Square | null;
  halfmove: number;
  fullmove: number;
  whiteKing: Square;
  blackKing: Square;
}

/** Convert an immutable public state into the mutable engine representation. */
export function toInternal(state: GameState): InternalPosition {
  const board = new Uint8Array(64);
  let whiteKing = -1;
  let blackKing = -1;

  for (let square = 0; square < 64; square++) {
    const piece = state.board[square] ?? null;
    if (piece === null) continue;
    const code = codeOf(piece.color, piece.type);
    board[square] = code;
    if (code === W_KING) whiteKing = square;
    else if (code === B_KING) blackKing = square;
  }

  if (whiteKing < 0 || blackKing < 0) {
    throw new Error('Position requires exactly one king per side');
  }

  return {
    board,
    turn: state.turn,
    castling: cloneCastlingRights(state.castling),
    enPassant: state.enPassant,
    halfmove: state.halfmoveClock,
    fullmove: state.fullmoveNumber,
    whiteKing,
    blackKing,
  };
}

/** Convert the mutable engine representation back into an immutable state. */
export function fromInternal(
  pos: InternalPosition,
  history: ReadonlyArray<Move>,
  repetitions: Readonly<Record<string, number>>,
): GameState {
  const board: (Piece | null)[] = new Array<Piece | null>(64).fill(null);
  for (let square = 0; square < 64; square++) {
    const code = pos.board[square] as number;
    if (code === EMPTY) continue;
    board[square] = { type: typeOf(code), color: colorOf(code) };
  }

  return {
    board,
    turn: pos.turn,
    castling: cloneCastlingRights(pos.castling),
    enPassant: pos.enPassant,
    halfmoveClock: pos.halfmove,
    fullmoveNumber: pos.fullmove,
    history,
    repetitions,
  };
}

export function emptyCastlingRights(): CastlingRights {
  return {
    whiteKingSide: false,
    whiteQueenSide: false,
    blackKingSide: false,
    blackQueenSide: false,
  };
}

export function cloneCastlingRights(rights: CastlingRights): CastlingRights {
  return {
    whiteKingSide: rights.whiteKingSide,
    whiteQueenSide: rights.whiteQueenSide,
    blackKingSide: rights.blackKingSide,
    blackQueenSide: rights.blackQueenSide,
  };
}

// ---------------------------------------------------------------------------
// Attack detection
// ---------------------------------------------------------------------------

export function isSquareAttacked(board: Uint8Array, square: Square, byWhite: boolean): boolean {
  const pawn = byWhite ? W_PAWN : B_PAWN;
  const pawnAttackers = byWhite ? WHITE_PAWN_ATTACKERS[square] : BLACK_PAWN_ATTACKERS[square];
  for (const attacker of pawnAttackers as readonly number[]) {
    if (board[attacker] === pawn) return true;
  }

  const knight = byWhite ? W_KNIGHT : B_KNIGHT;
  for (const target of KNIGHT_ATTACKS[square] as readonly number[]) {
    if (board[target] === knight) return true;
  }

  const king = byWhite ? W_KING : B_KING;
  for (const target of KING_ATTACKS[square] as readonly number[]) {
    if (board[target] === king) return true;
  }

  const rook = byWhite ? W_ROOK : B_ROOK;
  const bishop = byWhite ? W_BISHOP : B_BISHOP;
  const queen = byWhite ? W_QUEEN : B_QUEEN;

  for (const ray of ROOK_RAYS[square] as readonly (readonly number[])[]) {
    for (const target of ray) {
      const code = board[target];
      if (code !== EMPTY) {
        if (code === rook || code === queen) return true;
        break;
      }
    }
  }

  for (const ray of BISHOP_RAYS[square] as readonly (readonly number[])[]) {
    for (const target of ray) {
      const code = board[target];
      if (code !== EMPTY) {
        if (code === bishop || code === queen) return true;
        break;
      }
    }
  }

  return false;
}

export function isInCheck(pos: InternalPosition, color: Color): boolean {
  const kingSquare = color === 'white' ? pos.whiteKing : pos.blackKing;
  return isSquareAttacked(pos.board, kingSquare, color === 'black');
}

// ---------------------------------------------------------------------------
// Pseudo-legal move generation
// ---------------------------------------------------------------------------

function addPromotions(moves: number[], from: number, to: number, white: boolean): void {
  const base = white ? W_KNIGHT : B_KNIGHT;
  for (let offset = 0; offset < 4; offset++) {
    moves.push(encodeMove(from, to, base + offset, FLAG_PROMOTION));
  }
}

function pushPawnMove(
  moves: number[],
  from: number,
  to: number,
  white: boolean,
  flags: number,
): void {
  const promotionRank = white ? 7 : 0;
  if (rankOf(to) === promotionRank) {
    addPromotions(moves, from, to, white);
  } else {
    moves.push(encodeMove(from, to, 0, flags));
  }
}

function generatePawnMoves(moves: number[], pos: InternalPosition, from: number): void {
  const white = pos.turn === 'white';
  const board = pos.board;
  const dir = white ? 8 : -8;
  const startRank = white ? 1 : 6;
  const one = from + dir;

  if (one >= 0 && one < 64 && board[one] === EMPTY) {
    pushPawnMove(moves, from, one, white, FLAG_NORMAL);
    const two = from + 2 * dir;
    if (rankOf(from) === startRank && board[two] === EMPTY) {
      moves.push(encodeMove(from, two, 0, FLAG_DOUBLE));
    }
  }

  const captureTargets = white ? WHITE_PAWN_ATTACKS[from] : BLACK_PAWN_ATTACKS[from];
  for (const to of captureTargets) {
    const target = board[to];
    if (target !== EMPTY && colorOf(target) !== pos.turn) {
      pushPawnMove(moves, from, to, white, FLAG_NORMAL);
    } else if (target === EMPTY && to === pos.enPassant) {
      moves.push(encodeMove(from, to, 0, FLAG_EN_PASSANT));
    }
  }
}

function generateSlidingMoves(
  moves: number[],
  board: Uint8Array,
  turn: Color,
  from: number,
  rays: ReadonlyArray<readonly number[]>,
): void {
  for (const ray of rays) {
    for (const to of ray) {
      const target = board[to];
      if (target === EMPTY) {
        moves.push(encodeMove(from, to, 0, FLAG_NORMAL));
      } else {
        if (colorOf(target) !== turn) {
          moves.push(encodeMove(from, to, 0, FLAG_NORMAL));
        }
        break;
      }
    }
  }
}

function generateStepMoves(
  moves: number[],
  board: Uint8Array,
  turn: Color,
  from: number,
  targets: readonly number[],
): void {
  for (const to of targets) {
    const target = board[to];
    if (target === EMPTY || colorOf(target) !== turn) {
      moves.push(encodeMove(from, to, 0, FLAG_NORMAL));
    }
  }
}

function generateCastlingForSquare(moves: number[], pos: InternalPosition, from: number): void {
  const white = pos.turn === 'white';
  const board = pos.board;
  const king = white ? W_KING : B_KING;
  const rook = white ? W_ROOK : B_ROOK;

  if (from !== (white ? 4 : 60) || board[from] !== king) return;
  if (isInCheck(pos, pos.turn)) return;

  const kingSide = white ? pos.castling.whiteKingSide : pos.castling.blackKingSide;
  const queenSide = white ? pos.castling.whiteQueenSide : pos.castling.blackQueenSide;
  const homeRank = white ? 0 : 7;
  const back = homeRank * 8;

  if (kingSide && board[back + 7] === rook) {
    if (
      board[back + 5] === EMPTY &&
      board[back + 6] === EMPTY &&
      !isSquareAttacked(board, back + 5, !white) &&
      !isSquareAttacked(board, back + 6, !white)
    ) {
      moves.push(encodeMove(from, back + 6, 0, FLAG_CASTLE_KING));
    }
  }

  if (queenSide && board[back] === rook) {
    if (
      board[back + 1] === EMPTY &&
      board[back + 2] === EMPTY &&
      board[back + 3] === EMPTY &&
      !isSquareAttacked(board, back + 2, !white) &&
      !isSquareAttacked(board, back + 3, !white)
    ) {
      moves.push(encodeMove(from, back + 2, 0, FLAG_CASTLE_QUEEN));
    }
  }
}

export function generatePseudoLegalMoves(pos: InternalPosition, onlyFrom?: Square): number[] {
  const moves: number[] = [];
  const { board, turn } = pos;

  const start = onlyFrom === undefined ? 0 : onlyFrom;
  const end = onlyFrom === undefined ? 63 : onlyFrom;

  for (let from = start; from <= end; from++) {
    const code = board[from];
    if (code === EMPTY) continue;
    if (colorOf(code) !== turn) continue;

    switch (code) {
      case W_PAWN:
      case B_PAWN:
        generatePawnMoves(moves, pos, from);
        break;
      case W_KNIGHT:
      case B_KNIGHT:
        generateStepMoves(moves, board, turn, from, KNIGHT_ATTACKS[from]);
        break;
      case W_BISHOP:
      case B_BISHOP:
        generateSlidingMoves(moves, board, turn, from, BISHOP_RAYS[from]);
        break;
      case W_ROOK:
      case B_ROOK:
        generateSlidingMoves(moves, board, turn, from, ROOK_RAYS[from]);
        break;
      case W_QUEEN:
      case B_QUEEN:
        generateSlidingMoves(moves, board, turn, from, ROOK_RAYS[from]);
        generateSlidingMoves(moves, board, turn, from, BISHOP_RAYS[from]);
        break;
      case W_KING:
      case B_KING:
        generateStepMoves(moves, board, turn, from, KING_ATTACKS[from]);
        generateCastlingForSquare(moves, pos, from);
        break;
      default:
        break;
    }
  }

  return moves;
}

// ---------------------------------------------------------------------------
// Apply / undo
// ---------------------------------------------------------------------------

export interface Undo {
  captured: number;
  capturedSquare: Square;
  castling: CastlingRights;
  enPassant: Square | null;
  halfmove: number;
  fullmove: number;
}

export function applyMove(pos: InternalPosition, move: number): Undo {
  const from = moveFrom(move);
  const to = moveTo(move);
  const flags = moveFlags(move);
  const promotion = movePromotion(move);
  const piece = pos.board[from] as number;
  const movingColor = pos.turn;

  const undo: Undo = {
    captured: pos.board[to] as number,
    capturedSquare: to,
    castling: cloneCastlingRights(pos.castling),
    enPassant: pos.enPassant,
    halfmove: pos.halfmove,
    fullmove: pos.fullmove,
  };

  pos.board[from] = EMPTY;
  pos.board[to] = flags === FLAG_PROMOTION ? promotion : piece;

  if (piece === W_KING) pos.whiteKing = to;
  else if (piece === B_KING) pos.blackKing = to;

  if (flags === FLAG_EN_PASSANT) {
    const capturedSquare = movingColor === 'white' ? to - 8 : to + 8;
    undo.captured = pos.board[capturedSquare] as number;
    undo.capturedSquare = capturedSquare;
    pos.board[capturedSquare] = EMPTY;
  }

  if (flags === FLAG_CASTLE_KING) {
    const back = movingColor === 'white' ? 0 : 56;
    pos.board[back + 7] = EMPTY;
    pos.board[back + 5] = movingColor === 'white' ? W_ROOK : B_ROOK;
  } else if (flags === FLAG_CASTLE_QUEEN) {
    const back = movingColor === 'white' ? 0 : 56;
    pos.board[back] = EMPTY;
    pos.board[back + 3] = movingColor === 'white' ? W_ROOK : B_ROOK;
  }

  // Castling rights are lost when a king moves or a rook moves/falls.
  if (piece === W_KING) {
    pos.castling.whiteKingSide = false;
    pos.castling.whiteQueenSide = false;
  } else if (piece === B_KING) {
    pos.castling.blackKingSide = false;
    pos.castling.blackQueenSide = false;
  }
  loseRookRights(pos.castling, from);
  loseRookRights(pos.castling, to);

  pos.enPassant = flags === FLAG_DOUBLE ? (movingColor === 'white' ? from + 8 : from - 8) : null;

  if (piece === W_PAWN || piece === B_PAWN || undo.captured !== EMPTY) {
    pos.halfmove = 0;
  } else {
    pos.halfmove += 1;
  }
  if (movingColor === 'black') pos.fullmove += 1;

  pos.turn = movingColor === 'white' ? 'black' : 'white';

  return undo;
}

function loseRookRights(rights: CastlingRights, square: Square): void {
  switch (square) {
    case 0:
      rights.whiteQueenSide = false;
      break;
    case 7:
      rights.whiteKingSide = false;
      break;
    case 56:
      rights.blackQueenSide = false;
      break;
    case 63:
      rights.blackKingSide = false;
      break;
    default:
      break;
  }
}

export function undoMove(pos: InternalPosition, move: number, undo: Undo): void {
  const from = moveFrom(move);
  const to = moveTo(move);
  const flags = moveFlags(move);
  const movingColor = pos.turn === 'white' ? 'black' : 'white';

  const piece =
    flags === FLAG_PROMOTION ? (movingColor === 'white' ? W_PAWN : B_PAWN) : (pos.board[to] as number);

  pos.turn = movingColor;
  pos.board[from] = piece;
  pos.board[to] = EMPTY;
  pos.board[undo.capturedSquare] = undo.captured;

  if (flags === FLAG_CASTLE_KING) {
    const back = movingColor === 'white' ? 0 : 56;
    pos.board[back + 5] = EMPTY;
    pos.board[back + 7] = movingColor === 'white' ? W_ROOK : B_ROOK;
  } else if (flags === FLAG_CASTLE_QUEEN) {
    const back = movingColor === 'white' ? 0 : 56;
    pos.board[back + 3] = EMPTY;
    pos.board[back] = movingColor === 'white' ? W_ROOK : B_ROOK;
  }

  if (piece === W_KING) pos.whiteKing = from;
  else if (piece === B_KING) pos.blackKing = from;

  pos.castling = undo.castling;
  pos.enPassant = undo.enPassant;
  pos.halfmove = undo.halfmove;
  pos.fullmove = undo.fullmove;
}

// ---------------------------------------------------------------------------
// Legal move generation
// ---------------------------------------------------------------------------

export function isLegalMove(pos: InternalPosition, move: number): boolean {
  const undo = applyMove(pos, move);
  const legal = !isInCheck(pos, pos.turn === 'white' ? 'black' : 'white');
  undoMove(pos, move, undo);
  return legal;
}

export function generateLegalMoves(pos: InternalPosition, onlyFrom?: Square): number[] {
  const pseudo = generatePseudoLegalMoves(pos, onlyFrom);
  const legal: number[] = [];
  for (const move of pseudo) {
    const undo = applyMove(pos, move);
    const sideToVerify = pos.turn === 'white' ? 'black' : 'white';
    if (!isInCheck(pos, sideToVerify)) legal.push(move);
    undoMove(pos, move, undo);
  }
  return legal;
}

// ---------------------------------------------------------------------------
// Rule predicates (operate on a position whose turn is the side to move)
// ---------------------------------------------------------------------------

export function hasLegalMoves(pos: InternalPosition): boolean {
  const pseudo = generatePseudoLegalMoves(pos);
  for (const move of pseudo) {
    const undo = applyMove(pos, move);
    const sideToVerify = pos.turn === 'white' ? 'black' : 'white';
    const legal = !isInCheck(pos, sideToVerify);
    undoMove(pos, move, undo);
    if (legal) return true;
  }
  return false;
}

export function isCheckmateInternal(pos: InternalPosition): boolean {
  return isInCheck(pos, pos.turn) && !hasLegalMoves(pos);
}

export function isStalemateInternal(pos: InternalPosition): boolean {
  return !isInCheck(pos, pos.turn) && !hasLegalMoves(pos);
}

export function isInsufficientMaterial(board: Uint8Array): boolean {
  const minorByColor: Record<Color, PieceType[]> = { white: [], black: [] };
  for (let square = 0; square < 64; square++) {
    const code = board[square] as number;
    if (code === EMPTY || code === W_KING || code === B_KING) continue;
    const type = typeOf(code);
    if (type === 'pawn' || type === 'rook' || type === 'queen') return false;
    const color = colorOf(code);
    const list = minorByColor[color];
    if (list.length >= 2) return false;
    list.push(type);
  }

  const whiteMinor = minorByColor.white;
  const blackMinor = minorByColor.black;
  const total = whiteMinor.length + blackMinor.length;

  if (total === 0) return true; // K vs K
  if (total === 1) return true; // K+minor vs K

  // Exactly two minor pieces: only K+B vs K+B with bishops on the same color.
  if (whiteMinor.length === 1 && blackMinor.length === 1) {
    const whiteBishopSquare = findFirstBishopSquare(board, 'white');
    const blackBishopSquare = findFirstBishopSquare(board, 'black');
    if (whiteBishopSquare === null || blackBishopSquare === null) return false;
    const whiteSquareColor = (fileOf(whiteBishopSquare) + rankOf(whiteBishopSquare)) % 2;
    const blackSquareColor = (fileOf(blackBishopSquare) + rankOf(blackBishopSquare)) % 2;
    return whiteSquareColor === blackSquareColor;
  }

  return false;
}

function findFirstBishopSquare(board: Uint8Array, color: Color): Square | null {
  const bishop = color === 'white' ? W_BISHOP : B_BISHOP;
  for (let square = 0; square < 64; square++) {
    if (board[square] === bishop) return square;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Castling move origin helpers (used by the reducer for UI hints)
// ---------------------------------------------------------------------------

export function castleRookFrom(pos: InternalPosition, move: number): Square | null {
  const flags = moveFlags(move);
  if (flags !== FLAG_CASTLE_KING && flags !== FLAG_CASTLE_QUEEN) return null;
  const white = pos.turn === 'white' || moveFrom(move) === 4;
  const back = white ? 0 : 56;
  return flags === FLAG_CASTLE_KING ? back + 7 : back;
}

export function castleSideOf(move: number): CastleSide | null {
  const flags = moveFlags(move);
  if (flags === FLAG_CASTLE_KING) return 'king';
  if (flags === FLAG_CASTLE_QUEEN) return 'queen';
  return null;
}
