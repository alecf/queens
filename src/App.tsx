import { useState, useEffect, useCallback, useRef } from 'react';
import './App.css';
import { Board } from './components/Board';
import { Controls } from './components/Controls';
import { Timer } from './components/Timer';
import { WinOverlay } from './components/WinOverlay';
import { useGameState } from './hooks/useGameState';
import { useTimer } from './hooks/useTimer';
import { useBestTimes } from './hooks/useBestTimes';
import { encodeBoard, boardToPath } from './lib/encoder';
import type { BoardSize } from './lib/types';

const HINT_COOLDOWN_MS = 5000;

export function App() {
  const { state, setMark, setMarks, undo, hint, newGame, reset } = useGameState();
  const { elapsed, getElapsedMs, resetTimer } = useTimer(state.phase);
  const { getBestTime, recordTime } = useBestTimes();

  const [hintCooldown, setHintCooldown] = useState(0);
  const cooldownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [showWin, setShowWin] = useState(false);
  const [isNewBest, setIsNewBest] = useState(false);
  const winTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentSize = state.board.size as BoardSize;
  const bestTime = getBestTime(currentSize);

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
  useEffect(() => {
    if (state.phase === 'won') {
      const timeMs = getElapsedMs();
      const current = getBestTime(currentSize);
      const newBest = current === null || timeMs < current;
      if (newBest) recordTime(currentSize, timeMs);
      setIsNewBest(newBest);

      winTimeoutRef.current = setTimeout(() => {
        setShowWin(true);
      }, 300);
    } else {
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
      newGame(size);
      resetTimer();
      setShowWin(false);
      setHintCooldown(0);
    },
    [newGame, resetTimer],
  );

  const handleReset = useCallback(() => {
    reset();
    resetTimer();
    setHintCooldown(0);
  }, [reset, resetTimer]);

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
      <h1 className="app-title">Queens</h1>
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
    </div>
  );
}
