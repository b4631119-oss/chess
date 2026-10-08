import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * End-to-end tests for the AI opponent. They drive the real UI: the Web Worker,
 * the Stockfish WASM build and the reducer-backed board.
 */

const HISTORY = '[data-testid="history"]';

async function startGame(page: Page, mode: string, difficulty: string): Promise<void> {
  await page.goto('/');
  await page.selectOption('[data-testid="mode-select"]', mode);
  await page.selectOption('[data-testid="difficulty-select"]', difficulty);
}

/** Number of half-moves played so far. */
async function plyCount(page: Page): Promise<number> {
  const value = await page.locator(HISTORY).getAttribute('data-plys');
  return Number(value ?? '0');
}

/** The AI can move faster than a poll interval, so wait for "at least". */
function waitForPlies(page: Page, atLeast: number, timeout: number): Promise<unknown> {
  return expect
    .poll(() => plyCount(page), { timeout, intervals: [40, 80, 120] })
    .toBeGreaterThanOrEqual(atLeast);
}

test.describe('AI opponent', () => {
  test('Easy AI answers the human move in under 3 seconds', async ({ page }) => {
    await startGame(page, 'ai-play-black', 'easy');

    // The engine really is Stockfish, not a silently-used fallback.
    await expect(page.locator('[data-testid="ai-engine"]')).toContainText('Stockfish');
    expect(await plyCount(page)).toBe(0);

    await page.click('[data-square="e2"]');
    await page.click('[data-square="e4"]');
    await waitForPlies(page, 1, 5000);

    // Time the engine's first reply from the moment the human move lands.
    const started = Date.now();
    await waitForPlies(page, 2, 3000);
    const elapsed = Date.now() - started;

    expect(elapsed).toBeLessThan(3000);
    expect(await plyCount(page)).toBeGreaterThanOrEqual(2);
    await expect(page.locator('.board-area h3')).toHaveText('Текущий игрок white');
  });

  test('shows the engine evaluation and best move in the debug panel', async ({ page }) => {
    await startGame(page, 'ai-play-black', 'medium');

    await page.click('[data-square="d2"]');
    await page.click('[data-square="d4"]');
    await waitForPlies(page, 2, 10_000);

    // The panel is fed by the engine's `info` stream.
    await expect(page.locator('[data-testid="ai-limit"]')).toHaveText('depth 5 · 400 ms');
    await expect(page.locator('[data-testid="ai-bestmove"]')).not.toHaveText('—');
    await expect(page.locator('[data-testid="ai-depth"]')).not.toHaveText('—');
  });

  test('AI vs AI plays both sides with no human input', async ({ page }) => {
    await startGame(page, 'ai-vs-ai', 'easy');
    await expect(page.locator('[data-testid="ai-engine"]')).toContainText('Stockfish');

    // Both colours keep moving on their own. No clicks are issued at all.
    await waitForPlies(page, 6, 30_000);
    const plys = await plyCount(page);
    expect(plys).toBeGreaterThanOrEqual(6);
  });

  test('a human cannot move while the engine is on the move', async ({ page }) => {
    await startGame(page, 'ai-vs-ai', 'hard');
    await waitForPlies(page, 1, 20_000);

    // No side is human-controlled, so nothing is draggable.
    await expect(page.locator('.cell[draggable="true"]')).toHaveCount(0);
  });
});
