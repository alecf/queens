import { useReducer, useCallback } from 'react';
import type {
  Board,
  BoardSize,
  CellMark,
  GameAction,
  GamePhase,
  GameState,
  Position,
  ConflictSet,
} from '../lib/types';
import { EMPTY_CONFLICTS } from '../lib/types';
import { generateBoard } from '../lib/generator';
import { validateMarks, hasConflicts } from '../lib/validator';
import { encodeBoard, decodeBoard, extractBoardFromPath, boardToPath } from '../lib/encoder';
import { solve } from '../lib/solver';
import { computeDifficulty } from '../lib/difficulty';
import { getCachedMarksFromStorage } from './useGameCache';

function createEmptyMarks(size: number): CellMark[][] {
  return Array.from({ length: size }, () => new Array<CellMark>(size).fill('empty'));
}

function createInitialState(board: Board, solution: Position[], difficulty: 1 | 2 | 3 | 4 | 5 | null = null): GameState {
  return {
    board,
    marks: createEmptyMarks(board.size),
    solution,
    conflicts: EMPTY_CONFLICTS,
    phase: 'idle',
    history: [],
    hintsUsed: 0,
    lastHintTime: 0,
    difficulty,
  };
}

function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'SET_MARK': {
      if (state.phase === 'won') return state;
      const { pos, mark } = action;
      const newMarks = state.marks.map(row => [...row]);
      newMarks[pos.row][pos.col] = mark;
      const conflicts = validateMarks(state.board, newMarks);
      const phase = checkWin(state.board, newMarks, conflicts);
      return {
        ...state,
        marks: newMarks,
        conflicts,
        phase: phase === 'won' ? 'won' : (state.phase === 'idle' ? 'playing' : state.phase),
        history: [...state.history, state.marks.map(row => [...row])],
      };
    }

    case 'SET_MARKS': {
      if (state.phase === 'won') return state;
      const newMarks = state.marks.map(row => [...row]);
      for (const { pos, mark } of action.changes) {
        newMarks[pos.row][pos.col] = mark;
      }
      const conflicts = validateMarks(state.board, newMarks);
      const phase = checkWin(state.board, newMarks, conflicts);
      return {
        ...state,
        marks: newMarks,
        conflicts,
        phase: phase === 'won' ? 'won' : (state.phase === 'idle' ? 'playing' : state.phase),
        history: [...state.history, state.marks.map(row => [...row])],
      };
    }

    case 'UNDO': {
      if (state.phase === 'won' || state.history.length === 0) return state;
      const newHistory = [...state.history];
      const previousMarks = newHistory.pop()!;
      const conflicts = validateMarks(state.board, previousMarks);
      const phase = checkWin(state.board, previousMarks, conflicts);
      return {
        ...state,
        marks: previousMarks,
        conflicts,
        phase: phase === 'won' ? 'won' : state.phase,
        history: newHistory,
      };
    }

    case 'HINT': {
      if (state.phase === 'won') return state;
      // Find a cell that isn't correctly marked
      const { board, solution, marks } = state;
      const candidates: { pos: Position; mark: CellMark }[] = [];

      // Build solution queen positions set
      const solutionSet = new Set(solution.map(p => p.row * board.size + p.col));

      for (let r = 0; r < board.size; r++) {
        for (let c = 0; c < board.size; c++) {
          const key = r * board.size + c;
          const isQueenCell = solutionSet.has(key);
          const currentMark = marks[r][c];

          if (isQueenCell && currentMark !== 'queen') {
            candidates.push({ pos: { row: r, col: c }, mark: 'queen' });
          } else if (!isQueenCell && currentMark !== 'x') {
            candidates.push({ pos: { row: r, col: c }, mark: 'x' });
          }
        }
      }

      if (candidates.length === 0) return state;

      // Pick a random candidate
      const hint = candidates[Math.floor(Math.random() * candidates.length)];
      const newMarks = state.marks.map(row => [...row]);
      newMarks[hint.pos.row][hint.pos.col] = hint.mark;
      const conflicts = validateMarks(state.board, newMarks);
      const phase = checkWin(state.board, newMarks, conflicts);

      return {
        ...state,
        marks: newMarks,
        conflicts,
        phase: phase === 'won' ? 'won' : (state.phase === 'idle' ? 'playing' : state.phase),
        history: [...state.history, state.marks.map(row => [...row])],
        hintsUsed: state.hintsUsed + 1,
        lastHintTime: Date.now(),
      };
    }

    case 'NEW_GAME': {
      const { board, solution, metrics } = generateBoard(action.size);
      const difficulty = computeDifficulty(action.size, metrics.totalSolverNodes);
      const encoded = encodeBoard(board);
      history.pushState(null, '', boardToPath(encoded));
      return createInitialState(board, solution, difficulty);
    }

    case 'RESET': {
      return {
        ...state,
        marks: createEmptyMarks(state.board.size),
        conflicts: EMPTY_CONFLICTS,
        phase: 'idle',
        history: [],
        hintsUsed: 0,
        lastHintTime: 0,
      };
    }

    case 'LOAD_BOARD': {
      const { board, solution } = action;
      const marks = action.marks
        ? action.marks.map(row => [...row])
        : createEmptyMarks(board.size);
      const conflicts = validateMarks(board, marks);
      const phase = checkWin(board, marks, conflicts);
      const hasAnyMark = marks.some(row => row.some(m => m !== 'empty'));
      return {
        board,
        marks,
        solution,
        conflicts,
        phase: phase === 'won' ? 'won' : (hasAnyMark ? 'playing' : 'idle'),
        history: [],
        hintsUsed: 0,
        lastHintTime: 0,
        difficulty: null,
      };
    }
  }
}

