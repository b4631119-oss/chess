import type { Move } from '@chess/chess-core';

interface MoveHistoryProps {
  history: ReadonlyArray<Move>;
}

interface HistoryRow {
  number: number;
  white?: string;
  black?: string;
}

function toRows(history: ReadonlyArray<Move>): HistoryRow[] {
  const rows: HistoryRow[] = [];
  history.forEach((move, index) => {
    if (index % 2 === 0) {
      rows.push({ number: index / 2 + 1, white: move.san });
    } else {
      const last = rows[rows.length - 1];
      if (last !== undefined) last.black = move.san;
    }
  });
  return rows;
}

export function MoveHistory({ history }: MoveHistoryProps) {
  const rows = toRows(history);

  return (
    <div className="history panel" data-testid="history" data-plys={history.length}>
      <h3 className="panel-title">История ходов</h3>
      {rows.length === 0 ? (
        <p className="history-empty">Ходов пока нет</p>
      ) : (
        <ol className="history-list">
          {rows.map((row) => (
            <li key={row.number}>
              <span className="history-number">{row.number}.</span>
              <span className="history-white">{row.white ?? ''}</span>
              <span className="history-black">{row.black ?? ''}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
