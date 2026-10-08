# React Chess

Шахматы с полностью отделённым движком и оппонентом Stockfish в Web Worker.
Вся шахматная логика живёт в пакете `packages/chess-core` (чистый TypeScript, без
React и DOM), а приложение — тонкий React + Vite клиент, который только рендерит
состояние и отправляет действия. Игровой AI подключается через отдельный модуль
`apps/web/src/ai` и не блокирует UI-поток.

## Требования

- Node.js >= 18
- pnpm >= 9 (`corepack enable` или `npm i -g pnpm`)

## Быстрый старт

```bash
pnpm install
pnpm dev          # http://localhost:5173
```

## Команды

| Команда          | Что делает                                                |
| ---------------- | --------------------------------------------------------- |
| `pnpm dev`       | Dev-сервер Vite с HMR для `apps/web`                      |
| `pnpm build`     | Сборка всех пакетов (typecheck + production-бандл)        |
| `pnpm preview`   | Локальный просмотр production-сборки                      |
| `pnpm test`      | Vitest во всех пакетах (perft, правила, FEN/PGN, reducer, AI) |
| `pnpm typecheck` | `tsc --noEmit` во всех пакетах                            |
| `pnpm lint`      | ESLint (flat config) по всему репозиторию                 |
| `pnpm --filter @chess/web test:e2e` | Playwright E2E (поднимает dev-сервер сам) |
| `pnpm --filter @chess/web assets`   | Копирует Stockfish WASM в `public/stockfish/` |

Отдельные пакеты:

```bash
pnpm --filter @chess/chess-core test
pnpm --filter @chess/web build
```

## Игра против AI

Движок — **Stockfish 19 lite-single (WASM)**. Выбрана именно single-threaded
lite-сборка: полная занимает ~99 МБ, а эта — ~1.8 МБ и не требует
`SharedArrayBuffer`, то есть работает без заголовков COOP/COEP.

- **Worker.** Stockfish запускается в отдельном Web Worker (Emscripten-скрипт сам
  ведёт себя как воркер), а `stockfish.worker.ts` — тонкий типизированный мост к
  приложению. Главный поток никогда не занят поиском.
- **Сменный движок.** Всё общение идёт через `interface Engine`
  (`init / setPosition / go / stop / quit`). Замена Stockfish на встроенный
  minimax или на удалённый сервер — это одна строка в
  [createEngine.ts](apps/web/src/ai/createEngine.ts); UI о конкретной реализации
  не знает.
- **Сложности** — только через лимиты поиска (`depth` + `movetime`):
  `Easy 1/120ms`, `Medium 5/400ms`, `Hard 12/1200ms`, `Max 20/3000ms`.
- **Режимы**: Human vs Human, Human vs AI (за белых и за чёрных), AI vs AI.
- **Ходы AI идут через тот же reducer**, что и ходы человека: действие
  `playMove` валидируется ядром (`getLegalMoves` + `makeMove`). Правила в UI не
  дублируются. Ответ движка разбирается как UCI и проверяется по списку легальных
  ходов; нелегальный или нераспознанный ответ не применяется — в консоль пишется
  предупреждение, а ход заменяется случайным легальным.
- **Панель отладки** показывает движок, лимит, оценку с точки зрения белых,
  лучший ход и глубину; во время поиска видно `AI думает…`, доступна отмена, а
  после `restart` или мата поиск не запускается.
- **Fallback.** Если WASM не загрузился, приложение не молчит: оно сообщает об
  этом в панели и переключается на встроенный minimax (тоже Worker, тоже UCI).

### Внутри `apps/web/src/ai/`

| Файл                   | Назначение                                                        |
| ---------------------- | ----------------------------------------------------------------- |
| `types.ts`             | `Engine`, `GoOptions`, `GoResult`, `SearchInfo`, режимы, сложности |
| `uci.ts`               | чистые парсеры UCI + проверка хода по легальным                   |
| `workerEngine.ts`      | реализация `Engine` поверх воркера (UCI), с инъекцией фабрики      |
| `stockfish.worker.ts`  | воркер, поднимающий Stockfish WASM и проксирующий UCI              |
| `local.worker.ts`      | воркер, говорящий на UCI поверх встроенного minimax                |
| `minimax.ts`           | ограниченный negamax над `@chess/chess-core`                       |
| `workers.ts`           | фабрики воркеров через `new Worker(new URL(...), { type: 'module' })` |
| `difficulty.ts`        | пресеты сложности, `describeOptions`                               |
| `modes.ts`             | режимы игры и `isAiColor` / `hasAi`                                |
| `fallback.ts`          | выбор случайного легального хода                                   |
| `createEngine.ts`      | сборка движка за интерфейсом `Engine`                              |

## Структура проекта

```
chess-react/
├─ package.json              # корень pnpm-воркспейса, оркестрация скриптов
├─ pnpm-workspace.yaml
├─ tsconfig.base.json        # общие строгие настройки TypeScript
├─ eslint.config.js          # flat ESLint config
├─ packages/
│  └─ chess-core/            # движок правил (без React / DOM)
│     └─ src/
│        ├─ index.ts         # публичный API
│        ├─ types.ts         # Board, Piece, Move, GameState, Color, ...
│        ├─ internal.ts      # кодирование ходов, таблицы атак, генерация, make/unmake
│        ├─ game.ts          # createGame, getLegalMoves, makeMove, isCheck, ...
│        ├─ fen.ts / pgn.ts / san.ts / perft.ts
│        └─ __tests__/       # perft (Kiwipete и др.), правила, FEN, PGN
└─ apps/
   └─ web/                   # тонкий React + Vite клиент
      ├─ playwright.config.ts
      ├─ scripts/copy-stockfish.mjs   # копирует WASM в public/stockfish
      ├─ e2e/ai.spec.ts               # Playwright E2E
      ├─ public/stockfish/            # генерируется (в .gitignore)
      └─ src/
         ├─ main.tsx         # точка входа (createRoot)
         ├─ App.tsx          # вёрстка: шапка, таймеры, доска, история, съеденные, панель AI
         ├─ App.css
         ├─ assets/          # PNG фигур
         ├─ ai/              # движок AI (см. таблицу выше)
         ├─ game/            # reducer (state machine), useAiGame, производные данные, часы
         └─ components/      # GameHeader, AiPanel, Board, Square, GameTimer, MoveHistory,
                             #   CapturedPieces, PromotionPicker
```

## Публичный API движка правил (`@chess/chess-core`)

```ts
import {
  createGame, getLegalMoves, makeMove,
  isCheck, isCheckmate, isStalemate,
  getFen, loadFen, getPgn, loadPgn,
  type Board, type Piece, type Move, type GameState,
} from '@chess/chess-core';

let game = createGame();                       // или createGame(fen)
const moves = getLegalMoves(game, 12);         // ходы конкретной клетки
game = makeMove(game, { from: 12, to: 28 });   // e2-e4; состояние иммутабельно
```

Правила: все ходы фигур, шах, мат, пат, рокировка, взятие на проходе, превращение
пешки, правило 50 ходов, троекратное повторение и недостаточный материал.
Корректность генерации проверяется perft-тестами (в т.ч. Kiwipete и стартовая
позиция до глубины 5).

## Тесты

- `packages/chess-core` — perft, правила, FEN, PGN.
- `apps/web` — reducer (включая AI-путь и превращение), UCI-парсеры, контракт
  `Engine` с замоканным воркером, minimax.
- Playwright E2E — Easy-AI отвечает за < 3 с, панель отладки, AI vs AI, блокировка
  ручного ввода во время хода AI.
