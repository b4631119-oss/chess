import type { Difficulty, GoOptions } from './types';

export interface DifficultyPreset {
  readonly id: Difficulty;
  readonly label: string;
  readonly options: GoOptions;
}

/**
 * Difficulty is expressed purely through search limits: a shallow/fast search
 * on weak settings, a deep/long one on max.
 */
export const DIFFICULTIES: readonly DifficultyPreset[] = [
  { id: 'easy', label: 'Easy', options: { depth: 1, movetime: 120 } },
  { id: 'medium', label: 'Medium', options: { depth: 5, movetime: 400 } },
  { id: 'hard', label: 'Hard', options: { depth: 12, movetime: 1200 } },
  { id: 'max', label: 'Max', options: { depth: 20, movetime: 3000 } },
];

export function difficultyPreset(id: Difficulty): DifficultyPreset {
  const preset = DIFFICULTIES.find((candidate) => candidate.id === id);
  if (preset === undefined) throw new Error(`Unknown difficulty: ${id}`);
  return preset;
}

export function isDifficulty(value: string): value is Difficulty {
  return DIFFICULTIES.some((preset) => preset.id === value);
}

export function describeOptions(options: GoOptions): string {
  const parts: string[] = [];
  if (options.depth !== undefined) parts.push(`depth ${options.depth}`);
  if (options.movetime !== undefined) parts.push(`${options.movetime} ms`);
  return parts.join(' · ');
}
