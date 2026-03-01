import { useCallback } from 'react';
import type { CellMark } from '../lib/types';

const CACHE_KEY = 'queens-game-cache';
const MAX_CACHE_SIZE = 10;

interface CachedGame {
  encoded: string;
  marks: CellMark[][];
  timestamp: number;
}

function readCache(): CachedGame[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as CachedGame[];
  } catch {
    return [];
  }
}

function writeCache(cache: CachedGame[]): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // localStorage unavailable
  }
}

export function getCachedMarksFromStorage(encoded: string): CellMark[][] | null {
  const cache = readCache();
  return cache.find(e => e.encoded === encoded)?.marks ?? null;
}

export function useGameCache() {
  const getCachedMarks = useCallback((encoded: string): CellMark[][] | null => {
    return getCachedMarksFromStorage(encoded);
  }, []);

  const saveMarks = useCallback(
    (encoded: string, marks: readonly (readonly CellMark[])[]): void => {
      let cache = readCache().filter(e => e.encoded !== encoded);
      cache.unshift({
        encoded,
        marks: marks.map(row => [...row]),
        timestamp: Date.now(),
      });
      if (cache.length > MAX_CACHE_SIZE) {
        cache = cache.slice(0, MAX_CACHE_SIZE);
      }
      writeCache(cache);
    },
    [],
  );

  return { getCachedMarks, saveMarks };
}
