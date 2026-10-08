/**
 * Copies the Stockfish WASM build into `public/stockfish/`.
 *
 * The Emscripten build derives its `.wasm` path from its own script URL, so the
 * two files must stay siblings with matching names. Stable names are used so the
 * worker never has to know the engine's build number.
 */
import { cpSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const stockfishPackageJson = require.resolve('stockfish/package.json');
const stockfishDir = dirname(stockfishPackageJson);
const { buildVersion } = JSON.parse(readFileSync(stockfishPackageJson, 'utf8'));

const sources = [
  ['stockfish', `stockfish-${buildVersion}-lite-single.js`, 'stockfish-lite-single.js'],
  ['stockfish', `stockfish-${buildVersion}-lite-single.wasm`, 'stockfish-lite-single.wasm'],
];

const targetDir = join(webRoot, 'public', 'stockfish');
mkdirSync(targetDir, { recursive: true });

for (const [, sourceName, targetName] of sources) {
  const source = join(stockfishDir, 'bin', sourceName);
  if (!existsSync(source)) {
    throw new Error(`[copy-stockfish] missing engine file: ${source}`);
  }
  cpSync(source, join(targetDir, targetName));
  console.log(`[copy-stockfish] ${sourceName} -> public/stockfish/${targetName}`);
}
