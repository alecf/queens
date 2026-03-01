import { useState } from 'react';

export type Theme = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'queens-theme';

function getStoredTheme(): Theme {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    // ignore
  }
  return 'system';
}

function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === 'system') {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', theme);
  }
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = getStoredTheme();
    applyTheme(stored);
    return stored;
  });

  const cycleTheme = () => {
    const next: Theme =
      theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system';
    applyTheme(next);
    setThemeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  };

  return { theme, cycleTheme };
}
