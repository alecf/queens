import type { Board, Position } from './types';

const ADJACENT_OFFSETS: readonly [number, number][] = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1],           [0, 1],
  [1, -1],  [1, 0],  [1, 1],
];

/**
 * Solve a Queens puzzle using backtracking with MRV ordering and forward checking.
 * Returns up to `maxSolutions` solutions (default 2 for uniqueness checking).
 */
export function solve(board: Board, maxSolutions = 2): Position[][] {
  const { size, regions } = board;
  const solutions: Position[][] = [];

  // Track which columns and regions are used
  const usedCols = new Set<number>();
  const usedRegions = new Set<number>();

  // Track which cells are blocked by adjacency
  const blocked = Array.from({ length: size }, () => new Array<number>(size).fill(0));

  // Current placement
  const placement: Position[] = [];

  // For each row, compute valid columns (respecting region constraint)
  function getValidCols(row: number): number[] {
    const valid: number[] = [];
    for (let col = 0; col < size; col++) {
      if (usedCols.has(col)) continue;
      if (usedRegions.has(regions[row][col])) continue;
      if (blocked[row][col] > 0) continue;
      valid.push(col);
    }
    return valid;
  }

  // Find the unplaced row with the fewest valid columns (MRV heuristic)
  function selectRow(placedRows: Set<number>): { row: number; validCols: number[] } | null {
    let bestRow = -1;
    let bestCols: number[] = [];
    let bestCount = Infinity;

    for (let row = 0; row < size; row++) {
      if (placedRows.has(row)) continue;
      const valid = getValidCols(row);
      if (valid.length === 0) return null; // Forward check failed
      if (valid.length < bestCount) {
        bestCount = valid.length;
        bestRow = row;
        bestCols = valid;
      }
    }

    if (bestRow === -1) return null;
    return { row: bestRow, validCols: bestCols };
  }

  function placeQueen(row: number, col: number): void {
    usedCols.add(col);
    usedRegions.add(regions[row][col]);
    for (const [dr, dc] of ADJACENT_OFFSETS) {
      const nr = row + dr;
      const nc = col + dc;
      if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
        blocked[nr][nc]++;
      }
    }
    placement.push({ row, col });
  }

  function removeQueen(row: number, col: number): void {
    usedCols.delete(col);
    usedRegions.delete(regions[row][col]);
    for (const [dr, dc] of ADJACENT_OFFSETS) {
      const nr = row + dr;
      const nc = col + dc;
      if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
        blocked[nr][nc]--;
      }
    }
    placement.pop();
  }

  let nodeCount = 0;
  const MAX_NODES = 100_000;

  function backtrack(placedRows: Set<number>): void {
    if (solutions.length >= maxSolutions) return;
    if (++nodeCount > MAX_NODES) return;

    if (placement.length === size) {
      solutions.push([...placement]);
      return;
    }

    const choice = selectRow(placedRows);
    if (!choice) return;

    const { row, validCols } = choice;
    placedRows.add(row);

    for (const col of validCols) {
      if (solutions.length >= maxSolutions) break;
      placeQueen(row, col);
      backtrack(placedRows);
      removeQueen(row, col);
    }

    placedRows.delete(row);
  }

  backtrack(new Set());
  return solutions;
}

/**
 * Check if a board has exactly one solution.
 */
export function hasUniqueSolution(board: Board): boolean {
  return solve(board, 2).length === 1;
}
