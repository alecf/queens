import type { Board, BoardSize, BFSStyleId, VoronoiMetric, GeneratorVariant, Position } from './types';
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
 * 1. Choose a random GeneratorVariant (BFS style or Voronoi metric)
 * 2. Place queens satisfying row/col/adjacency constraints
 * 3. Assign regions via the chosen algorithm (usually has multiple solutions)
 * 4. Iteratively swap boundary cells between regions to eliminate alternative solutions
 * Budget: up to ~1 second.
 */
export interface GenerationMetrics {
  readonly totalSolverNodes: number;
  readonly swapCount: number;
}

// ---------------------------------------------------------------------------
// BFS style configuration
// ---------------------------------------------------------------------------

interface BFSStyleConfig {
  /** Minimum cells a region tries to claim per growth round. */
  readonly growMin: number;
  /** Maximum cells a region tries to claim per growth round (inclusive). */
  readonly growMax: number;
  /** Order in which regions take their turn each round. */
  readonly priority: 'smallest' | 'largest' | 'random';
  /**
   * How to pick a cell from a region's frontier.
   * 'far'  → biases toward cells far from the queen seed  (spidery tendrils)
   * 'near' → biases toward cells close to the queen seed  (compact blobs)
   * 'uniform' → pure random pick  (classic behaviour)
   */
  readonly frontierBias: 'uniform' | 'far' | 'near';
}

const BFS_STYLES: Record<BFSStyleId, BFSStyleConfig> = {
  // Original algorithm — roughly equal blobs, random uniform frontier
  classic:  { growMin: 1, growMax: 3, priority: 'smallest', frontierBias: 'uniform' },
  // Explosive bursts — some regions grab large chunks; random ordering makes sizes uneven
  bursty:   { growMin: 1, growMax: 8, priority: 'random',   frontierBias: 'uniform' },
  // Spidery fingers — prefers frontier cells far from the seed queen
  spidery:  { growMin: 1, growMax: 2, priority: 'smallest', frontierBias: 'far'     },
  // Dominant regions — largest regions grow first; a few huge patches + small fillers
  dominant: { growMin: 2, growMax: 6, priority: 'largest',  frontierBias: 'uniform' },
  // Tight mosaic — every region grows by exactly 1 cell per round, synchronized
  balanced: { growMin: 1, growMax: 1, priority: 'smallest', frontierBias: 'near'    },
};

// ---------------------------------------------------------------------------
// Variant selection
// ---------------------------------------------------------------------------

const BFS_STYLE_IDS:     BFSStyleId[]    = ['classic', 'bursty', 'spidery', 'dominant', 'balanced'];
const VORONOI_METRICS:   VoronoiMetric[] = ['euclidean', 'manhattan', 'chebyshev', 'weighted', 'noisy'];

