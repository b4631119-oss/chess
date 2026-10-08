import { squareName, type Color, type Move, type PieceType, type Square } from '@chess/chess-core';
import type { EngineScore, SearchInfo } from './types';

const FILE_INDEX = 'abcdefgh';

const PROMOTION_LETTERS: Record<PieceType, string> = {
  queen: 'q',
  rook: 'r',
  bishop: 'b',
  knight: 'n',
  pawn: '',
  king: '',
};

const LETTER_PROMOTIONS: Readonly<Record<string, PieceType>> = {
  q: 'queen',
  r: 'rook',
  b: 'bishop',
  n: 'knight',
};

export function parseSquare(name: string): Square | null {
  if (name.length !== 2) return null;
  const file = FILE_INDEX.indexOf(name[0] as string);
  const rank = Number(name[1]) - 1;
  if (file < 0 || !Number.isInteger(rank) || rank < 0 || rank > 7) return null;
  return rank * 8 + file;
}

export interface ParsedUciMove {
  readonly from: Square;
  readonly to: Square;
  readonly promotion: PieceType | null;
}

/** Parse a UCI long-algebraic move (`e2e4`, `e7e8q`). Returns null if malformed. */
export function parseUciMove(uci: string): ParsedUciMove | null {
  if (typeof uci !== 'string') return null;
  const normalised = uci.trim().toLowerCase();
  if (normalised.length !== 4 && normalised.length !== 5) return null;

  const from = parseSquare(normalised.slice(0, 2));
  const to = parseSquare(normalised.slice(2, 4));
  if (from === null || to === null || from === to) return null;

  let promotion: PieceType | null = null;
  if (normalised.length === 5) {
    const parsed = LETTER_PROMOTIONS[normalised[4] as string];
    if (parsed === undefined) return null;
    promotion = parsed;
  }

  return { from, to, promotion };
}

/** Format a move as UCI long algebraic notation. */
export function toUci(move: {
  readonly from: Square;
  readonly to: Square;
  readonly promotion?: PieceType | null;
}): string {
  const promotion = move.promotion ?? null;
  const suffix = promotion === null ? '' : PROMOTION_LETTERS[promotion];
  return `${squareName(move.from)}${squareName(move.to)}${suffix}`;
}

export interface BestMoveInfo {
  readonly move: string | null;
  readonly ponder: string | null;
}

/** Parse a `bestmove ...` line. Returns null when the line is not one. */
export function parseBestMove(line: string): BestMoveInfo | null {
  const tokens = line.trim().split(/\s+/);
  if (tokens[0] !== 'bestmove') return null;

  const raw = tokens[1];
  const move = raw === undefined || raw === '(none)' ? null : raw;
  const ponderIndex = tokens.indexOf('ponder');
  const ponder = ponderIndex >= 0 ? (tokens[ponderIndex + 1] ?? null) : null;

  return { move, ponder };
}

function toNumber(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** Parse an `info ...` line into the fields the UI cares about. */
export function parseInfo(line: string): SearchInfo | null {
  const tokens = line.trim().split(/\s+/);
  if (tokens[0] !== 'info') return null;

  let depth: number | undefined;
  let nodes: number | undefined;
  let nps: number | undefined;
  let timeMs: number | undefined;
  let score: EngineScore | undefined;
  let pv: string[] = [];

  for (let index = 1; index < tokens.length; index++) {
    const token = tokens[index];
    switch (token) {
      case 'depth':
        depth = toNumber(tokens[index + 1]);
        index += 1;
        break;
      case 'nodes':
        nodes = toNumber(tokens[index + 1]);
        index += 1;
        break;
      case 'nps':
        nps = toNumber(tokens[index + 1]);
        index += 1;
        break;
      case 'time':
        timeMs = toNumber(tokens[index + 1]);
        index += 1;
        break;
      case 'score': {
        const kind = tokens[index + 1];
        const value = toNumber(tokens[index + 2]);
        if ((kind === 'cp' || kind === 'mate') && value !== undefined) {
          score = { type: kind, value };
        }
        index += 2;
        const bound = tokens[index + 1];
        if (bound === 'lowerbound' || bound === 'upperbound') index += 1;
        break;
      }
      case 'pv':
        pv = tokens.slice(index + 1).filter((entry) => entry !== '');
        index = tokens.length;
        break;
      default:
        break;
    }
  }

  if (depth === undefined && score === undefined && pv.length === 0) return null;
  return { depth, score, pv, nodes, nps, timeMs };
}

/**
 * Validate an engine move against the legal moves of the position. Returns the
 * matching input, or null when the engine produced something unplayable.
 */
export function resolveEngineMove(
  uci: string,
  legalMoves: ReadonlyArray<Move>,
): { from: Square; to: Square; promotion: PieceType | null } | null {
  const parsed = parseUciMove(uci);
  if (parsed === null) return null;

  const match = legalMoves.find(
    (move) =>
      move.from === parsed.from && move.to === parsed.to && (move.promotion ?? null) === parsed.promotion,
  );
  if (match === undefined) return null;

  return { from: match.from, to: match.to, promotion: match.promotion ?? null };
}

export function invertScore(score: EngineScore): EngineScore {
  return { type: score.type, value: -score.value };
}

/** Convert an engine score (side-to-move relative) to White's perspective. */
export function toWhitePerspective(score: EngineScore, sideToMove: Color): EngineScore {
  return sideToMove === 'white' ? score : invertScore(score);
}

export function formatScore(score: EngineScore | undefined): string {
  if (score === undefined) return '—';
  if (score.type === 'mate') {
    if (score.value === 0) return '#';
    return score.value > 0 ? `#${score.value}` : `#-${Math.abs(score.value)}`;
  }
  const pawns = score.value / 100;
  return `${pawns >= 0 ? '+' : ''}${pawns.toFixed(2)}`;
}
