import { useRef, useCallback } from 'react';
import type { CellMark, Position } from '../lib/types';

const DRAG_THRESHOLD = 8; // pixels

interface GestureCallbacks {
  onTap: (pos: Position) => void;
  onDragStart: (pos: Position, startMark: CellMark) => void;
  onDragMove: (pos: Position) => void;
  onDragEnd: () => void;
  getCellAt: (x: number, y: number) => { pos: Position; mark: CellMark } | null;
}

export function usePointerGesture(callbacks: GestureCallbacks) {
  const activePointerIdRef = useRef<number | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const startCellRef = useRef<Position | null>(null);
  const isDraggingRef = useRef(false);
  const lastCellRef = useRef<string | null>(null);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      // Only track primary pointer
      if (activePointerIdRef.current !== null) return;

      const cell = callbacks.getCellAt(e.clientX, e.clientY);
      if (!cell) return;

      activePointerIdRef.current = e.pointerId;
      startPosRef.current = { x: e.clientX, y: e.clientY };
      startCellRef.current = cell.pos;
      isDraggingRef.current = false;
      lastCellRef.current = `${cell.pos.row},${cell.pos.col}`;

      // Capture to the board element for reliable tracking
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [callbacks],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (activePointerIdRef.current !== e.pointerId) return;
      if (!startPosRef.current || !startCellRef.current) return;

      const dx = e.clientX - startPosRef.current.x;
      const dy = e.clientY - startPosRef.current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (!isDraggingRef.current && distance >= DRAG_THRESHOLD) {
        isDraggingRef.current = true;
        // Get the starting cell's current mark for drag mode
        const startCell = callbacks.getCellAt(
          startPosRef.current.x,
          startPosRef.current.y,
        );
        if (startCell) {
          callbacks.onDragStart(startCell.pos, startCell.mark);
        }
      }

      if (isDraggingRef.current) {
        const cell = callbacks.getCellAt(e.clientX, e.clientY);
        if (cell) {
          const cellKey = `${cell.pos.row},${cell.pos.col}`;
          if (cellKey !== lastCellRef.current) {
            lastCellRef.current = cellKey;
            callbacks.onDragMove(cell.pos);
          }
        }
      }
    },
    [callbacks],
  );

  const finishGesture = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (activePointerIdRef.current !== e.pointerId) return;

      if (!isDraggingRef.current && startCellRef.current) {
        callbacks.onTap(startCellRef.current);
      } else if (isDraggingRef.current) {
        callbacks.onDragEnd();
      }

      // Reset state
      activePointerIdRef.current = null;
      startPosRef.current = null;
      startCellRef.current = null;
      isDraggingRef.current = false;
      lastCellRef.current = null;
    },
    [callbacks],
  );

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: finishGesture,
    onPointerCancel: finishGesture,
  };
}
