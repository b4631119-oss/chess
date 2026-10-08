import { expect, test } from '@playwright/test';

/**
 * Desktop pointer input. These guard the paths the touch work had to leave
 * untouched: native HTML5 drag-and-drop and plain clicks.
 */

const HISTORY = '[data-testid="history"]';

test.describe('desktop pointer input', () => {
  test('HTML5 drag-and-drop moves a piece', async ({ page }) => {
    await page.goto('/');

    await page.dragAndDrop('[data-square="e2"]', '[data-square="e4"]');

    await expect(page.locator(HISTORY)).toHaveAttribute('data-plys', '1');
    await expect(page.locator(HISTORY)).toContainText('e4');
  });

  test('clicking the piece and then the destination moves it', async ({ page }) => {
    await page.goto('/');

    await page.click('[data-square="d2"]');
    await expect(page.locator('.cell.selected')).toHaveAttribute('data-square', 'd2');

    await page.click('[data-square="d4"]');
    await expect(page.locator(HISTORY)).toHaveAttribute('data-plys', '1');
    await expect(page.locator(HISTORY)).toContainText('d4');
  });
});
