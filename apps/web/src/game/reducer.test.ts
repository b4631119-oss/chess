import { describe, expect, it } from 'vitest';
import type { Square } from '@chess/chess-core';
import { createInitialState, gameReducer, INITIAL_CLOCK_SECONDS, type GameUiState } from './reducer';

const FILES = 'abcdefgh';
function sq(name: string): Square {
  return (Number(name[1]) - 1) * 8 + FILES.indexOf(name[0] as string);
}

function reduce(state: GameUiState, ...actions: Parameters<typeof gameReducer>[1][]): GameUiState {
  return actions.reduce(gameReducer, state);
}

describe('gameReducer', () => {
  it('selects a piece and highlights its legal targets', () => {
    const state = gameReducer(createInitialState(), { type: 'click', square: sq('e2') });
    expect(state.selected).toBe(sq('e2'));
    expect(state.legalTargets.map((move) => move.to)).toEqual([sq('e3'), sq('e4')]);
  });

  it('moves a piece by clicking twice', () => {
    const state = reduce(
      createInitialState(),
      { type: 'click', square: sq('e2') },
      { type: 'click', square: sq('e4') },
    );
    expect(state.game.turn).toBe('black');
    expect(state.game.history).toHaveLength(1);
    expect(state.lastMove?.san).toBe('e4');
    expect(state.selected).toBeNull();
  });

  it('moves a piece through the shared playMove action', () => {
    const state = gameReducer(createInitialState(), { type: 'playMove', from: sq('g1'), to: sq('f3') });
    expect(state.lastMove?.san).toBe('Nf3');
    expect(state.game.turn).toBe('black');
  });

  it('ignores illegal moves and clicks on empty squares', () => {
    const initial = createInitialState();
    expect(gameReducer(initial, { type: 'playMove', from: sq('e2'), to: sq('e5') })).toBe(initial);
    expect(gameReducer(initial, { type: 'click', square: sq('e5') }).selected).toBeNull();
  });

  it('ignores a playMove for the opponent', () => {
    const initial = createInitialState();
    expect(gameReducer(initial, { type: 'playMove', from: sq('e7'), to: sq('e5') })).toBe(initial);
  });

  it('asks a human for the promotion piece', () => {
    const start = createInitialState('7k/P7/8/8/8/8/8/K7 w - - 0 1');
    const afterMove = gameReducer(start, { type: 'playMove', from: sq('a7'), to: sq('a8') });

    expect(afterMove.pendingPromotion).not.toBeNull();
    expect(afterMove.game.history).toHaveLength(0);

    const promoted = gameReducer(afterMove, { type: 'promote', promotion: 'queen' });
    expect(promoted.pendingPromotion).toBeNull();
    expect(promoted.game.board[sq('a8')]).toEqual({ type: 'queen', color: 'white' });
  });

  it('applies an engine promotion immediately when the piece is supplied', () => {
    const start = createInitialState('7k/P7/8/8/8/8/8/K7 w - - 0 1');
    const promoted = gameReducer(start, {
      type: 'playMove',
      from: sq('a7'),
      to: sq('a8'),
      promotion: 'knight',
    });

    expect(promoted.pendingPromotion).toBeNull();
    expect(promoted.game.board[sq('a8')]).toEqual({ type: 'knight', color: 'white' });
    expect(promoted.game.history[0]?.san).toBe('a8=N');
  });

  it('cancels a pending promotion without moving', () => {
    const start = createInitialState('7k/P7/8/8/8/8/8/K7 w - - 0 1');
    const afterMove = gameReducer(start, { type: 'playMove', from: sq('a7'), to: sq('a8') });
    const cancelled = gameReducer(afterMove, { type: 'cancelPromotion' });
    expect(cancelled.pendingPromotion).toBeNull();
    expect(cancelled.game.history).toHaveLength(0);
  });

  it('resets the board and the clocks on restart', () => {
    const played = reduce(
      createInitialState(),
      { type: 'playMove', from: sq('e2'), to: sq('e4') },
      { type: 'tick', color: 'black' },
    );
    const restarted = gameReducer(played, { type: 'restart' });
    expect(restarted.game.history).toHaveLength(0);
    expect(restarted.clock).toEqual({ white: INITIAL_CLOCK_SECONDS, black: INITIAL_CLOCK_SECONDS });
  });

  it('counts down only the side to move', () => {
    const initial = createInitialState();
    const whiteTick = gameReducer(initial, { type: 'tick', color: 'white' });
    expect(whiteTick.clock.white).toBe(INITIAL_CLOCK_SECONDS - 1);
    expect(whiteTick.clock.black).toBe(INITIAL_CLOCK_SECONDS);

    const blackTick = gameReducer(initial, { type: 'tick', color: 'black' });
    expect(blackTick.clock).toEqual(initial.clock);
  });
});
