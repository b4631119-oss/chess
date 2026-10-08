import type { CapturedPiece } from '../game/derived';
import { PIECE_NAMES, pieceImageFor } from '../game/pieceImages';

interface CapturedPiecesProps {
  title: string;
  pieces: ReadonlyArray<CapturedPiece>;
}

export function CapturedPieces({ title, pieces }: CapturedPiecesProps) {
  return (
    <div className="lost panel">
      <h3 className="panel-title">{title}</h3>
      {pieces.length === 0 ? (
        <p className="captured-empty">—</p>
      ) : (
        <div className="captured-chips">
          {pieces.map((piece) => (
            <span key={piece.id} className="captured-chip">
              <img
                src={pieceImageFor(piece.color, piece.type)}
                alt=""
                width={18}
                height={18}
                title={PIECE_NAMES[piece.type]}
              />
              {PIECE_NAMES[piece.type]}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
