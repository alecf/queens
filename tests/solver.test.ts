import { describe, it, expect } from 'vitest';
import { solve, hasUniqueSolution } from '../src/lib/solver';
import type { Board, BoardSize } from '../src/lib/types';

function makeBoard(size: number, regions: number[][]): Board {
  return { size: size as BoardSize, regions };
}

describe('solve', () => {
  it('finds a solution for a simple 5x5 board', () => {
    const board: Board = makeBoard(5, [
      [0, 0, 1, 1, 1],
      [0, 0, 2, 2, 1],
      [3, 0, 2, 2, 1],
      [3, 3, 4, 4, 2],
      [3, 3, 4, 4, 4],
    ]);
    const solutions = solve(board, 10);
    expect(solutions.length).toBeGreaterThan(0);

    // Verify first solution is valid
    const sol = solutions[0];
    expect(sol.length).toBe(5);

    // Each row should appear exactly once
    const rows = sol.map(p => p.row).sort();
    expect(rows).toEqual([0, 1, 2, 3, 4]);

    // Each column should appear exactly once
    const cols = sol.map(p => p.col).sort();
    expect(new Set(cols).size).toBe(5);

    // Each region should appear exactly once
    const regionIds = sol.map(p => board.regions[p.row][p.col]).sort();
    expect(new Set(regionIds).size).toBe(5);

    // No two queens should be adjacent
    for (let i = 0; i < sol.length; i++) {
      for (let j = i + 1; j < sol.length; j++) {
        const dr = Math.abs(sol[i].row - sol[j].row);
        const dc = Math.abs(sol[i].col - sol[j].col);
        expect(dr > 1 || dc > 1).toBe(true);
      }
    }
  });

  it('returns empty array for unsolvable board', () => {
    // All cells in same region — can only place 1 queen
    const board: Board = makeBoard(3, [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ]);
    const solutions = solve(board, 2);
    expect(solutions.length).toBe(0);
  });

  it('respects maxSolutions limit', () => {
    const board: Board = makeBoard(5, [
      [0, 0, 1, 1, 1],
      [0, 0, 2, 2, 1],
      [3, 0, 2, 2, 1],
      [3, 3, 4, 4, 2],
      [3, 3, 4, 4, 4],
    ]);
    const solutions = solve(board, 1);
    expect(solutions.length).toBeLessThanOrEqual(1);
  });
});

describe('hasUniqueSolution', () => {
  it('returns false for board with all same region', () => {
    const board: Board = makeBoard(3, [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ]);
    expect(hasUniqueSolution(board)).toBe(false);
  });
});
