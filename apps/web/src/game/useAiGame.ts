import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getLegalMoves,
  INITIAL_FEN,
  isGameOver,
  type GameState,
  type MoveInput,
} from '@chess/chess-core';
import { createEngine } from '../ai/createEngine';
import { difficultyPreset } from '../ai/difficulty';
import { pickRandomMove } from '../ai/fallback';
import { isAiColor, modeHasAi } from '../ai/modes';
import type { AiStatus, Difficulty, Engine, EngineKind, GameMode, SearchInfo } from '../ai/types';
import { resolveEngineMove, toUci } from '../ai/uci';
import { ENGINE_LABELS } from '../ai/workers';

export interface AiController {
  readonly status: AiStatus;
  readonly thinking: boolean;
  /** True when the side to move is engine-controlled and a search is expected. */
  readonly isAiTurn: boolean;
  readonly engineKind: EngineKind;
  readonly engineName: string;
  readonly info: SearchInfo | null;
  readonly lastMove: string | null;
  readonly message: string | null;
  cancel: () => void;
  /** Ask the engine to think again (used after a cancel or an error). */
  requestMove: () => void;
}

interface Options {
  game: GameState;
  mode: GameMode;
  difficulty: Difficulty;
  engineKind: EngineKind;
  /** True while a promotion dialog is open. */
  paused: boolean;
  onMove: (move: MoveInput) => void;
}

/**
 * Owns an `Engine` instance and plays its moves through the game reducer.
 *
 * Everything the AI does is validated against `@chess/chess-core`; if the engine
 * answers with something unplayable the hook logs it and plays a random legal
 * move instead of crashing or desyncing the board.
 */
export function useAiGame({
  game,
  mode,
  difficulty,
  engineKind,
  paused,
  onMove,
}: Options): AiController {
  const [effectiveKind, setEffectiveKind] = useState<EngineKind>(engineKind);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<AiStatus>('loading');
  const [info, setInfo] = useState<SearchInfo | null>(null);
  const [lastMove, setLastMove] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const engineRef = useRef<Engine | null>(null);
  const generationRef = useRef(0);
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;

  // Follow the requested engine kind (also re-armed after a fallback).
  useEffect(() => {
    setEffectiveKind(engineKind);
  }, [engineKind]);

  // Engine lifecycle: create, initialise, tear down.
  useEffect(() => {
    let disposed = false;
    const engine = createEngine(effectiveKind);
    engineRef.current = engine;
    setReady(false);
    setStatus('loading');
    setMessage(null);

    let unsubscribe: (() => void) | null = null;

    engine
      .init()
      .then(() => {
        if (disposed) {
          engine.quit();
          return;
        }
        unsubscribe = engine.onInfo?.((next) => {
          if (!disposed) setInfo(next);
        }) ?? null;
        setReady(true);
        setStatus('idle');
      })
      .catch((error: unknown) => {
        if (disposed) return;
        const reason = error instanceof Error ? error.message : String(error);
        if (effectiveKind === 'stockfish') {
          // Never fail silently: tell the user and fall back to the built-in engine.
          setMessage(`Stockfish не загрузился (${reason}) — переключаюсь на встроенный minimax.`);
          setEffectiveKind('local');
        } else {
          setStatus('error');
          setMessage(reason);
        }
      });

    return () => {
      disposed = true;
      unsubscribe?.();
      engine.quit();
      engineRef.current = null;
      setReady(false);
    };
  }, [effectiveKind]);

  const isAiTurn = ready && modeHasAi(mode) && !paused && !isGameOver(game) && isAiColor(mode, game.turn);

  // One search per AI turn. Any state change aborts the in-flight search, so a
  // restart or a checkmate can never be followed by a stale move.
  useEffect(() => {
    if (!isAiTurn) return;
    const engine = engineRef.current;
    if (engine === null) return;

    const generation = ++generationRef.current;
    let aborted = false;

    setStatus('thinking');
    setInfo(null);
    engine.setPosition(
      INITIAL_FEN,
      game.history.map((move) => toUci(move)),
    );

    engine
      .go(difficultyPreset(difficulty).options)
      .then((result) => {
        if (aborted || generation !== generationRef.current) return;

        const legalMoves = getLegalMoves(game);
        const resolved = resolveEngineMove(result.bestMove, legalMoves);
        setLastMove(result.bestMove);

        if (resolved !== null) {
          onMoveRef.current({ from: resolved.from, to: resolved.to, promotion: resolved.promotion });
          return;
        }

        // Requirement: never apply an unplayable answer — log it and play a
        // random legal move instead.
        console.warn(`[ai] ${effectiveKind} returned a non-playable move: ${result.bestMove}`);
        setMessage(`Движок вернул недопустимый ход «${result.bestMove}» — сыгран случайный легальный.`);
        const random = pickRandomMove(legalMoves);
        if (random !== null) {
          onMoveRef.current({ from: random.from, to: random.to, promotion: random.promotion ?? null });
        }
      })
      .catch((error: unknown) => {
        if (aborted) return;
        setStatus('error');
        setMessage(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        if (!aborted && generation === generationRef.current) setStatus('idle');
      });

    return () => {
      aborted = true;
      engine.stop();
    };
  }, [isAiTurn, game, difficulty, effectiveKind, nonce]);

  const cancel = useCallback(() => {
    generationRef.current += 1;
    engineRef.current?.stop();
    setStatus('idle');
    setMessage('Поиск отменён.');
  }, []);

  const requestMove = useCallback(() => {
    setMessage(null);
    setNonce((value) => value + 1);
  }, []);

  return {
    status,
    thinking: status === 'thinking',
    isAiTurn,
    engineKind: effectiveKind,
    engineName: ENGINE_LABELS[effectiveKind],
    info,
    lastMove,
    message,
    cancel,
    requestMove,
  };
}
