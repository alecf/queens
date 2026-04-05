import { useCallback, useRef, useMemo, useLayoutEffect } from 'react';
import { Cell } from './Cell';
import { usePointerGesture } from '../hooks/usePointerGesture';
import type { CellMark, GameState, Position } from '../lib/types';

interface BoardProps {
  state: GameState;
  onSetMark: (pos: Position, mark: CellMark) => void;
  onSetMarks: (changes: readonly { pos: Position; mark: CellMark }[]) => void;
}

function nextMark(current: CellMark): CellMark {
  switch (current) {
    case 'empty': return 'x';
    case 'x': return 'queen';
    case 'queen': return 'empty';
  }
}

export function Board({ state, onSetMark, onSetMarks }: BoardProps) {
  const boardRef = useRef<HTMLDivElement>(null);
  const dragChangesRef = useRef<Map<string, { pos: Position; mark: CellMark }>>(new Map());
  const dragModeRef = useRef<'set-x' | 'clear' | null>(null);

  // iOS Safari bug: aspect-ratio on a grid container doesn't correctly constrain
  // auto row heights when items also use aspect-ratio, causing cells to overflow
  // the container and misalign with the SVG overlay. Fix by syncing height to width.
  useLayoutEffect(() => {
    const board = boardRef.current;
    if (!board) return;
    const ro = new ResizeObserver(() => {
      board.style.height = `${board.offsetWidth}px`;
    });
    ro.observe(board);
    return () => ro.disconnect();
  }, []);

  const { board, marks, conflicts, phase } = state;
  const { size } = board;

  // Pre-compute conflict cell set for O(1) lookup
  const conflictCells = useMemo(() => {
    const set = new Set<string>();
    // Row conflicts: all queen cells in conflicting rows
    for (const row of conflicts.rows) {
      for (let c = 0; c < size; c++) {
        if (marks[row][c] === 'queen') set.add(`${row},${c}`);
      }
    }
    // Column conflicts
    for (const col of conflicts.cols) {
      for (let r = 0; r < size; r++) {
        if (marks[r][col] === 'queen') set.add(`${r},${col}`);
      }
    }
    // Region conflicts
    for (const regionId of conflicts.regions) {
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (board.regions[r][c] === regionId && marks[r][c] === 'queen') {
            set.add(`${r},${c}`);
          }
        }
      }
    }
    // Adjacency conflicts
    for (const [a, b] of conflicts.adjacentPairs) {
      set.add(`${a.row},${a.col}`);
      set.add(`${b.row},${b.col}`);
    }
    return set;
  }, [conflicts, marks, board.regions, size]);

  const getCellAt = useCallback(
    (x: number, y: number): { pos: Position; mark: CellMark } | null => {
      const el = document.elementFromPoint(x, y);
      if (!el) return null;
      const cellEl = (el as HTMLElement).closest('[data-row]') as HTMLElement | null;
      if (!cellEl) return null;
      const row = parseInt(cellEl.dataset.row!, 10);
      const col = parseInt(cellEl.dataset.col!, 10);
      if (isNaN(row) || isNaN(col)) return null;
      return { pos: { row, col }, mark: marks[row][col] };
    },
    [marks],
  );

  const onTap = useCallback(
    (pos: Position) => {
      if (phase === 'won') return;
      const current = marks[pos.row][pos.col];
      onSetMark(pos, nextMark(current));
    },
    [marks, onSetMark, phase],
  );

  const onDragStart = useCallback(
    (pos: Position, startMark: CellMark) => {
      if (phase === 'won') return;
      dragChangesRef.current.clear();

      if (startMark === 'queen') {
        // Drag from queen: treat as tap only
        dragModeRef.current = null;
        return;
      }

      // empty → set x; x → clear
      dragModeRef.current = startMark === 'empty' ? 'set-x' : 'clear';

      // Apply to starting cell
      const newMark: CellMark = dragModeRef.current === 'set-x' ? 'x' : 'empty';
      if (marks[pos.row][pos.col] !== newMark && marks[pos.row][pos.col] !== 'queen') {
        dragChangesRef.current.set(`${pos.row},${pos.col}`, { pos, mark: newMark });
      }
    },
    [marks, phase],
  );

  const onDragMove = useCallback(
    (pos: Position) => {
      if (!dragModeRef.current) return;
      if (phase === 'won') return;
      // Skip queens during drag
      if (marks[pos.row][pos.col] === 'queen') return;

      const newMark: CellMark = dragModeRef.current === 'set-x' ? 'x' : 'empty';
      const key = `${pos.row},${pos.col}`;
      if (marks[pos.row][pos.col] !== newMark) {
        dragChangesRef.current.set(key, { pos, mark: newMark });
      }
    },
    [marks, phase],
  );

  const onDragEnd = useCallback(() => {
    if (dragChangesRef.current.size > 0) {
      onSetMarks(Array.from(dragChangesRef.current.values()));
    }
    dragChangesRef.current.clear();
    dragModeRef.current = null;
  }, [onSetMarks]);

  const gesture = usePointerGesture({
    onTap,
    onDragStart,
    onDragMove,
    onDragEnd,
    getCellAt,
  });

  // Compute SVG line segments for region borders (avoids CSS corner bevel artifacts)
  const regionBorderSegments = useMemo(() => {
    const segs: { x1: number; y1: number; x2: number; y2: number }[] = [];
    // Horizontal segments: boundary between row r-1 and row r
    for (let r = 0; r <= size; r++) {
      for (let c = 0; c < size; c++) {
        if (r === 0 || r === size || board.regions[r - 1][c] !== board.regions[r][c]) {
          segs.push({ x1: c, y1: r, x2: c + 1, y2: r });
        }
      }
    }
    // Vertical segments: boundary between col c-1 and col c
    for (let c = 0; c <= size; c++) {
      for (let r = 0; r < size; r++) {
        if (c === 0 || c === size || board.regions[r][c - 1] !== board.regions[r][c]) {
          segs.push({ x1: c, y1: r, x2: c, y2: r + 1 });
        }
      }
    }
    return segs;
  }, [board.regions, size]);

  return (
    <div
      ref={boardRef}
      className="board"
      role="grid"
      aria-label={`${size} by ${size} Queens puzzle board`}
      style={{
        gridTemplateColumns: `repeat(${size}, 1fr)`,
        gridTemplateRows: `repeat(${size}, 1fr)`,
        touchAction: 'none',
        userSelect: 'none',
      } as React.CSSProperties}
      onPointerDown={gesture.onPointerDown}
      onPointerMove={gesture.onPointerMove}
      onPointerUp={gesture.onPointerUp}
      onPointerCancel={gesture.onPointerCancel}
    >
      {Array.from({ length: size }, (_, row) =>
        Array.from({ length: size }, (_, col) => (
          <div key={`${row}-${col}`} className="cell-wrapper">
            <Cell
              row={row}
              col={col}
              mark={marks[row][col]}
              regionId={board.regions[row][col]}
              isConflict={conflictCells.has(`${row},${col}`)}
              isWon={phase === 'won'}
            />
          </div>
        )),
      )}
      <svg
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          overflow: 'visible',
        }}
        viewBox={`0 0 ${size} ${size}`}
        preserveAspectRatio="none"
      >
        {regionBorderSegments.map((seg, i) => (
          <line
            key={i}
            x1={seg.x1}
            y1={seg.y1}
            x2={seg.x2}
            y2={seg.y2}
            stroke="var(--color-cell-border)"
            strokeWidth={5}
            vectorEffect="non-scaling-stroke"
            strokeLinecap="square"
          />
        ))}
      </svg>
    </div>
  );
}
