import { useState, useCallback } from 'react';
import type { BoardSize } from '../lib/types';

const STORAGE_KEY = 'queens-best-times';

function loadBestTimes(): Record<number, number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // localStorage unavailable or corrupted
  }
  return {};
}

function saveBestTimes(times: Record<number, number>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(times));
  } catch {
    // localStorage unavailable
  }
}

export function useBestTimes() {
  const [times, setTimes] = useState<Record<number, number>>(loadBestTimes);

  const getBestTime = useCallback(
    (size: BoardSize): number | null => {
      return times[size] ?? null;
    },
    [times],
  );

  const recordTime = useCallback(
    (size: BoardSize, timeMs: number) => {
      setTimes(prev => {
        const current = prev[size];
        if (current !== undefined && current <= timeMs) return prev;
        const next = { ...prev, [size]: timeMs };
        saveBestTimes(next);
        return next;
      });
    },
    [],
  );

  return { getBestTime, recordTime };
}
