import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * Touch input on a real touch emulator (the `iphone-13` project: iPhone 13
 * viewport, device scale factor, mobile UA and `hasTouch`). These tests drive
 * genuine touch events, not synthesised DOM ones.
 */

const HISTORY = '[data-testid="history"]';

interface Point {
  x: number;
  y: number;
}

/** Centre of a board square, in viewport CSS pixels. */
async function centreOf(page: Page, square: string): Promise<Point> {
  const box = await page.locator(`[data-square="${square}"]`).boundingBox();
  if (box === null) throw new Error(`Square ${square} is not visible`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function tapSquare(page: Page, square: string): Promise<void> {
  const point = await centreOf(page, square);
  await page.touchscreen.tap(point.x, point.y);
}

/** Half-moves played so far. */
async function plyCount(page: Page): Promise<number> {
  const value = await page.locator(HISTORY).getAttribute('data-plys');
  return Number(value ?? '0');
}

/**
 * A finger drag. Playwright's touchscreen API only taps, so the move sequence
 * goes through CDP's real input pipeline — `touch-action` and preventDefault
 * apply exactly as they do for a human finger.
 */
async function touchDrag(page: Page, from: Point, to: Point, steps = 10): Promise<void> {
  const client = await page.context().newCDPSession(page);
  try {
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: from.x, y: from.y }],
    });
    for (let step = 1; step <= steps; step += 1) {
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [
          {
            x: from.x + ((to.x - from.x) * step) / steps,
            y: from.y + ((to.y - from.y) * step) / steps,
          },
        ],
      });
    }
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } finally {
    await client.detach();
  }
}

test.describe('touch input', () => {
  test('tap the pawn, then the destination square, plays the move', async ({ page }) => {
    await page.goto('/');
    expect(await plyCount(page)).toBe(0);

    await tapSquare(page, 'e2');
    const selected = page.locator('.cell.selected');
    await expect(selected).toHaveCount(1);
    await expect(selected).toHaveAttribute('data-square', 'e2');

    await tapSquare(page, 'e4');
    await expect(page.locator(HISTORY)).toHaveAttribute('data-plys', '1');
    await expect(page.locator(HISTORY)).toContainText('e4');
  });

  test('dragging a piece with a finger drops it on the square under the finger', async ({
    page,
  }) => {
    const noise: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'warning' || message.type() === 'error') noise.push(message.text());
    });

    await page.goto('/');

    await touchDrag(page, await centreOf(page, 'e2'), await centreOf(page, 'e4'));

    await expect(page.locator(HISTORY)).toHaveAttribute('data-plys', '1');
    await expect(page.locator(HISTORY)).toContainText('e4');
    // The gesture is over: nothing is left highlighted or floating.
    await expect(page.locator('.cell.touch-target')).toHaveCount(0);
    await expect(page.locator('.drag-ghost')).toHaveCount(0);
    // A passive-listener `preventDefault` would land here as an intervention
    // warning, which would mean scroll prevention is silently not working.
    expect(noise.filter((text) => /preventDefault|passive/i.test(text))).toEqual([]);
  });

  test('a finger that stays within the slop radius is a tap, not a drag', async ({ page }) => {
    await page.goto('/');
    const start = await centreOf(page, 'e2');

    // 6px of travel: under the 10px threshold, so nothing may be dropped.
    await touchDrag(page, start, { x: start.x + 4, y: start.y - 4 });

    await expect(page.locator(HISTORY)).toHaveAttribute('data-plys', '0');
    await expect(page.locator('.cell.selected')).toHaveAttribute('data-square', 'e2');
  });

  test('the page does not scroll while a piece is dragged', async ({ page }) => {
    // A document-level probe records whether the drag really cancelled the
    // move events: a passive listener would leave every one of them uncancelled.
    await page.addInitScript(() => {
      let moves = 0;
      let prevented = 0;
      document.addEventListener(
        'touchmove',
        (event) => {
          moves += 1;
          if (event.defaultPrevented) prevented += 1;
          document.documentElement.dataset.touchMoves = String(moves);
          document.documentElement.dataset.touchPrevented = String(prevented);
        },
        { passive: true },
      );
    });

    await page.goto('/');
    const start = await centreOf(page, 'e2');

    // The page is taller than the viewport, so an unguarded drag scrolls it.
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeGreaterThan(
      await page.evaluate(() => window.innerHeight),
    );

    await touchDrag(page, start, { x: start.x, y: start.y - 220 });

    const moves = Number(await page.locator('html').getAttribute('data-touch-moves'));
    const prevented = Number(await page.locator('html').getAttribute('data-touch-prevented'));
    // Only the first step can be sub-threshold, before the gesture is a drag.
    expect(prevented).toBeGreaterThanOrEqual(moves - 1);
    expect(prevented).toBeGreaterThan(0);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });

  test('a tap on an empty square still selects it as the second half of a move', async ({
    page,
  }) => {
    await page.goto('/');

    await tapSquare(page, 'd2');
    await tapSquare(page, 'd4');

    await expect(page.locator(HISTORY)).toHaveAttribute('data-plys', '1');
    await expect(page.locator(HISTORY)).toContainText('d4');
  });
});
