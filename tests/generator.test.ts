import { describe, it, expect } from 'vitest';
import { generateBoard } from '../src/lib/generator';
import { solve } from '../src/lib/solver';
import { isComplete } from '../src/lib/validator';
import type { BoardSize, CellMark } from '../src/lib/types';

describe('generateBoard', () => {
  const sizes: BoardSize[] = [5, 6, 7, 8, 9];

  for (const size of sizes) {
    describe(`size ${size}`, () => {
      it('generates a valid board with a unique solution', () => {
        const { board, solution } = generateBoard(size);

        // Board has correct size
        expect(board.size).toBe(size);
        expect(board.regions.length).toBe(size);
        expect(board.regions[0].length).toBe(size);

        // All region IDs are in range [0, N-1]
        for (let r = 0; r < size; r++) {
          for (let c = 0; c < size; c++) {
            expect(board.regions[r][c]).toBeGreaterThanOrEqual(0);
            expect(board.regions[r][c]).toBeLessThan(size);
          }
        }

        // Each region has at least 1 cell
        const regionCounts = new Array(size).fill(0);
        for (let r = 0; r < size; r++) {
          for (let c = 0; c < size; c++) {
            regionCounts[board.regions[r][c]]++;
          }
        }
        for (let i = 0; i < size; i++) {
          expect(regionCounts[i]).toBeGreaterThanOrEqual(1);
        }

        // Solution has N queens
        expect(solution.length).toBe(size);

        // Solution is valid (passes isComplete)
        const marks: CellMark[][] = Array.from({ length: size }, () =>
          new Array(size).fill('empty')
        );
        for (const pos of solution) {
          marks[pos.row][pos.col] = 'queen';
        }
        expect(isComplete(board, marks)).toBe(true);

        // Solution is unique
        const { solutions } = solve(board, 2);
        expect(solutions.length).toBe(1);
      });
    });
  }

  it('generates different boards on successive calls', () => {
    const { board: board1 } = generateBoard(5);
    const { board: board2 } = generateBoard(5);
    // Extremely unlikely to be identical due to randomization
    const flat1 = board1.regions.flat().join(',');
    const flat2 = board2.regions.flat().join(',');
    // We can't guarantee they're different, but run 3 tries
    let foundDifferent = flat1 !== flat2;
    if (!foundDifferent) {
      const { board: board3 } = generateBoard(5);
      foundDifferent = board3.regions.flat().join(',') !== flat1;
    }
    expect(foundDifferent).toBe(true);
  });
});
