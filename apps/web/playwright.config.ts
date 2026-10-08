import { defineConfig, devices } from '@playwright/test';

const PORT = 5178;
const HOST = '127.0.0.1';

/**
 * E2E runs against a real Vite dev server so the Web Workers, the WASM engine
 * and the stockfish assets are exercised exactly as a user would load them.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: {
    baseURL: `http://${HOST}:${PORT}`,
    trace: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
      testIgnore: /touch\.spec\.ts/,
    },
    {
      // Touch emulation for the drag-and-drop gesture. iPhone 13 metrics and
      // UA on the Chromium engine, the one installed in this environment.
      name: 'iphone-13',
      use: { ...devices['iPhone 13'], browserName: 'chromium' },
      testMatch: /touch\.spec\.ts/,
    },
  ],
  webServer: {
    // Invoked through node so no pnpm/npm shim is required in the test env.
    command: `node ./node_modules/vite/bin/vite.js --port ${PORT} --strictPort --host ${HOST}`,
    url: `http://${HOST}:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
