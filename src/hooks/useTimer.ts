import { useState, useEffect, useRef, useCallback } from 'react';
import type { GamePhase } from '../lib/types';

export function useTimer(phase: GamePhase) {
  const [elapsed, setElapsed] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const accumulatedRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    if (intervalRef.current !== null) return; // Already running
    startTimeRef.current = Date.now();
    intervalRef.current = setInterval(() => {
      const now = Date.now();
      const running = startTimeRef.current ? now - startTimeRef.current : 0;
      setElapsed(Math.floor((accumulatedRef.current + running) / 1000));
    }, 1000);
  }, []);

  const pauseTimer = useCallback(() => {
    if (startTimeRef.current !== null) {
      accumulatedRef.current += Date.now() - startTimeRef.current;
      startTimeRef.current = null;
    }
    clearTimer();
  }, [clearTimer]);

  const resetTimerRefs = useCallback(() => {
    clearTimer();
    startTimeRef.current = null;
    accumulatedRef.current = 0;
  }, [clearTimer]);

  const resetTimer = useCallback(() => {
    resetTimerRefs();
    setElapsed(0);
  }, [resetTimerRefs]);

  // Start/pause/reset based on game phase
  useEffect(() => {
    if (phase === 'idle') {
      resetTimerRefs();
    } else if (phase === 'playing') {
      startTimer();
    } else if (phase === 'won') {
      pauseTimer();
    }
  }, [phase, startTimer, pauseTimer, resetTimerRefs]);

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
