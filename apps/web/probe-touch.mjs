// Temporary diagnostic: is touchmove cancelable while a piece is dragged?
import { chromium, devices } from '@playwright/test';

const { defaultBrowserType: _ignored, ...iphone } = devices['iPhone 13'];
const BASE = 'http://localhost:5173/';
const stripTouchAction = process.argv[2] === 'strip';

const browser = await chromium.launch();
const context = await browser.newContext(iphone);
await context.addInitScript(() => {
  const probe = { moves: 0, prevented: 0, cancelable: 0 };
  document.addEventListener(
    'touchmove',
    (event) => {
      probe.moves += 1;
      if (event.defaultPrevented) probe.prevented += 1;
      if (event.cancelable) probe.cancelable += 1;
    },
    { passive: true },
  );
  Object.defineProperty(window, '__probe', { value: probe });
});

const page = await context.newPage();
await page.goto(BASE, { waitUntil: 'load' });
await page.waitForSelector('[data-testid="board"]');

if (stripTouchAction) {
  await page.evaluate(() => {
    for (const cell of document.querySelectorAll('.cell')) cell.style.touchAction = 'auto';
  });
}

const centre = async (name) => {
  const box = await page.locator(`[data-square="${name}"]`).boundingBox();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};
const from = await centre('e2');
const to = await centre('e4');

console.log(
  'computed touch-action on e2:',
  await page.evaluate(() => getComputedStyle(document.querySelector('[data-square="e2"]')).touchAction),
);

const client = await context.newCDPSession(page);
await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from.x, y: from.y }] });
for (let step = 1; step <= 10; step += 1) {
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: from.x + ((to.x - from.x) * step) / 10, y: from.y + ((to.y - from.y) * step) / 10 }],
  });
  await page.waitForTimeout(20);
}
await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
await page.waitForTimeout(200);

console.log('probe:', await page.evaluate(() => window.__probe));
console.log('scrollY:', await page.evaluate(() => window.scrollY));
console.log('plies:', await page.locator('[data-testid="history"]').getAttribute('data-plys'));

await client.detach();
await browser.close();
