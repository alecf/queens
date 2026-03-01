import type { Board, CellMark, ConflictSet, Position } from './types';

export function validateMarks(
  board: Board,
  marks: readonly (readonly CellMark[])[],
): ConflictSet {
  const { size } = board;
  const queens: Position[] = [];

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (marks[row][col] === 'queen') {
        queens.push({ row, col });
      }
    }
  }

  const rows = new Set<number>();
  const cols = new Set<number>();
  const regions = new Set<number>();
  const adjacentPairs: [Position, Position][] = [];

  // Check row conflicts
  const queensByRow = new Map<number, Position[]>();
  for (const q of queens) {
    const list = queensByRow.get(q.row) ?? [];
    list.push(q);
    queensByRow.set(q.row, list);
  }
  for (const [row, qs] of queensByRow) {
    if (qs.length > 1) rows.add(row);
  }

  // Check column conflicts
  const queensByCol = new Map<number, Position[]>();
  for (const q of queens) {
    const list = queensByCol.get(q.col) ?? [];
    list.push(q);
    queensByCol.set(q.col, list);
  }
  for (const [col, qs] of queensByCol) {
    if (qs.length > 1) cols.add(col);
  }

  // Check region conflicts
  const queensByRegion = new Map<number, Position[]>();
  for (const q of queens) {
    const regionId = board.regions[q.row][q.col];
    const list = queensByRegion.get(regionId) ?? [];
    list.push(q);
    queensByRegion.set(regionId, list);
  }
  for (const [regionId, qs] of queensByRegion) {
    if (qs.length > 1) regions.add(regionId);
  }

  // Check adjacency conflicts
  for (let i = 0; i < queens.length; i++) {
    for (let j = i + 1; j < queens.length; j++) {
      const a = queens[i];
      const b = queens[j];
      if (Math.abs(a.row - b.row) <= 1 && Math.abs(a.col - b.col) <= 1) {
        adjacentPairs.push([a, b]);
      }
    }
  }

  return { rows, cols, regions, adjacentPairs };
}

export function hasConflicts(conflicts: ConflictSet): boolean {
  return (
    conflicts.rows.size > 0 ||
    conflicts.cols.size > 0 ||
    conflicts.regions.size > 0 ||
    conflicts.adjacentPairs.length > 0
  );
}

export function isComplete(
  board: Board,
  marks: readonly (readonly CellMark[])[],
): boolean {
  const { size } = board;
  let queenCount = 0;
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (marks[row][col] === 'queen') queenCount++;
    }
  }
  if (queenCount !== size) return false;
  const conflicts = validateMarks(board, marks);
  return !hasConflicts(conflicts);
}
