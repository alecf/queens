import { memo } from 'react';
import type { CellMark } from '../lib/types';

interface CellProps {
  row: number;
  col: number;
  mark: CellMark;
  regionId: number;
  isConflict: boolean;
  isWon: boolean;
  isHinted: boolean;
  hintKey: number;
}

export const Cell = memo(function Cell({
  row,
  col,
  mark,
  regionId,
  isConflict,
  isWon,
  isHinted,
  hintKey,
}: CellProps) {
  const className = [
    'cell',
    `region-${regionId}`,
    mark !== 'empty' ? `cell-${mark}` : '',
    isConflict ? 'cell-conflict' : '',
    isWon ? 'cell-won' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={className}
      data-row={row}
      data-col={col}
      role="gridcell"
      aria-label={`Row ${row + 1}, Column ${col + 1}, ${mark === 'empty' ? 'empty' : mark}, Region ${regionId + 1}`}
    >
      {mark === 'queen' && <span className="cell-icon">♛</span>}
      {mark === 'x' && <span className="cell-icon cell-x">✕</span>}
      {isHinted && <div key={hintKey} className="cell-hint-overlay" />}
    </div>
  );
});
