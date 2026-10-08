/**
 * Portable Game Notation (PGN) import/export.
 *
 * `getPgn` emits plain movetext (move numbers, SAN, result token) and
 * `loadPgn` accepts headers, comments, NAGs and single-level variations.
 */

import { createGame, getLegalMoves, isCheckmate, isDraw, isStalemate, makeMove } from './game';
import type { GameState, Move } from './types';

const RESULT_TOKENS = new Set(['1-0', '0-1', '1/2-1/2', '*']);

function tokenize(pgn: string): string[] {
  let text = pgn;
  let previous = '';
  while (text !== previous) {
    previous = text;
    text = text.replace(/\([^()]*\)/g, ' ');
  }

  text = text
    .replace(/\{[^}]*\}/g, ' ')
    .replace(/;[^\n]*/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\$\d+/g, ' ')
    .replace(/\d+\.(\.\.)?/g, ' ');

  return text
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

function normalizeSan(san: string): string {
  return san
    .trim()
    .replace(/[+#]+$/g, '')
    .replace(/[!?]+/g, '')
    .replace(/0-0-0/g, 'O-O-O')
    .replace(/0-0/g, 'O-O')
    .replace(/e\.?p\.?/gi, '')
    .replace(/=/, '')
    .replace(/\s+/g, '');
}

function resultToken(state: GameState): string {
  if (isCheckmate(state)) return state.turn === 'black' ? '1-0' : '0-1';
  if (isStalemate(state) || isDraw(state)) return '1/2-1/2';
  return '*';
}

/** Serialize the game's move history to PGN movetext. */
export function getPgn(state: GameState): string {
  const parts: string[] = [];
  state.history.forEach((move, index) => {
    if (move.color === 'white') parts.push(`${Math.floor(index / 2) + 1}.`);
    parts.push(move.san);
  });
  parts.push(resultToken(state));
  return parts.join(' ');
}

function matchSan(state: GameState, san: string): Move | null {
  const target = normalizeSan(san);
  for (const move of getLegalMoves(state)) {
    if (normalizeSan(move.san) === target) return move;
  }
  return null;
}

/** Parse PGN movetext and replay it into a fresh game state. */
export function loadPgn(pgn: string): GameState {
  const tokens = tokenize(pgn);
  let state = createGame();

  for (const token of tokens) {
    if (RESULT_TOKENS.has(token)) break;
    const move = matchSan(state, token);
    if (move === null) {
      throw new Error(`Invalid PGN: cannot play "${token}"`);
    }
    state = makeMove(state, move);
  }

  return state;
}
