import type { Theme } from '../theme/useTheme';

interface ThemeToggleProps {
  theme: Theme;
  onToggle: () => void;
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="4.1" fill="currentColor" />
      <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M12 2.4v2.3M12 19.3v2.3M2.4 12h2.3M19.3 12h2.3" />
        <path d="M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6" />
      </g>
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
      <path
        d="M20.2 14.6A8.6 8.6 0 0 1 9.4 3.8a8.6 8.6 0 1 0 10.8 10.8Z"
        fill="currentColor"
      />
    </svg>
  );
}

/**
 * Palette switcher. The choice is owned by `useTheme` and stored in
 * localStorage, so it survives a reload.
 */
export function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
  const isDark = theme === 'dark';
  const label = isDark ? 'Тёмная тема' : 'Светлая тема';
  const hint = isDark ? 'Включить светлую тему' : 'Включить тёмную тему';

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={onToggle}
      aria-pressed={isDark}
      aria-label={hint}
      title={hint}
      data-testid="theme-toggle"
      data-theme-state={theme}
    >
      <span className="theme-toggle-icon" aria-hidden="true">
        {isDark ? <MoonIcon /> : <SunIcon />}
      </span>
      <span className="theme-toggle-label">{label}</span>
    </button>
  );
}
