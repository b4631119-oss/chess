/**
 * Forsyth-Edwards Notation (FEN) support.
 */

import { emptyCastlingRights } from './internal';
import { squareName } from './san';
import type { Board, CastlingRights, Color, GameState, Piece, PieceType, Square } from './types';

export const INITIAL_FEN =
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const CHAR_TO_TYPE: Readonly<Record<string, PieceType>> = {
  p: 'pawn',
  n: 'knight',
  b: 'bishop',
  r: 'rook',
  q: 'queen',
  k: 'king',
};

const TYPE_TO_CHAR: Readonly<Record<PieceType, string>> = {
  pawn: 'p',
  knight: 'n',
  bishop: 'b',
  rook: 'r',
  queen: 'q',
  king: 'k',
};

function encodePlacement(board: Board): string {
  const rows: string[] = [];
  for (let rank = 7; rank >= 0; rank--) {
    let row = '';
    let empty = 0;
    for (let file = 0; file < 8; file++) {
      const piece = board[rank * 8 + file] ?? null;
      if (piece === null) {
        empty++;
        continue;
      }
      if (empty > 0) {
        row += String(empty);
        empty = 0;
      }
      const letter = TYPE_TO_CHAR[piece.type];
      row += piece.color === 'white' ? letter.toUpperCase() : letter;
    }
    if (empty > 0) row += String(empty);
    rows.push(row);
  }
  return rows.join('/');
}

function castlingToString(rights: CastlingRights): string {
  let value = '';
  if (rights.whiteKingSide) value += 'K';
  if (rights.whiteQueenSide) value += 'Q';
  if (rights.blackKingSide) value += 'k';
  if (rights.blackQueenSide) value += 'q';
  return value === '' ? '-' : value;
}

export function getFen(state: GameState): string {
  const placement = encodePlacement(state.board);
  const turn = state.turn === 'white' ? 'w' : 'b';
  const castling = castlingToString(state.castling);
  const enPassant = state.enPassant === null ? '-' : squareName(state.enPassant);
  return `${placement} ${turn} ${castling} ${enPassant} ${state.halfmoveClock} ${state.fullmoveNumber}`;
}

/** Key used to detect threefold repetition (FEN without the move counters). */
export function positionKey(state: Pick<GameState, 'board' | 'turn' | 'castling' | 'enPassant'>): string {
  const placement = encodePlacement(state.board);
  const turn = state.turn === 'white' ? 'w' : 'b';
  const castling = castlingToString(state.castling);
  const enPassant = state.enPassant === null ? '-' : squareName(state.enPassant);
  return `${placement} ${turn} ${castling} ${enPassant}`;
}

function parsePlacement(placement: string): Board {
  const ranks = placement.split('/');
  if (ranks.length !== 8) {
    throw new Error(`Invalid FEN: expected 8 ranks, got ${ranks.length}`);
  }
  const board: (Piece | null)[] = new Array<Piece | null>(64).fill(null);

  for (let index = 0; index < 8; index++) {
    const rank = 7 - index;
    const row = ranks[index] as string;
    let file = 0;
    for (const char of row) {
      if (char >= '1' && char <= '8') {
        file += Number(char);
        continue;
      }
      const type = CHAR_TO_TYPE[char.toLowerCase()];
      if (type === undefined) {
        throw new Error(`Invalid FEN: unexpected character "${char}"`);
      }
      if (file > 7) {
        throw new Error(`Invalid FEN: rank ${rank + 1} overflows`);
      }
      const color: Color = char === char.toUpperCase() ? 'white' : 'black';
      board[rank * 8 + file] = { type, color };
      file++;
    }
    if (file !== 8) {
      throw new Error(`Invalid FEN: rank ${rank + 1} has ${file} squares instead of 8`);
    }
  }

  return board;
}

function parseCastling(field: string): CastlingRights {
  const rights = emptyCastlingRights();
  if (field === '-') return rights;
  for (const char of field) {
    switch (char) {
      case 'K':
        rights.whiteKingSide = true;
        break;
      case 'Q':
        rights.whiteQueenSide = true;
        break;
      case 'k':
        rights.blackKingSide = true;
        break;
      case 'q':
        rights.blackQueenSide = true;
        break;
      default:
        throw new Error(`Invalid FEN: unexpected castling flag "${char}"`);
    }
  }
  return rights;
}

function parseSquare(name: string): Square {
  const file = 'abcdefgh'.indexOf(name[0] ?? '');
  const rank = Number(name[1]) - 1;
  if (file < 0 || rank < 0 || rank > 7 || name.length !== 2) {
    throw new Error(`Invalid FEN: bad en-passant square "${name}"`);
  }
  return rank * 8 + file;
}

export function loadFen(fen: string): GameState {
  if (typeof fen !== 'string') throw new TypeError('FEN must be a string');
  const parts = fen.trim().split(/\s+/);
  if (parts.length < 2) {
    throw new Error(`Invalid FEN: "${fen}"`);
  }

  const placement = parts[0] as string;
  const turnField = parts[1] as string;
  const castlingField = parts[2] ?? '-';
  const enPassantField = parts[3] ?? '-';
  const halfmoveField = parts[4] ?? '0';
  const fullmoveField = parts[5] ?? '1';

  if (turnField !== 'w' && turnField !== 'b') {
    throw new Error(`Invalid FEN: bad side to move "${turnField}"`);
  }

  const board = parsePlacement(placement);
  const turn: Color = turnField === 'w' ? 'white' : 'black';
  const castling = parseCastling(castlingField);
  const enPassant = enPassantField === '-' ? null : parseSquare(enPassantField);
  const halfmoveClock = Number(halfmoveField);
  const fullmoveNumber = Number(fullmoveField);

  if (!Number.isInteger(halfmoveClock) || halfmoveClock < 0) {
    throw new Error(`Invalid FEN: bad halfmove clock "${halfmoveField}"`);
  }
  if (!Number.isInteger(fullmoveNumber) || fullmoveNumber < 1) {
    throw new Error(`Invalid FEN: bad fullmove number "${fullmoveField}"`);
  }

  let whiteKings = 0;
  let blackKings = 0;
  for (const piece of board) {
    if (piece?.type !== 'king') continue;
    if (piece.color === 'white') whiteKings++;
    else blackKings++;
  }
  if (whiteKings !== 1 || blackKings !== 1) {
    throw new Error('Invalid FEN: exactly one king per side is required');
  }

  const state: GameState = {
    board,
    turn,
    castling,
    enPassant,
    halfmoveClock,
    fullmoveNumber,
    history: [],
    repetitions: {},
  };

  return { ...state, repetitions: { [positionKey(state)]: 1 } };
}
