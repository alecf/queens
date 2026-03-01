import type { Board, BoardSize, Position } from './types';
import { solve } from './solver';

const ADJACENT_OFFSETS: readonly [number, number][] = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1],           [0, 1],
  [1, -1],  [1, 0],  [1, 1],
];

const DIRS: readonly [number, number][] = [[0, 1], [0, -1], [1, 0], [-1, 0]];

/**
 * Generate a valid Queens puzzle with a unique solution.
 * Strategy:
 * 1. Place queens satisfying row/col/adjacency constraints
 * 2. Grow initial regions via BFS (usually has multiple solutions)
 * 3. Iteratively swap boundary cells between regions to eliminate alternative solutions
 * Budget: up to ~1 second.
 */
export function generateBoard(size: BoardSize): { board: Board; solution: Position[] } {
  const MAX_OUTER_RETRIES = 20;

  for (let outer = 0; outer < MAX_OUTER_RETRIES; outer++) {
    const solution = placeQueens(size);
    if (!solution) continue;

    const regions = growRegions(size, solution);
    if (!regions) continue;

    const board: Board = { size, regions };
    const refined = refineForUniqueness(board, solution);
    if (refined) return refined;
  }

  throw new Error(`Failed to generate a unique board of size ${size}`);
}

/**
 * Iteratively swap boundary cells between regions until the board has a unique solution.
 * Returns null if refinement fails within budget.
 */
function refineForUniqueness(
  board: Board,
  targetSolution: Position[],
): { board: Board; solution: Position[] } | null {
  const { size } = board;
  // Work with a mutable copy of regions
  const regions = board.regions.map(row => [...row]);
  const MAX_SWAPS = 1000;

  for (let swap = 0; swap < MAX_SWAPS; swap++) {
    const currentBoard: Board = { size, regions: regions.map(r => [...r]) };
    const solutions = solve(currentBoard, 2);

    if (solutions.length === 1) {
      return { board: currentBoard, solution: solutions[0] };
    }

    if (solutions.length === 0) {
      return null; // Broken board, give up
    }

    // Find a cell where the two solutions differ and swap its region
    const sol1 = solutions[0];
    const sol2 = solutions[1];

    // Build queen maps for each solution
    const queenMap1 = new Set(sol1.map(p => p.row * size + p.col));
    const queenMap2 = new Set(sol2.map(p => p.row * size + p.col));

    // Find cells that differ: queen in sol1 but not sol2, or vice versa
    const diffCells: Position[] = [];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const key = r * size + c;
        if (queenMap1.has(key) !== queenMap2.has(key)) {
          diffCells.push({ row: r, col: c });
        }
      }
    }

    if (diffCells.length === 0) return null;

    // Pick a random diff cell and try to change its region to invalidate sol2
    // while keeping sol1 valid
    shuffle(diffCells);

    let swapped = false;
    for (const cell of diffCells) {
      // Find neighboring regions (different from current)
      const currentRegion = regions[cell.row][cell.col];
      const neighborRegions = new Set<number>();
      for (const [dr, dc] of DIRS) {
        const nr = cell.row + dr;
        const nc = cell.col + dc;
        if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
          const nRegion = regions[nr][nc];
          if (nRegion !== currentRegion) {
            neighborRegions.add(nRegion);
          }
        }
      }

      for (const newRegion of neighborRegions) {
        // Try swapping this cell to the new region
        const oldRegion = regions[cell.row][cell.col];
        regions[cell.row][cell.col] = newRegion;

        // Check that both regions remain connected
        if (isRegionConnected(regions, size, oldRegion) &&
            isRegionConnected(regions, size, newRegion)) {
          // Check that the target solution queen is still in its correct region
          // (the queen for oldRegion must still be in oldRegion,
          //  and the queen for newRegion must still be in newRegion)
          const queenForOld = targetSolution[oldRegion];
          const queenForNew = targetSolution[newRegion];
          if (regions[queenForOld.row][queenForOld.col] === oldRegion &&
              regions[queenForNew.row][queenForNew.col] === newRegion) {
            swapped = true;
            break;
          }
        }

        // Revert
        regions[cell.row][cell.col] = oldRegion;
      }

      if (swapped) break;
    }

    if (!swapped) {
      // Try a random boundary swap instead
      const boundary = getBoundaryCell(regions, size);
      if (!boundary) return null;

      const { row, col, neighborRegion } = boundary;
      const oldRegion = regions[row][col];
      regions[row][col] = neighborRegion;

      // Check connectivity and queen placement
      if (!isRegionConnected(regions, size, oldRegion) ||
          !isRegionConnected(regions, size, neighborRegion) ||
          regions[targetSolution[oldRegion].row][targetSolution[oldRegion].col] !== oldRegion ||
          regions[targetSolution[neighborRegion].row][targetSolution[neighborRegion].col] !== neighborRegion) {
        regions[row][col] = oldRegion; // Revert
      }
    }
  }

  // Check one last time
  const finalBoard: Board = { size, regions: regions.map(r => [...r]) };
  const finalSolutions = solve(finalBoard, 2);
  if (finalSolutions.length === 1) {
    return { board: finalBoard, solution: finalSolutions[0] };
  }

  return null;
}

