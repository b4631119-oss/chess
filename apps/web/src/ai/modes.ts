import type { Color } from '@chess/chess-core';
import type { GameMode } from './types';

/** True when the given side is controlled by the engine in this mode. */
export function isAiColor(mode: GameMode, color: Color): boolean {
  switch (mode) {
    case 'ai-play-white':
      return color === 'white';
    case 'ai-play-black':
      return color === 'black';
    case 'ai-vs-ai':
      return true;
    case 'human-vs-human':
      return false;
  }
}

export function modeHasAi(mode: GameMode): boolean {
  return mode !== 'human-vs-human';
}

export interface ModeOption {
  readonly id: GameMode;
  readonly label: string;
}

export const GAME_MODES: readonly ModeOption[] = [
  { id: 'human-vs-human', label: 'Человек vs Человек' },
  { id: 'ai-play-black', label: 'Человек (белые) vs AI' },
  { id: 'ai-play-white', label: 'AI vs Человек (чёрные)' },
  { id: 'ai-vs-ai', label: 'AI vs AI' },
];

export function modeLabel(mode: GameMode): string {
  return GAME_MODES.find((option) => option.id === mode)?.label ?? mode;
}

export function isGameMode(value: string): value is GameMode {
  return GAME_MODES.some((option) => option.id === value);
}
