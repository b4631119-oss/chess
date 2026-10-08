import type { ChangeEvent } from 'react';
import { describeOptions, DIFFICULTIES, isDifficulty } from '../ai/difficulty';
import { GAME_MODES, isGameMode } from '../ai/modes';
import type { Difficulty, EngineKind, GameMode } from '../ai/types';
import { ENGINE_OPTIONS, isEngineKind } from '../ai/workers';
import type { Theme } from '../theme/useTheme';
import { ThemeToggle } from './ThemeToggle';

interface GameHeaderProps {
  mode: GameMode;
  onModeChange: (mode: GameMode) => void;
  difficulty: Difficulty;
  onDifficultyChange: (difficulty: Difficulty) => void;
  engineKind: EngineKind;
  onEngineKindChange: (kind: EngineKind) => void;
  theme: Theme;
  onToggleTheme: () => void;
}

function BrandMark() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path
        d="M12 2.2a3.05 3.05 0 0 0-1.66 5.61c-.6.71-.96 1.55-.96 2.44 0 .79.28 1.5.75 2.09-1.77 1.36-3.1 3.4-3.63 5.46h11c-.53-2.06-1.86-4.1-3.63-5.46.47-.59.75-1.3.75-2.09 0-.89-.36-1.73-.96-2.44A3.05 3.05 0 0 0 12 2.2Z"
        fill="currentColor"
      />
      <path d="M5.6 18.6h12.8V21H5.6z" fill="currentColor" />
    </svg>
  );
}

export function GameHeader({
  mode,
  onModeChange,
  difficulty,
  onDifficultyChange,
  engineKind,
  onEngineKindChange,
  theme,
  onToggleTheme,
}: GameHeaderProps) {
  const handleMode = (event: ChangeEvent<HTMLSelectElement>): void => {
    if (isGameMode(event.target.value)) onModeChange(event.target.value);
  };
  const handleDifficulty = (event: ChangeEvent<HTMLSelectElement>): void => {
    if (isDifficulty(event.target.value)) onDifficultyChange(event.target.value);
  };
  const handleEngine = (event: ChangeEvent<HTMLSelectElement>): void => {
    if (isEngineKind(event.target.value)) onEngineKindChange(event.target.value);
  };

  return (
    <header className="game-header">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">
          <BrandMark />
        </span>
        <span className="brand-name">Шахматы</span>
      </div>

      <div className="controls">
        <label className="control">
          <span className="control-label">Режим</span>
          <span className="select">
            <select data-testid="mode-select" value={mode} onChange={handleMode}>
              {GAME_MODES.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </span>
        </label>

        <label className="control">
          <span className="control-label">Сложность</span>
          <span className="select">
            <select data-testid="difficulty-select" value={difficulty} onChange={handleDifficulty}>
              {DIFFICULTIES.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.label} — {describeOptions(preset.options)}
                </option>
              ))}
            </select>
          </span>
        </label>

        <label className="control">
          <span className="control-label">Движок</span>
          <span className="select">
            <select data-testid="engine-select" value={engineKind} onChange={handleEngine}>
              {ENGINE_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </span>
        </label>
      </div>

      <ThemeToggle theme={theme} onToggle={onToggleTheme} />
    </header>
  );
}
