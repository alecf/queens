import { useState, useEffect, useCallback, useRef } from 'react';
import './App.css';
import { Board } from './components/Board';
import { Controls } from './components/Controls';
import { Timer } from './components/Timer';
import { WinOverlay } from './components/WinOverlay';
import { useGameState } from './hooks/useGameState';
import { useTimer } from './hooks/useTimer';
import { useBestTimes } from './hooks/useBestTimes';
import { useGameCache } from './hooks/useGameCache';
import { useTheme } from './hooks/useTheme';
import { encodeBoard, decodeBoard, extractBoardFromPath, boardToPath } from './lib/encoder';
import { solve } from './lib/solver';
import type { BoardSize } from './lib/types';

const HINT_COOLDOWN_MS = 5000;

export function App() {
  const { state, setMark, setMarks, undo, hint, newGame, reset, loadBoard } = useGameState();
  const { elapsed, getElapsedMs, resetTimer } = useTimer(state.phase);
  const { getBestTime, recordTime } = useBestTimes();
  const { getCachedMarks, saveMarks } = useGameCache();
  const { theme, cycleTheme } = useTheme();

  const [hintCooldown, setHintCooldown] = useState(0);
  const cooldownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [showWin, setShowWin] = useState(false);
  const [isNewBest, setIsNewBest] = useState(false);
  const winTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Confirmation dialog state
  const [confirmPending, setConfirmPending] = useState<null | {
    message: string;
    onConfirm: () => void;
  }>(null);

  const currentSize = state.board.size as BoardSize;
  const bestTime = getBestTime(currentSize);

  // True when the user has placed marks but hasn't won yet — requires confirmation to destroy
  const hasProgress = state.history.length > 0 && state.phase !== 'won';

  // Save marks to cache whenever they change (only when any marks exist)
  useEffect(() => {
    const hasAnyMark = state.marks.some(row => row.some(m => m !== 'empty'));
    if (hasAnyMark) {
      const encoded = encodeBoard(state.board);
      saveMarks(encoded, state.marks);
    }
  }, [state.marks, state.board, saveMarks]);

  // Handle browser back/forward navigation
  useEffect(() => {
    function handlePopState() {
      const path = window.location.pathname;
      const encoded = extractBoardFromPath(path);
      if (!encoded) return;
      const board = decodeBoard(encoded);
      if (!board) return;
      const solutions = solve(board, 1);
      if (solutions.length !== 1) return;
      const cached = getCachedMarks(encoded);
      loadBoard(board, solutions[0], cached ?? undefined);
      resetTimer();
      setShowWin(false);
      setHintCooldown(0);
    }

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [getCachedMarks, loadBoard, resetTimer]);

  // Handle hint cooldown
  useEffect(() => {
    if (state.lastHintTime === 0) return;

    function updateCooldown() {
      const remaining = Math.max(0, HINT_COOLDOWN_MS - (Date.now() - state.lastHintTime));
      setHintCooldown(Math.ceil(remaining / 1000));
      if (remaining <= 0 && cooldownIntervalRef.current) {
        clearInterval(cooldownIntervalRef.current);
        cooldownIntervalRef.current = null;
      }
    }

    updateCooldown();
    cooldownIntervalRef.current = setInterval(updateCooldown, 200);

    return () => {
      if (cooldownIntervalRef.current) {
        clearInterval(cooldownIntervalRef.current);
        cooldownIntervalRef.current = null;
      }
    };
  }, [state.lastHintTime]);

  // Handle win
  const hasHandledWinRef = useRef(false);
  useEffect(() => {
    if (state.phase === 'won') {
      if (!hasHandledWinRef.current) {
        hasHandledWinRef.current = true;
        const timeMs = getElapsedMs();
        const current = getBestTime(currentSize);
        const newBest = current === null || timeMs < current;
        if (newBest) recordTime(currentSize, timeMs);
        setIsNewBest(newBest);
      }

      winTimeoutRef.current = setTimeout(() => {
        setShowWin(true);
      }, 300);
    } else {
      hasHandledWinRef.current = false;
      setShowWin(false);
      if (winTimeoutRef.current) {
        clearTimeout(winTimeoutRef.current);
        winTimeoutRef.current = null;
      }
    }
  }, [state.phase, getElapsedMs, getBestTime, recordTime, currentSize]);

  // Save last-used size
  useEffect(() => {
    try {
      localStorage.setItem('queens-size', currentSize.toString());
    } catch {
      // localStorage unavailable
    }
  }, [currentSize]);

  const handleNewGame = useCallback(
    (size: BoardSize) => {
      const doNewGame = () => {
        newGame(size);
        resetTimer();
        setShowWin(false);
        setHintCooldown(0);
      };
      if (hasProgress) {
        setConfirmPending({
          message: 'Start a new game? Your current progress will be lost.',
          onConfirm: doNewGame,
        });
      } else {
        doNewGame();
      }
    },
    [newGame, resetTimer, hasProgress],
  );

  const handleReset = useCallback(() => {
    const doReset = () => {
      reset();
      resetTimer();
      setHintCooldown(0);
    };
    if (hasProgress) {
      setConfirmPending({
        message: 'Reset the board? All your marks will be cleared.',
        onConfirm: doReset,
      });
    } else {
      doReset();
    }
  }, [reset, resetTimer, hasProgress]);

  const handleHint = useCallback(() => {
    if (hintCooldown > 0) return;
    hint();
  }, [hint, hintCooldown]);

  const handleShare = useCallback(() => {
    const encoded = encodeBoard(state.board);
    const url = window.location.origin + boardToPath(encoded);

    if (navigator.share) {
      navigator.share({ title: 'Queens Puzzle', url }).catch(() => {
        navigator.clipboard.writeText(url).catch(() => {});
      });
    } else {
      navigator.clipboard.writeText(url).catch(() => {});
    }
  }, [state.board]);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key.toLowerCase()) {
        case 'u':
          e.preventDefault();
          undo();
          break;
        case 'h':
          e.preventDefault();
          handleHint();
          break;
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [undo, handleHint]);

  return (
    <div className="app">
      <div className="app-header">
        <h1 className="app-title">Queens</h1>
        <button className="theme-btn" onClick={cycleTheme} aria-label="Toggle colour theme">
          {theme === 'light' ? 'Light' : theme === 'dark' ? 'Dark' : 'Auto'}
        </button>
      </div>
      <Timer elapsed={elapsed} bestTime={bestTime} />
      <Board state={state} onSetMark={setMark} onSetMarks={setMarks} />
      <Controls
        currentSize={currentSize}
        canUndo={state.history.length > 0 && state.phase !== 'won'}
        canHint={hintCooldown === 0 && state.phase !== 'won'}
        hintCooldownRemaining={hintCooldown}
        hintsUsed={state.hintsUsed}
        isWon={state.phase === 'won'}
        onNewGame={handleNewGame}
        onUndo={undo}
        onHint={handleHint}
        onReset={handleReset}
        onShare={handleShare}
      />
      {showWin && (
        <WinOverlay
          elapsed={elapsed}
          isNewBest={isNewBest}
          onNewGame={handleNewGame}
          onShare={handleShare}
          currentSize={currentSize}
        />
      )}
      {confirmPending && (
        <div className="confirm-overlay" role="dialog" aria-modal="true">
          <div className="confirm-dialog">
            <p>{confirmPending.message}</p>
            <div className="confirm-actions">
              <button className="confirm-btn" onClick={() => setConfirmPending(null)}>
                Cancel
              </button>
              <button
                className="confirm-btn confirm-btn-danger"
                onClick={() => {
                  confirmPending.onConfirm();
                  setConfirmPending(null);
                }}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
