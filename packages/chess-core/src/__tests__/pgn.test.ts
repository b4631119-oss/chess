import { describe, expect, it } from 'vitest';
import { getFen, getPgn, loadPgn } from '../index';

describe('getPgn', () => {
  it('emits movetext with move numbers and a result token', () => {
    const state = loadPgn('1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7#');
    expect(getPgn(state)).toBe('1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7# 1-0');
  });

  it('marks an unfinished game with *', () => {
    const state = loadPgn('1. d4 d5 2. c4');
    expect(getPgn(state)).toBe('1. d4 d5 2. c4 *');
  });
});

describe('loadPgn', () => {
  it('replays a short game', () => {
    const state = loadPgn('1. e4 e5 2. Nf3 Nc6 3. Bb5');
    expect(state.history).toHaveLength(5);
    expect(state.history.map((move) => move.san)).toEqual(['e4', 'e5', 'Nf3', 'Nc6', 'Bb5']);
  });

  it('round-trips through getPgn', () => {
    const played = loadPgn('1. d4 Nf6 2. c4 e6 3. Nc3 Bb4');
    const reloaded = loadPgn(getPgn(played));
    expect(getFen(reloaded)).toBe(getFen(played));
  });

  it('ignores headers, comments, variations and NAGs', () => {
    const pgn = [
      '[Event "Unit test"]',
      '[Site "?"]',
      '',
      '1. e4 e5 2. Nf3 $1 {develops} Nc6 (2... d6 3. d4) 3. Bb5 *',
    ].join('\n');
    const state = loadPgn(pgn);
    expect(state.history).toHaveLength(5);
    expect(state.history[4]?.san).toBe('Bb5');
  });

  it('throws on an unplayable token', () => {
    expect(() => loadPgn('1. e4 e5 2. Zx9')).toThrow(/cannot play/);
  });
});
