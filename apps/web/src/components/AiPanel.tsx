import type { Color } from '@chess/chess-core';
import { describeOptions, difficultyPreset } from '../ai/difficulty';
import type { AiStatus, Difficulty, SearchInfo } from '../ai/types';
import { formatScore, toWhitePerspective } from '../ai/uci';

interface AiPanelProps {
  engineName: string;
  status: AiStatus;
  isAiTurn: boolean;
  thinking: boolean;
  difficulty: Difficulty;
  info: SearchInfo | null;
  lastMove: string | null;
  message: string | null;
  sideToMove: Color;
  onCancel: () => void;
  onRequestMove: () => void;
}

const STATUS_TEXT: Record<AiStatus, string> = {
  loading: 'Загрузка движка…',
  idle: 'Ожидание',
  thinking: 'AI думает…',
  error: 'Ошибка движка',
};

export function AiPanel({
  engineName,
  status,
  isAiTurn,
  thinking,
  difficulty,
  info,
  lastMove,
  message,
  sideToMove,
  onCancel,
  onRequestMove,
}: AiPanelProps) {
  const preset = difficultyPreset(difficulty);
  const whiteScore = info?.score === undefined ? undefined : toWhitePerspective(info.score, sideToMove);
  const bestMove = info?.pv[0] ?? lastMove ?? '—';
  const depth = info?.depth;

  return (
    <div className="ai-panel panel" data-testid="ai-panel" data-thinking={thinking}>
      <h3 className="panel-title">Движок AI</h3>

      <dl className="ai-facts">
        <dt>Движок</dt>
        <dd data-testid="ai-engine">{engineName}</dd>
        <dt>Лимит</dt>
        <dd data-testid="ai-limit">{describeOptions(preset.options)}</dd>
        <dt>Оценка (белые)</dt>
        <dd data-testid="ai-eval">{formatScore(whiteScore)}</dd>
        <dt>Лучший ход</dt>
        <dd data-testid="ai-bestmove">{bestMove}</dd>
        <dt>Глубина</dt>
        <dd data-testid="ai-depth">{depth === undefined ? '—' : depth}</dd>
      </dl>

      <div className="ai-status" data-testid="ai-status">
        {thinking && <span className="ai-spinner" aria-hidden="true" />}
        <span>{STATUS_TEXT[status]}</span>
      </div>

      <div className="ai-actions">
        {thinking ? (
          <button type="button" className="danger" onClick={onCancel} data-testid="ai-cancel">
            Отменить
          </button>
        ) : (
          isAiTurn && (
            <button type="button" onClick={onRequestMove} data-testid="ai-request">
              Ход AI
            </button>
          )
        )}
      </div>

      {message !== null && (
        <p className="ai-message" data-testid="ai-message">
          {message}
        </p>
      )}
    </div>
  );
}
