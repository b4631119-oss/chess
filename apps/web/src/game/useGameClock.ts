import { useEffect } from 'react';
import type { Color } from '@chess/chess-core';

/**
 * Invokes `onTick` once per second for the side to move. Pass `null` to pause
 * (e.g. when the game is over).
 */
export function useGameClock(active: Color | null, onTick: (color: Color) => void): void {
  useEffect(() => {
    if (active === null) return;
    const id = window.setInterval(() => onTick(active), 1000);
    return () => window.clearInterval(id);
  }, [active, onTick]);
}
