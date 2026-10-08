/**
 * A UCI-speaking worker that runs the built-in minimax search.
 *
 * Because it answers the exact same protocol as Stockfish, the app can swap
 * engines without any UI change — it is both the offline fallback and the proof
 * that the `Engine` seam is real. It uses `@chess/chess-core` for all rules.
 */

import { getLegalMoves, INITIAL_FEN, loadFen, makeMove, type GameState } from '@chess/chess-core';
import { LOCAL_MAX_DEPTH, searchBestMove } from './minimax';
import { parseUciMove, toUci } from './uci';
import { workerScope } from './workerScope';

let game: GameState = loadFen(INITIAL_FEN);
let cancelled = false;

function post(line: string): void {
  workerScope.postMessage(line);
}

function applyMoves(state: GameState, tokens: readonly string[]): GameState {
  let current = state;
  for (const token of tokens) {
    if (token === '') continue;
    const parsed = parseUciMove(token);
    if (parsed === null) continue;
    const match = getLegalMoves(current).find(
      (move) =>
        move.from === parsed.from && move.to === parsed.to && (move.promotion ?? null) === parsed.promotion,
    );
    if (match !== undefined) current = makeMove(current, match);
  }
  return current;
}

function setPosition(args: string): void {
  if (args === 'startpos') {
    game = loadFen(INITIAL_FEN);
    return;
  }
  if (args.startsWith('startpos moves ')) {
    game = applyMoves(loadFen(INITIAL_FEN), args.slice('startpos moves '.length).split(/\s+/));
    return;
  }
  if (args.startsWith('fen ')) {
    const rest = args.slice('fen '.length);
    const movesIndex = rest.indexOf(' moves ');
    const fen = (movesIndex === -1 ? rest : rest.slice(0, movesIndex)).trim();
    const tokens = movesIndex === -1 ? [] : rest.slice(movesIndex + ' moves '.length).split(/\s+/);
    try {
      game = applyMoves(loadFen(fen), tokens);
    } catch {
      game = loadFen(INITIAL_FEN);
    }
  }
}

function runSearch(args: string): void {
  const tokens = args.split(/\s+/);
  const depthIndex = tokens.indexOf('depth');
  const requested = depthIndex >= 0 ? Number(tokens[depthIndex + 1]) : LOCAL_MAX_DEPTH;
  const depth = Number.isFinite(requested) ? requested : LOCAL_MAX_DEPTH;

  cancelled = false;
  const result = searchBestMove(game, depth);
  if (cancelled || result === null) {
    post('bestmove (none)');
    return;
  }

  // UCI scores are side-to-move relative; the search reports White-relative.
  const cp = game.turn === 'white' ? result.score : -result.score;
  const uci = toUci(result);
  post(`info depth ${result.depth} score cp ${cp} nodes ${result.nodes} pv ${uci}`);
  post(`bestmove ${uci}`);
}

function handle(command: string): void {
  const trimmed = command.trim();
  if (trimmed === '') return;

  const spaceIndex = trimmed.indexOf(' ');
  const head = spaceIndex === -1 ? trimmed : trimmed.slice(0, spaceIndex);
  const args = spaceIndex === -1 ? '' : trimmed.slice(spaceIndex + 1);

  switch (head) {
    case 'uci':
      post('id name Chess-Core Minimax');
      post('uciok');
      break;
    case 'isready':
      post('readyok');
      break;
    case 'ucinewgame':
      game = loadFen(INITIAL_FEN);
      break;
    case 'position':
      setPosition(args);
      break;
    case 'go':
      runSearch(args);
      break;
    case 'stop':
      cancelled = true;
      break;
    case 'quit':
      workerScope.close();
      break;
    default:
      break;
  }
}

workerScope.onmessage = (event: MessageEvent<unknown>): void => {
  if (typeof event.data === 'string') handle(event.data);
};