function chooseVariant(): GeneratorVariant {
  if (Math.random() < 0.5) {
    return { algorithm: 'bfs', style: BFS_STYLE_IDS[Math.floor(Math.random() * BFS_STYLE_IDS.length)] };
  }
  return { algorithm: 'voronoi', metric: VORONOI_METRICS[Math.floor(Math.random() * VORONOI_METRICS.length)] };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function generateBoard(size: BoardSize): {
  board: Board;
  solution: Position[];
  metrics: GenerationMetrics;
  variant: GeneratorVariant;
} {
  const MAX_OUTER_RETRIES = 20;
  const variant = chooseVariant();

  for (let outer = 0; outer < MAX_OUTER_RETRIES; outer++) {
    const solution = placeQueens(size);
    if (!solution) continue;

    const regions =
      variant.algorithm === 'bfs'
        ? growRegions(size, solution, BFS_STYLES[variant.style])
        : voronoiRegions(size, solution, variant.metric);
    if (!regions) continue;

    const board: Board = { size, regions };
    const refined = refineForUniqueness(board, solution);
    if (refined) return { ...refined, variant };
  }

  throw new Error(`Failed to generate a unique board of size ${size}`);
}

// ---------------------------------------------------------------------------
// Region-growing: BFS with style config
// ---------------------------------------------------------------------------

/**
 * Grow initial regions from queen positions using BFS.
 * Ordering and frontier-cell selection are controlled by the style config.
 */
function growRegions(size: number, queens: Position[], config: BFSStyleConfig): number[][] | null {
  const regions: number[][] = Array.from({ length: size }, () => new Array(size).fill(-1));
  const frontiers: Position[][] = queens.map(() => []);
  const regionSizes = queens.map(() => 1);

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

    if (config.priority !== 'random') {
      const sign = config.priority === 'smallest' ? 1 : -1;
      order.sort((a, b) => {
        const sizeDiff = sign * (regionSizes[a] - regionSizes[b]);
        if (sizeDiff !== 0) return sizeDiff;
        return sign * (frontiers[a].length - frontiers[b].length);
      });
    }

    let expandedAny = false;

    for (const regionId of order) {
      if (unassigned === 0) break;
      const frontier = frontiers[regionId];
      const growCount =
        config.growMin === config.growMax
          ? config.growMin
          : config.growMin + Math.floor(Math.random() * (config.growMax - config.growMin + 1));

      for (let g = 0; g < growCount && unassigned > 0; g++) {
        // Purge stale entries (cells claimed by another region since last visit)
        let i = 0;
        while (i < frontier.length) {
          if (regions[frontier[i].row][frontier[i].col] !== -1) {
            frontier[i] = frontier[frontier.length - 1];
            frontier.pop();
          } else {
            i++;
          }
        }
        if (frontier.length === 0) break;

        // Pick cell from frontier according to bias
        const idx = pickFrontierIdx(frontier, queens[regionId], config.frontierBias);
        const cell = frontier[idx];

        regions[cell.row][cell.col] = regionId;
        regionSizes[regionId]++;
        unassigned--;
        expandedAny = true;

        // Remove claimed cell from frontier (swap-and-pop)
        frontier[idx] = frontier[frontier.length - 1];
        frontier.pop();

        // Expand frontier to unassigned neighbours
        for (const [dr, dc] of DIRS) {
          const nr = cell.row + dr;
          const nc = cell.col + dc;
          if (nr >= 0 && nr < size && nc >= 0 && nc < size && regions[nr][nc] === -1) {
            frontier.push({ row: nr, col: nc });
          }
        }
      }
    }

    if (!expandedAny) return null;
  }

  // Post-processing: rescue any single-cell regions by stealing a boundary cell
  // from a sufficiently large neighbour, preserving that neighbour's connectivity.
  for (let i = 0; i < queens.length; i++) {
    if (regionSizes[i] === 1) {
      const q = queens[i];
      let fixed = false;
      for (const [dr, dc] of DIRS) {
        if (fixed) break;
        const nr = q.row + dr;
        const nc = q.col + dc;
        if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue;
        const neighborRegion = regions[nr][nc];
        if (regionSizes[neighborRegion] < 3) continue;
        regions[nr][nc] = i;
        if (isRegionConnected(regions, size, neighborRegion)) {
          regionSizes[i]++;
          regionSizes[neighborRegion]--;
          fixed = true;
        } else {
          regions[nr][nc] = neighborRegion; // revert
        }
      }
      if (!fixed) return null;
    }
  }

  return regions;
}

/**
 * Pick an index into `frontier` according to the given bias.
 * 'far'/'near' sample k=3 candidates and return the farthest/nearest from `seed`.
 */
function pickFrontierIdx(
  frontier: Position[],
  seed: Position,
  bias: BFSStyleConfig['frontierBias'],
): number {
  if (bias === 'uniform' || frontier.length === 1) {
    return Math.floor(Math.random() * frontier.length);
  }
  const k = Math.min(3, frontier.length);
  let bestIdx = 0;
  let bestDist = bias === 'far' ? -1 : Infinity;
  for (let s = 0; s < k; s++) {
    const ci = Math.floor(Math.random() * frontier.length);
    const d = Math.abs(frontier[ci].row - seed.row) + Math.abs(frontier[ci].col - seed.col);
    if ((bias === 'far' && d > bestDist) || (bias === 'near' && d < bestDist)) {
      bestDist = d;
      bestIdx = ci;
    }
  }
  return bestIdx;
}

// ---------------------------------------------------------------------------
// Region-growing: Voronoi partitioning
// ---------------------------------------------------------------------------

/**
 * Assign each cell to the queen whose distance (under the chosen metric) is smallest.
 * For 'weighted': each queen has random anisotropic x/y scale factors → elliptical regions.
 * For 'noisy': per-cell noise added to Euclidean distance → organic, irregular regions.
 * Disconnected region fragments are re-stitched to their nearest connected neighbour.
 */
