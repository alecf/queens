export type BoardSize = 5 | 6 | 7 | 8 | 9;

// Generator algorithm variants — used internally and surfaced as a subtle UI stamp.
// BFS styles differ in growth rate, region priority, and frontier cell bias.
// Voronoi metrics assign each cell to the nearest queen under different distance functions.
export type BFSStyleId = 'classic' | 'bursty' | 'spidery' | 'dominant' | 'balanced';
export type VoronoiMetric = 'euclidean' | 'manhattan' | 'chebyshev' | 'weighted' | 'noisy';
export type GeneratorVariant =
  | { readonly algorithm: 'bfs'; readonly style: BFSStyleId }
  | { readonly algorithm: 'voronoi'; readonly metric: VoronoiMetric };
export type CellMark = 'empty' | 'x' | 'queen';

export interface Position {
  readonly row: number;
  readonly col: number;
}

export interface Board {
  readonly size: BoardSize;
  readonly regions: readonly (readonly number[])[];
}

export type GamePhase = 'idle' | 'playing' | 'won';

export interface GameState {
  readonly board: Board;
  readonly marks: readonly (readonly CellMark[])[];
  readonly solution: readonly Position[];
  readonly conflicts: ConflictSet;
  readonly phase: GamePhase;
  readonly history: readonly (readonly (readonly CellMark[])[])[];
  readonly hintsUsed: number;
  readonly lastHintTime: number;
  readonly lastHintPos: Position | null;
  /** Difficulty 1–5 from generation metrics; null for boards loaded via URL share. */
  readonly difficulty: 1 | 2 | 3 | 4 | 5 | null;
  /** Which algorithm+parameters generated this board; null for boards loaded via URL share. */
  readonly variant: GeneratorVariant | null;
}

export interface ConflictSet {
  readonly rows: ReadonlySet<number>;
  readonly cols: ReadonlySet<number>;
  readonly regions: ReadonlySet<number>;
  readonly adjacentPairs: readonly [Position, Position][];
}

export type GameAction =
  | { readonly type: 'SET_MARK'; readonly pos: Position; readonly mark: CellMark }
  | { readonly type: 'SET_MARKS'; readonly changes: readonly { pos: Position; mark: CellMark }[] }
  | { readonly type: 'UNDO' }
  | { readonly type: 'NEW_GAME'; readonly size: BoardSize }
  | { readonly type: 'HINT' }
  | { readonly type: 'RESET' }
  | {
      readonly type: 'LOAD_BOARD';
      readonly board: Board;
      readonly solution: readonly Position[];
      readonly marks?: readonly (readonly CellMark[])[];
    };

export const EMPTY_CONFLICTS: ConflictSet = {
  rows: new Set(),
  cols: new Set(),
  regions: new Set(),
  adjacentPairs: [],
};
