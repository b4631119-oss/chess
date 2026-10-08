import type { Color, Piece, PieceType } from '@chess/chess-core';
import blackBishop from '../assets/black-bishop.png';
import blackKing from '../assets/black-king.png';
import blackKnight from '../assets/black-knight.png';
import blackPawn from '../assets/black-pawn.png';
import blackQueen from '../assets/black-queen.png';
import blackRook from '../assets/black-rook.png';
import whiteBishop from '../assets/white-bishop.png';
import whiteKing from '../assets/white-king.png';
import whiteKnight from '../assets/white-knight.png';
import whitePawn from '../assets/white-pawn.png';
import whiteQueen from '../assets/white-queen.png';
import whiteRook from '../assets/white-rook.png';

const IMAGES: Record<Color, Record<PieceType, string>> = {
  white: {
    pawn: whitePawn,
    knight: whiteKnight,
    bishop: whiteBishop,
    rook: whiteRook,
    queen: whiteQueen,
    king: whiteKing,
  },
  black: {
    pawn: blackPawn,
    knight: blackKnight,
    bishop: blackBishop,
    rook: blackRook,
    queen: blackQueen,
    king: blackKing,
  },
};

export function pieceImage(piece: Piece): string {
  return IMAGES[piece.color][piece.type];
}

export function pieceImageFor(color: Color, type: PieceType): string {
  return IMAGES[color][type];
}

export const PIECE_NAMES: Record<PieceType, string> = {
  pawn: 'Пешка',
  knight: 'Конь',
  bishop: 'Слон',
  rook: 'Ладья',
  queen: 'Ферзь',
  king: 'Король',
};