function voronoiRegions(size: number, queens: Position[], metric: VoronoiMetric): number[][] | null {
  // Pre-generate metric-specific random parameters once
  const weights =
    metric === 'weighted'
      ? queens.map(() => ({ sx: 0.4 + Math.random() * 1.2, sy: 0.4 + Math.random() * 1.2 }))
      : null;

  const noise =
    metric === 'noisy'
      ? Array.from({ length: size }, () =>
          Array.from({ length: size }, () => Math.random() * 2.5),
        )
      : null;

  function dist(r: number, c: number, qi: number): number {
    const q = queens[qi];
    const dr = r - q.row;
    const dc = c - q.col;
    switch (metric) {
      case 'euclidean': return Math.sqrt(dr * dr + dc * dc);
      case 'manhattan': return Math.abs(dr) + Math.abs(dc);
      case 'chebyshev': return Math.max(Math.abs(dr), Math.abs(dc));
      case 'weighted': {
        const w = weights![qi];
        return Math.sqrt((dr * w.sy) ** 2 + (dc * w.sx) ** 2);
      }
      case 'noisy': return Math.sqrt(dr * dr + dc * dc) + noise![r][c];
    }
  }

  const regions: number[][] = Array.from({ length: size }, () => new Array(size).fill(-1));

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      let minDist = Infinity;
      let minRegion = 0;
      for (let qi = 0; qi < queens.length; qi++) {
        const d = dist(r, c, qi);
        if (d < minDist) {
          minDist = d;
          minRegion = qi;
        }
      }
      regions[r][c] = minRegion;
    }
  }

  // Fix any disconnected fragments: BFS from each queen, reassign orphan cells
  // to their best-connected neighbour. Repeat until stable (typically 1 pass).
  let changed = true;
  while (changed) {
    changed = false;
    for (let qi = 0; qi < queens.length; qi++) {
      const visited = new Set<number>();
      const queue: Position[] = [queens[qi]];
      visited.add(queens[qi].row * size + queens[qi].col);

      while (queue.length > 0) {
        const { row, col } = queue.pop()!;
        for (const [dr, dc] of DIRS) {
          const nr = row + dr;
          const nc = col + dc;
          const key = nr * size + nc;
          if (
            nr >= 0 && nr < size && nc >= 0 && nc < size &&
            regions[nr][nc] === qi && !visited.has(key)
          ) {
            visited.add(key);
            queue.push({ row: nr, col: nc });
          }
        }
      }

      // Orphan cells: belong to qi but unreachable from the queen
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (regions[r][c] !== qi || visited.has(r * size + c)) continue;
          // Reassign to the region of the first connected neighbour
          for (const [dr, dc] of DIRS) {
            const nr = r + dr;
            const nc = c + dc;
            if (nr >= 0 && nr < size && nc >= 0 && nc < size && regions[nr][nc] !== qi) {
              regions[r][c] = regions[nr][nc];
              changed = true;
              break;
            }
          }
        }
      }
    }
  }

  // Validate: every queen must still be in its own region
  for (let qi = 0; qi < queens.length; qi++) {
    if (regions[queens[qi].row][queens[qi].col] !== qi) return null;
  }

  // Rescue single-cell regions (same logic as BFS path)
  const regionSizes = new Array<number>(queens.length).fill(0);
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) regionSizes[regions[r][c]]++;

  for (let i = 0; i < queens.length; i++) {
    if (regionSizes[i] === 1) {
      const q = queens[i];
      let fixed = false;
      for (const [dr, dc] of DIRS) {
        if (fixed) break;
        const nr = q.row + dr;
        const nc = q.col + dc;
        if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue;
        const neighborRegion = regions[nr][nc];
        if (regionSizes[neighborRegion] < 3) continue;
        regions[nr][nc] = i;
        if (isRegionConnected(regions, size, neighborRegion)) {
          regionSizes[i]++;
          regionSizes[neighborRegion]--;
          fixed = true;
        } else {
          regions[nr][nc] = neighborRegion;
        }
      }
      if (!fixed) return null;
    }
  }

  return regions;
}

// ---------------------------------------------------------------------------
// Uniqueness refinement (unchanged from original)
// ---------------------------------------------------------------------------

/**
 * Iteratively swap boundary cells between regions until the board has a unique solution.
 * Returns null if refinement fails within budget.
 */
