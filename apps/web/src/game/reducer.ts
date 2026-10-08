import {
  createGame,
  getLegalMoves,
  isGameOver,
  makeMove,
  type Color,
  type GameState,
  type Move,
  type PieceType,
  type Square,
} from '@chess/chess-core';

export const INITIAL_CLOCK_SECONDS = 300;

export interface PendingPromotion {
  readonly from: Square;
  readonly to: Square;
  readonly moves: ReadonlyArray<Move>;
}

export interface GameUiState {
  readonly game: GameState;
  readonly selected: Square | null;
  /** Legal moves from `selected` (empty when nothing is selected). */
  readonly legalTargets: ReadonlyArray<Move>;
  readonly lastMove: Move | null;
  readonly pendingPromotion: PendingPromotion | null;
  readonly clock: { readonly white: number; readonly black: number };
}

export type GameAction =
  | { type: 'click'; square: Square }
  /**
   * Apply a move by squares. The human gesture and the AI both funnel through
   * this exact action, so all validation stays inside the core-backed reducer.
   */
  | { type: 'playMove'; from: Square; to: Square; promotion?: PieceType | null }
  | { type: 'promote'; promotion: PieceType }
  | { type: 'cancelPromotion' }
  | { type: 'restart' }
  | { type: 'tick'; color: Color };

export function createInitialState(fen?: string): GameUiState {
  return {
    game: createGame(fen),
    selected: null,
    legalTargets: [],
    lastMove: null,
    pendingPromotion: null,
    clock: { white: INITIAL_CLOCK_SECONDS, black: INITIAL_CLOCK_SECONDS },
  };
}

function commitMove(state: GameUiState, move: Move): GameUiState {
  let game: GameState;
  try {
    game = makeMove(state.game, move);
  } catch {
    return state;
  }
  return {
    ...state,
    game,
    selected: null,
    legalTargets: [],
    lastMove: move,
    pendingPromotion: null,
  };
}

/**
 * Resolve a from/to (plus an optional promotion) against the core's legal moves
 * and commit it. Illegal input is silently ignored; a promotion without a
 * chosen piece opens the picker instead of guessing.
 */
function playMove(
  state: GameUiState,
  from: Square,
  to: Square,
  promotion?: PieceType | null,
): GameUiState {
  const candidates = getLegalMoves(state.game, from).filter((move) => move.to === to);
  if (candidates.length === 0) return state;

  if (promotion !== undefined && promotion !== null) {
    const chosen = candidates.find((move) => move.promotion === promotion);
    return chosen === undefined ? state : commitMove(state, chosen);
  }

  // Multiple candidates only happens for promotions: ask the player which piece.
  if (candidates.length > 1) {
    return {
      ...state,
      selected: null,
      legalTargets: [],
      pendingPromotion: { from, to, moves: candidates },
    };
  }

  return commitMove(state, candidates[0]);
}

export function gameReducer(state: GameUiState, action: GameAction): GameUiState {
  switch (action.type) {
    case 'click': {
      if (state.pendingPromotion !== null) return state;

      const { square } = action;
      if (state.selected !== null && state.legalTargets.some((move) => move.to === square)) {
        return playMove(state, state.selected, square);
      }

      const piece = state.game.board[square] ?? null;
      if (piece !== null && piece.color === state.game.turn) {
        return { ...state, selected: square, legalTargets: getLegalMoves(state.game, square) };
      }

      return { ...state, selected: null, legalTargets: [] };
    }

    case 'playMove': {
      if (state.pendingPromotion !== null) return state;
      return playMove(state, action.from, action.to, action.promotion);
    }

    case 'promote': {
      const pending = state.pendingPromotion;
      if (pending === null) return state;
      const move = pending.moves.find((candidate) => candidate.promotion === action.promotion);
      if (move === undefined) return state;
      return commitMove(state, move);
    }

    case 'cancelPromotion':
      return { ...state, pendingPromotion: null, selected: null, legalTargets: [] };

    case 'restart':
      return createInitialState();

    case 'tick': {
      if (isGameOver(state.game)) return state;
      if (state.game.turn !== action.color) return state;
      const current = state.clock[action.color];
      if (current <= 0) return state;
      return { ...state, clock: { ...state.clock, [action.color]: current - 1 } };
    }

    default:
      return state;
  }
}