function checkWin(board: Board, marks: readonly (readonly CellMark[])[], conflicts: ConflictSet): GamePhase {
  if (hasConflicts(conflicts)) return 'playing';
  let queenCount = 0;
  for (let r = 0; r < board.size; r++) {
    for (let c = 0; c < board.size; c++) {
      if (marks[r][c] === 'queen') queenCount++;
    }
  }
  return queenCount === board.size ? 'won' : 'playing';
}

export function useGameState() {
  // Initialize from URL or generate new
  const initialState = getInitialState();
  const [state, dispatch] = useReducer(gameReducer, initialState);

  const setMark = useCallback((pos: Position, mark: CellMark) => {
    dispatch({ type: 'SET_MARK', pos, mark });
  }, []);

  const setMarks = useCallback((changes: readonly { pos: Position; mark: CellMark }[]) => {
    dispatch({ type: 'SET_MARKS', changes });
  }, []);

  const undo = useCallback(() => dispatch({ type: 'UNDO' }), []);

  const hint = useCallback(() => dispatch({ type: 'HINT' }), []);

  const newGame = useCallback((size: BoardSize) => {
    dispatch({ type: 'NEW_GAME', size });
  }, []);

  const reset = useCallback(() => dispatch({ type: 'RESET' }), []);

  const loadBoard = useCallback(
    (board: Board, solution: readonly Position[], marks?: readonly (readonly CellMark[])[]) => {
      dispatch({ type: 'LOAD_BOARD', board, solution, marks });
    },
    [],
  );

  return { state, setMark, setMarks, undo, hint, newGame, reset, loadBoard };
}

function getInitialState(): GameState {
  // Try to load from URL
  const path = window.location.pathname;
  const encoded = extractBoardFromPath(path);
  if (encoded) {
    const board = decodeBoard(encoded);
    if (board) {
      const { solutions } = solve(board, 1);
      if (solutions.length === 1) {
        const cachedMarks = getCachedMarksFromStorage(encoded);
        if (cachedMarks) {
          const conflicts = validateMarks(board, cachedMarks);
          const hasAnyMark = cachedMarks.some(row => row.some(m => m !== 'empty'));
          const phase = checkWin(board, cachedMarks, conflicts);
          return {
            board,
            marks: cachedMarks,
            solution: solutions[0],
            conflicts,
            phase: phase === 'won' ? 'won' : (hasAnyMark ? 'playing' : 'idle'),
            history: [],
            hintsUsed: 0,
            lastHintTime: 0,
            difficulty: null,
          };
        }
        return createInitialState(board, solutions[0]);
      }
    }
  }

  // Generate new board
  const savedSize = getSavedSize();
  const { board, solution, metrics } = generateBoard(savedSize);
  const difficulty = computeDifficulty(savedSize, metrics.totalSolverNodes);
  const encodedNew = encodeBoard(board);
  history.replaceState(null, '', boardToPath(encodedNew));
  return createInitialState(board, solution, difficulty);
}

function getSavedSize(): BoardSize {
  try {
    const saved = localStorage.getItem('queens-size');
    if (saved) {
      const size = parseInt(saved, 10);
      if (size >= 5 && size <= 9) return size as BoardSize;
    }
  } catch {
    // localStorage unavailable
  }
  return 7;
}