function refineForUniqueness(
  board: Board,
  targetSolution: Position[],
): { board: Board; solution: Position[]; metrics: GenerationMetrics } | null {
  const { size } = board;
  const regions = board.regions.map(row => [...row]);
  const MAX_SWAPS = 1000;

  let totalSolverNodes = 0;
  let swapCount = 0;

  const regionSizes = new Array<number>(size).fill(0);
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      regionSizes[regions[r][c]]++;
    }
  }

  for (let swap = 0; swap < MAX_SWAPS; swap++) {
    const currentBoard: Board = { size, regions: regions.map(r => [...r]) };
    const { solutions, nodeCount } = solve(currentBoard, 2);
    totalSolverNodes += nodeCount;

    if (solutions.length === 1) {
      return { board: currentBoard, solution: solutions[0], metrics: { totalSolverNodes, swapCount } };
    }

    if (solutions.length === 0) return null;

    swapCount++;

    const sol1 = solutions[0];
    const sol2 = solutions[1];

    const queenMap1 = new Set(sol1.map(p => p.row * size + p.col));
    const queenMap2 = new Set(sol2.map(p => p.row * size + p.col));

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

    shuffle(diffCells);

    let swapped = false;
    for (const cell of diffCells) {
      const currentRegion = regions[cell.row][cell.col];
      const neighborRegions = new Set<number>();
      for (const [dr, dc] of DIRS) {
        const nr = cell.row + dr;
        const nc = cell.col + dc;
        if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
          const nRegion = regions[nr][nc];
          if (nRegion !== currentRegion) neighborRegions.add(nRegion);
        }
      }

      for (const newRegion of neighborRegions) {
        const oldRegion = regions[cell.row][cell.col];
        if (regionSizes[oldRegion] <= 2) continue;

        regions[cell.row][cell.col] = newRegion;

        if (
          isRegionConnected(regions, size, oldRegion) &&
          isRegionConnected(regions, size, newRegion)
        ) {
          const queenForOld = targetSolution[oldRegion];
          const queenForNew = targetSolution[newRegion];
          if (
            regions[queenForOld.row][queenForOld.col] === oldRegion &&
            regions[queenForNew.row][queenForNew.col] === newRegion
          ) {
            regionSizes[oldRegion]--;
            regionSizes[newRegion]++;
            swapped = true;
            break;
          }
        }

        regions[cell.row][cell.col] = oldRegion;
      }

      if (swapped) break;
    }

    if (!swapped) {
      const boundary = getBoundaryCell(regions, size);
      if (!boundary) return null;

      const { row, col, neighborRegion } = boundary;
      const oldRegion = regions[row][col];

      if (regionSizes[oldRegion] > 2) {
        regions[row][col] = neighborRegion;

        if (
          !isRegionConnected(regions, size, oldRegion) ||
          !isRegionConnected(regions, size, neighborRegion) ||
          regions[targetSolution[oldRegion].row][targetSolution[oldRegion].col] !== oldRegion ||
          regions[targetSolution[neighborRegion].row][targetSolution[neighborRegion].col] !== neighborRegion
        ) {
          regions[row][col] = oldRegion;
        } else {
          regionSizes[oldRegion]--;
          regionSizes[neighborRegion]++;
        }
      }
    }
  }

  const finalBoard: Board = { size, regions: regions.map(r => [...r]) };
  const { solutions: finalSolutions, nodeCount: finalNodeCount } = solve(finalBoard, 2);
  totalSolverNodes += finalNodeCount;
  if (finalSolutions.length === 1) {
    return { board: finalBoard, solution: finalSolutions[0], metrics: { totalSolverNodes, swapCount } };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function isRegionConnected(regions: number[][], size: number, regionId: number): boolean {
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

  const visited = new Set<number>();
  const queue: [number, number][] = [[startR, startC]];
  visited.add(startR * size + startC);

  while (queue.length > 0) {
    const [r, c] = queue.pop()!;
    for (const [dr, dc] of DIRS) {
      const nr = r + dr;
      const nc = c + dc;
      const key = nr * size + nc;
      if (
        nr >= 0 && nr < size && nc >= 0 && nc < size &&
        regions[nr][nc] === regionId && !visited.has(key)
      ) {
        visited.add(key);
        queue.push([nr, nc]);
      }
    }
  }

  return visited.size === cellCount;
}

function getBoundaryCell(
  regions: number[][],
  size: number,
): { row: number; col: number; neighborRegion: number } | null {
  const candidates: { row: number; col: number; neighborRegion: number }[] = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      for (const [dr, dc] of DIRS) {
        const nr = r + dr;
        const nc = c + dc;
        if (
          nr >= 0 && nr < size && nc >= 0 && nc < size &&
          regions[nr][nc] !== regions[r][c]
        ) {
          candidates.push({ row: r, col: c, neighborRegion: regions[nr][nc] });
          break;
        }
      }
    }
  }
  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

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

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
