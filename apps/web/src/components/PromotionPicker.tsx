import type { MouseEvent } from 'react';
import type { Color, PieceType } from '@chess/chess-core';
import { PIECE_NAMES, pieceImageFor } from '../game/pieceImages';

const OPTIONS: readonly PieceType[] = ['queen', 'rook', 'bishop', 'knight'];

interface PromotionPickerProps {
  color: Color;
  onChoose: (type: PieceType) => void;
  onCancel: () => void;
}

export function PromotionPicker({ color, onChoose, onCancel }: PromotionPickerProps) {
  const stop = (event: MouseEvent<HTMLDivElement>): void => event.stopPropagation();

  return (
    <div className="promotion-overlay" onClick={onCancel}>
      <div className="promotion-card" onClick={stop}>
        <p>Выберите фигуру</p>
        <div className="promotion-options" data-promote-color={color}>
          {OPTIONS.map((type) => (
            <button
              key={type}
              type="button"
              title={PIECE_NAMES[type]}
              onClick={() => onChoose(type)}
            >
              <img src={pieceImageFor(color, type)} alt={PIECE_NAMES[type]} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
