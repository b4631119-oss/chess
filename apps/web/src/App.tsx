import { useCallback, useMemo, useReducer, useState } from 'react';
import {
  getGameStatus,
  isGameOver,
  type Color,
  type GameStatus,
  type MoveInput,
  type PieceType,
  type Square,
} from '@chess/chess-core';
import './styles/tokens.css';
import './App.css';
import { modeHasAi } from './ai/modes';
import type { Difficulty, EngineKind, GameMode } from './ai/types';
import { AiPanel } from './components/AiPanel';
import { Board } from './components/Board';
import { CapturedPieces } from './components/CapturedPieces';
import { GameHeader } from './components/GameHeader';
import { GameTimer } from './components/GameTimer';
import { MoveHistory } from './components/MoveHistory';
import { PromotionPicker } from './components/PromotionPicker';
import { capturedPieces } from './game/derived';
import { createInitialState, gameReducer } from './game/reducer';
import { useAiGame } from './game/useAiGame';
import { useGameClock } from './game/useGameClock';
import { useTheme } from './theme/useTheme';

const STATUS_TEXT: Record<GameStatus, string> = {
  ongoing: '',
  check: 'Шах!',
  checkmate: 'Мат!',
  stalemate: 'Пат',
  draw: 'Ничья',
};

export function App() {
  const [state, dispatch] = useReducer(gameReducer, undefined, createInitialState);
  const [mode, setMode] = useState<GameMode>('human-vs-human');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [engineKind, setEngineKind] = useState<EngineKind>('stockfish');
  const { theme, toggleTheme } = useTheme();

  const { game, clock, selected, legalTargets, lastMove, pendingPromotion } = state;

  const gameOver = isGameOver(game);
  const activeColor: Color | null = gameOver ? null : game.turn;

  const handleTick = useCallback((color: Color) => dispatch({ type: 'tick', color }), []);
  useGameClock(activeColor, handleTick);

  // The AI plays through the very same reducer action as a human gesture.
  const handleAiMove = useCallback((move: MoveInput) => {
    dispatch({ type: 'playMove', from: move.from, to: move.to, promotion: move.promotion ?? null });
  }, []);

  const ai = useAiGame({
    game,
    mode,
    difficulty,
    engineKind,
    paused: pendingPromotion !== null,
    onMove: handleAiMove,
  });
  const { cancel: cancelSearch, requestMove } = ai;

  const captured = useMemo(() => capturedPieces(game), [game]);
  const status = getGameStatus(game);

  const handleRestart = useCallback(() => {
    cancelSearch();
    dispatch({ type: 'restart' });
  }, [cancelSearch]);

  const handleSelect = useCallback((square: Square) => dispatch({ type: 'click', square }), []);
  const handleMove = useCallback(
    (from: Square, to: Square) => dispatch({ type: 'playMove', from, to }),
    [],
  );
  const handlePromote = useCallback(
    (promotion: PieceType) => dispatch({ type: 'promote', promotion }),
    [],
  );
  const handleCancelPromotion = useCallback(() => dispatch({ type: 'cancelPromotion' }), []);

  // Humans are locked out while the engine is on move.
  const humanCanMove = !ai.isAiTurn;

  return (
    <div className="app">
      <GameHeader
        mode={mode}
        onModeChange={setMode}
        difficulty={difficulty}
        onDifficultyChange={setDifficulty}
        engineKind={engineKind}
        onEngineKindChange={setEngineKind}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      <main className="app-main">
        <section className="left-panel">
          <GameTimer
            white={clock.white}
            black={clock.black}
            active={activeColor}
            onRestart={handleRestart}
          />
          <MoveHistory history={game.history} />
        </section>

        <section className="board-area">
          <div className="turn-banner">
            <span className="turn-dot" data-color={game.turn} aria-hidden="true" />
            <h3>Текущий игрок {game.turn}</h3>
          </div>

          <div className="board-wrap">
            <Board
              game={game}
              selected={selected}
              legalTargets={legalTargets}
              lastMove={lastMove}
              interactive={humanCanMove}
              onSelect={handleSelect}
              onMove={handleMove}
            />
            {pendingPromotion !== null && (
              <PromotionPicker
                color={game.turn}
                onChoose={handlePromote}
                onCancel={handleCancelPromotion}
              />
            )}
          </div>

          {status !== 'ongoing' && (
            <div className="status" data-testid="game-status">
              {STATUS_TEXT[status]}
            </div>
          )}
        </section>

        <section className="right-panel">
          <CapturedPieces title="Черные фигуры" pieces={captured.black} />
          <CapturedPieces title="Белые фигуры" pieces={captured.white} />
          {modeHasAi(mode) && (
            <AiPanel
              engineName={ai.engineName}
              status={ai.status}
              isAiTurn={ai.isAiTurn}
              thinking={ai.thinking}
              difficulty={difficulty}
              info={ai.info}
              lastMove={ai.lastMove}
              message={ai.message}
              sideToMove={game.turn}
              onCancel={cancelSearch}
              onRequestMove={requestMove}
            />
          )}
        </section>
      </main>
    </div>
  );
}
