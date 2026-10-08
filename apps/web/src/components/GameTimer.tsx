import type { Color } from '@chess/chess-core';

/** Below this many seconds a clock turns red and pulses. */
const LOW_TIME_SECONDS = 30;

interface GameTimerProps {
  white: number;
  black: number;
  active: Color | null;
  onRestart: () => void;
}

interface ClockProps {
  color: Color;
  label: string;
  seconds: number;
  active: boolean;
}

/** mm:ss, clamped at zero. */
function formatClock(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  return `${minutes}:${String(safe % 60).padStart(2, '0')}`;
}

function Clock({ color, label, seconds, active }: ClockProps) {
  const low = seconds < LOW_TIME_SECONDS;
  const classes = ['clock'];
  if (active) classes.push('clock--active');
  if (low) classes.push('clock--low');
  const displayed = formatClock(seconds);

  return (
    <div
      className={classes.join(' ')}
      data-testid={`clock-${color}`}
      data-seconds={seconds}
      data-active={active}
      data-low={low}
      aria-label={`${label}: ${displayed}`}
    >
      <span className="clock-label">
        <span className={`clock-dot clock-dot--${color}`} aria-hidden="true" />
        {label}
      </span>
      <span className="clock-time">{displayed}</span>
    </div>
  );
}

export function GameTimer({ white, black, active, onRestart }: GameTimerProps) {
  return (
    <div className="timer panel">
      <h3 className="panel-title">Часы</h3>
      <Clock color="black" label="Чёрные" seconds={black} active={active === 'black'} />
      <Clock color="white" label="Белые" seconds={white} active={active === 'white'} />
      <button type="button" className="button-primary" onClick={onRestart}>
        Новая партия
      </button>
    </div>
  );
}
