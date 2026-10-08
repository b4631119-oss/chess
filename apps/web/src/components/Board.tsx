import type { GameState, Move, Square as SquareIndex } from '@chess/chess-core';
import { BOARD_SQUARES, squareColorClass } from '../game/derived';
import { Square } from './Square';

interface BoardProps {
  game: GameState;
  selected: SquareIndex | null;
  legalTargets: ReadonlyArray<Move>;
  lastMove: Move | null;
  /** False while the engine controls the side to move. */
  interactive: boolean;
  onSelect: (square: SquareIndex) => void;
  onMove: (from: SquareIndex, to: SquareIndex) => void;
}

/** Render order: rank 8 is the top row, file a the left column. */
const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
const RANKS = [8, 7, 6, 5, 4, 3, 2, 1] as const;

export function Board({
  game,
  selected,
  legalTargets,
  lastMove,
  interactive,
  onSelect,
  onMove,
}: BoardProps) {
  return (
    <div className="board-shell">
      <div className="board-ranks" aria-hidden="true">
        {RANKS.map((rank) => (
          <span key={rank}>{rank}</span>
        ))}
      </div>

      <div className="board" data-testid="board">
        {BOARD_SQUARES.map((square) => {
          const piece = game.board[square] ?? null;
          const target = legalTargets.find((move) => move.to === square);

          return (
            <Square
              key={square}
              square={square}
              piece={piece}
              dark={squareColorClass(square) === 'black'}
              selected={selected === square}
              legalTarget={target !== undefined}
              captureTarget={target !== undefined && target.captured !== null}
              lastMove={lastMove !== null && (lastMove.from === square || lastMove.to === square)}
              draggable={piece !== null && piece.color === game.turn}
              interactive={interactive}
              onSelect={onSelect}
              onMove={onMove}
            />
          );
        })}
      </div>

      <div className="board-files" aria-hidden="true">
        {FILES.map((file) => (
          <span key={file}>{file}</span>
        ))}
      </div>
    </div>
  );
}
