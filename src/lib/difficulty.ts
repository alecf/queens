import type { BoardSize } from './types';

/**
 * Per-size node-count thresholds for difficulty 1–5, derived from sampling
 * 300 boards per size. Each tuple is [p20, p40, p60, p80] — so scores are
 * evenly distributed across the empirical distribution.
 */
const THRESHOLDS: Record<BoardSize, readonly [number, number, number, number]> = {
  5: [88,     125,     185,      370],
  6: [550,    1_000,   2_200,    5_500],
  7: [2_700,  5_500,   11_000,   24_000],
  8: [12_000, 25_000,  55_000,   110_000],
  9: [54_000, 110_000, 250_000,  600_000],
};

export function computeDifficulty(size: BoardSize, totalSolverNodes: number): 1 | 2 | 3 | 4 | 5 {
  const [t1, t2, t3, t4] = THRESHOLDS[size];
  if (totalSolverNodes <= t1) return 1;
  if (totalSolverNodes <= t2) return 2;
  if (totalSolverNodes <= t3) return 3;
  if (totalSolverNodes <= t4) return 4;
  return 5;
}
