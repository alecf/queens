/**
 * Regression tests for the "reload gives 0:00 best time" bug.
 *
 * When a completed game is restored from cache on page reload, the game state
 * is reconstructed with phase='won'. The App must NOT re-record a best time in
 * this case, because the timer starts at 0 and would overwrite the real best.
 *
 * The App fix (hasHandledWinRef initialized to state.phase === 'won') depends on
 * getInitialState() / LOAD_BOARD correctly reporting isComplete=true for restored
 * winning marks. These tests verify that foundation.
 */
import { describe, it, expect } from 'vitest';
import { generateBoard } from '../src/lib/generator';
import { solve } from '../src/lib/solver';
import { isComplete, validateMarks, hasConflicts } from '../src/lib/validator';
import type { CellMark } from '../src/lib/types';

function marksFromSolution(size: number, solution: readonly { row: number; col: number }[]): CellMark[][] {
  const marks: CellMark[][] = Array.from({ length: size }, () => new Array(size).fill('empty'));
  for (const { row, col } of solution) {
    marks[row][col] = 'queen';
  }
  return marks;
}

describe('win state restoration', () => {
  it('isComplete returns true for a freshly solved board — the condition that sets phase=won on restore', () => {
    const { board, solution } = generateBoard(5);
    const marks = marksFromSolution(board.size, solution);
    expect(isComplete(board, marks)).toBe(true);
  });

  it('isComplete returns false for an empty board — no spurious win on fresh load', () => {
    const { board } = generateBoard(5);
    const emptyMarks: CellMark[][] = Array.from({ length: board.size }, () =>
      new Array(board.size).fill('empty'),
    );
    expect(isComplete(board, emptyMarks)).toBe(false);
  });

  it('solution marks have no conflicts — validates the phase=won path taken during restore', () => {
    const { board, solution } = generateBoard(6);
    const marks = marksFromSolution(board.size, solution);
    const conflicts = validateMarks(board, marks);
    expect(hasConflicts(conflicts)).toBe(false);
  });

  it('solution marks from solver always satisfy isComplete for sizes 5-8', () => {
    for (const size of [5, 6, 7, 8] as const) {
      const { board } = generateBoard(size);
      const solutions = solve(board, 1);
      expect(solutions.length).toBe(1);
      const marks = marksFromSolution(size, solutions[0]);
      expect(isComplete(board, marks)).toBe(true);
    }
  });

  it('partial marks (fewer than N queens) are not complete — no premature win during restore', () => {
    const { board, solution } = generateBoard(5);
    const marks = marksFromSolution(board.size, solution);
    // Remove one queen to simulate partial progress
    const [first] = solution;
    marks[first.row][first.col] = 'empty';
    expect(isComplete(board, marks)).toBe(false);
  });
});
