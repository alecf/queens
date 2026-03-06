/**
 * Component-level regression test for the "reload gives 0:00 best time" bug.
 *
 * When a won game is restored from localStorage cache on page reload, the App
 * must NOT record a new best time (the timer starts at 0, so it would overwrite
 * any real best with 0:00) and must NOT show the win overlay.
 */
import { render, screen, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { App } from '../src/App';
import { generateBoard } from '../src/lib/generator';
import { encodeBoard, boardToPath } from '../src/lib/encoder';
import type { CellMark } from '../src/lib/types';

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [false],
    updateServiceWorker: vi.fn(),
  }),
}));

function wonCache(
  encoded: string,
  solution: readonly { row: number; col: number }[],
  size: number,
): string {
  const marks: CellMark[][] = Array.from({ length: size }, () =>
    new Array(size).fill('empty'),
  );
  for (const { row, col } of solution) {
    marks[row][col] = 'queen';
  }
  return JSON.stringify([{ encoded, marks, timestamp: Date.now() }]);
}

describe('App — restored won state on reload', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    history.pushState(null, '', '/');
  });

  it('does not record a best time when the page is reloaded after winning', async () => {
    const { board, solution } = generateBoard(5);
    const encoded = encodeBoard(board);

    // Simulate the state left by a previous winning session
    localStorage.setItem('queens-game-cache', wonCache(encoded, solution, board.size));
    history.pushState(null, '', boardToPath(encoded));

    await act(async () => {
      render(<App />);
    });

    // Flush past the 300ms win-overlay timeout
    await act(async () => {
      vi.advanceTimersByTime(400);
    });

    // The bug: best time would have been set to 0ms (i.e. "0:00")
    expect(localStorage.getItem('queens-best-times')).toBeNull();
  });

  it('does not show the win overlay when the page is reloaded after winning', async () => {
    const { board, solution } = generateBoard(5);
    const encoded = encodeBoard(board);

    localStorage.setItem('queens-game-cache', wonCache(encoded, solution, board.size));
    history.pushState(null, '', boardToPath(encoded));

    await act(async () => {
      render(<App />);
    });

    await act(async () => {
      vi.advanceTimersByTime(400);
    });

    // The overlay has aria-label="Puzzle complete"
    expect(screen.queryByRole('dialog', { name: 'Puzzle complete' })).toBeNull();
  });

  it('does not overwrite a real best time with 0:00 on reload', async () => {
    const { board, solution } = generateBoard(5);
    const encoded = encodeBoard(board);

    // Pre-existing best time of 3 minutes (180000ms)
    localStorage.setItem('queens-best-times', JSON.stringify({ 5: 180000 }));
    localStorage.setItem('queens-game-cache', wonCache(encoded, solution, board.size));
    history.pushState(null, '', boardToPath(encoded));

    await act(async () => {
      render(<App />);
    });

    await act(async () => {
      vi.advanceTimersByTime(400);
    });

    const stored = JSON.parse(localStorage.getItem('queens-best-times')!);
    expect(stored[5]).toBe(180000); // unchanged
  });
});