/**
 * Check if a specific region is still connected (4-directionally).
 */
function isRegionConnected(regions: number[][], size: number, regionId: number): boolean {
  // Find first cell of this region
  let startR = -1, startC = -1;
  let cellCount = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (regions[r][c] === regionId) {
        cellCount++;
        if (startR === -1) { startR = r; startC = c; }
      }
    }
  }

  if (cellCount === 0) return false;

  // BFS from first cell
  const visited = new Set<number>();
  const queue: [number, number][] = [[startR, startC]];
  visited.add(startR * size + startC);

  while (queue.length > 0) {
    const [r, c] = queue.pop()!;
    for (const [dr, dc] of DIRS) {
      const nr = r + dr;
      const nc = c + dc;
      const key = nr * size + nc;
      if (nr >= 0 && nr < size && nc >= 0 && nc < size &&
          regions[nr][nc] === regionId && !visited.has(key)) {
        visited.add(key);
        queue.push([nr, nc]);
      }
    }
  }

  return visited.size === cellCount;
}

/**
 * Find a random boundary cell (cell adjacent to a different region).
 */
function getBoundaryCell(regions: number[][], size: number): { row: number; col: number; neighborRegion: number } | null {
  const candidates: { row: number; col: number; neighborRegion: number }[] = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      for (const [dr, dc] of DIRS) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < size && nc >= 0 && nc < size &&
            regions[nr][nc] !== regions[r][c]) {
          candidates.push({ row: r, col: c, neighborRegion: regions[nr][nc] });
          break;
        }
      }
    }
  }
  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

/**
 * Place N queens satisfying row, column, and adjacency constraints.
 */
function placeQueens(size: number): Position[] | null {
  const usedCols = new Set<number>();
  const blocked = Array.from({ length: size }, () => new Array<number>(size).fill(0));
  const result: Position[] = [];

  function backtrack(row: number): boolean {
    if (row === size) return true;
    const cols = shuffle(Array.from({ length: size }, (_, i) => i));
    for (const col of cols) {
      if (usedCols.has(col)) continue;
      if (blocked[row][col] > 0) continue;

      usedCols.add(col);
      for (const [dr, dc] of ADJACENT_OFFSETS) {
        const nr = row + dr;
        const nc = col + dc;
        if (nr >= 0 && nr < size && nc >= 0 && nc < size) blocked[nr][nc]++;
      }
      result.push({ row, col });

      if (backtrack(row + 1)) return true;

      result.pop();
      usedCols.delete(col);
      for (const [dr, dc] of ADJACENT_OFFSETS) {
        const nr = row + dr;
        const nc = col + dc;
        if (nr >= 0 && nr < size && nc >= 0 && nc < size) blocked[nr][nc]--;
      }
    }
    return false;
  }

  return backtrack(0) ? result : null;
}

/**
 * Grow initial regions from queen positions using BFS.
 */
function growRegions(size: number, queens: Position[]): number[][] | null {
  const regions: number[][] = Array.from({ length: size }, () => new Array(size).fill(-1));
  const frontiers: Position[][] = queens.map(() => []);

  for (let i = 0; i < queens.length; i++) {
    const q = queens[i];
    regions[q.row][q.col] = i;
    for (const [dr, dc] of DIRS) {
      const nr = q.row + dr;
      const nc = q.col + dc;
      if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
        frontiers[i].push({ row: nr, col: nc });
      }
    }
  }

  let unassigned = size * size - queens.length;

  while (unassigned > 0) {
    const order = shuffle(Array.from({ length: queens.length }, (_, i) => i));
    let expandedAny = false;

    for (const regionId of order) {
      if (unassigned === 0) break;
      const frontier = frontiers[regionId];
      const growCount = 1 + Math.floor(Math.random() * 3);

      for (let g = 0; g < growCount && unassigned > 0; g++) {
        while (frontier.length > 0) {
          const idx = Math.floor(Math.random() * frontier.length);
          const cell = frontier[idx];
          if (regions[cell.row][cell.col] !== -1) {
            frontier[idx] = frontier[frontier.length - 1];
            frontier.pop();
            continue;
          }
          regions[cell.row][cell.col] = regionId;
          unassigned--;
          expandedAny = true;
          frontier[idx] = frontier[frontier.length - 1];
          frontier.pop();
          for (const [dr, dc] of DIRS) {
            const nr = cell.row + dr;
            const nc = cell.col + dc;
            if (nr >= 0 && nr < size && nc >= 0 && nc < size && regions[nr][nc] === -1) {
              frontier.push({ row: nr, col: nc });
            }
          }
          break;
        }
      }
    }

    if (!expandedAny) return null;
  }

  return regions;
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
