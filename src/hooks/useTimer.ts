import { useState, useEffect, useRef, useCallback } from 'react';
import type { GamePhase } from '../lib/types';

interface PersistedTimer {
  boardKey: string;
  accumulatedMs: number;
  startedAt: number | null;
}

function readPersistedTimer(boardKey: string): { accumulated: number; elapsed: number } {
  try {
    const raw = localStorage.getItem('queens-timer');
    if (!raw) return { accumulated: 0, elapsed: 0 };
    const p = JSON.parse(raw) as PersistedTimer;
    if (p.boardKey !== boardKey) return { accumulated: 0, elapsed: 0 };
    // If timer was running when saved, add elapsed since then
    const accumulated = p.accumulatedMs + (p.startedAt !== null ? Date.now() - p.startedAt : 0);
    return { accumulated, elapsed: Math.floor(accumulated / 1000) };
  } catch {
    return { accumulated: 0, elapsed: 0 };
  }
}

export function useTimer(phase: GamePhase, boardKey: string) {
  const [timerInit] = useState(() => readPersistedTimer(boardKey));

  const [elapsed, setElapsed] = useState(timerInit.elapsed);
  const startTimeRef = useRef<number | null>(null);
  const accumulatedRef = useRef(timerInit.accumulated);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const saveTimerState = useCallback(() => {
    try {
      const state: PersistedTimer = {
        boardKey,
        accumulatedMs: accumulatedRef.current,
        startedAt: startTimeRef.current,
      };
      localStorage.setItem('queens-timer', JSON.stringify(state));
    } catch {
      // localStorage unavailable
    }
  }, [boardKey]);

  const startTimer = useCallback(() => {
    if (intervalRef.current !== null) return; // Already running
    startTimeRef.current = Date.now();
    intervalRef.current = setInterval(() => {
      const now = Date.now();
      const running = startTimeRef.current ? now - startTimeRef.current : 0;
      setElapsed(Math.floor((accumulatedRef.current + running) / 1000));
      saveTimerState();
    }, 1000);
  }, [saveTimerState]);

  const pauseTimer = useCallback(() => {
    if (startTimeRef.current !== null) {
      accumulatedRef.current += Date.now() - startTimeRef.current;
      startTimeRef.current = null;
    }
    clearTimer();
    saveTimerState();
  }, [clearTimer, saveTimerState]);

  const resetTimer = useCallback(() => {
    clearTimer();
    startTimeRef.current = null;
    accumulatedRef.current = 0;
    setElapsed(0);
    saveTimerState();
  }, [clearTimer, saveTimerState]);

  // Start/pause based on game phase — do NOT reset on idle (reset keeps timer running)
  useEffect(() => {
    if (phase === 'playing') {
      startTimer();
    } else if (phase === 'won') {
      pauseTimer();
    }
  }, [phase, startTimer, pauseTimer]);

  // Pause when tab is hidden, resume when visible
  useEffect(() => {
    function handleVisibilityChange() {
      if (phase !== 'playing') return;
      if (document.hidden) {
        pauseTimer();
      } else {
        startTimer();
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [phase, pauseTimer, startTimer]);

  // Clean up on unmount
  useEffect(() => {
    return clearTimer;
  }, [clearTimer]);

  // Get precise elapsed in ms for saving best times
  const getElapsedMs = useCallback((): number => {
    const running = startTimeRef.current ? Date.now() - startTimeRef.current : 0;
    return accumulatedRef.current + running;
  }, []);

  return { elapsed, getElapsedMs, resetTimer };
}
