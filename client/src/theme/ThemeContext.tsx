import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { ThemeName } from '../api/types.ts';

export const THEMES: { id: ThemeName; name: string; blurb: string; swatch: [string, string, string] }[] = [
  { id: 'after-dark', name: 'After Dark', blurb: 'Cyberpunk terminal. Cyan on near-black.', swatch: ['#060a09', '#27f0d0', '#b7ff3c'] },
  { id: 'dreamscape', name: 'Dreamscape', blurb: 'Twilight anime dusk. Soft and playful.', swatch: ['#1d1736', '#ff8fb8', '#ffd36e'] },
  { id: 'daylight', name: 'Daylight', blurb: 'Illustrated notebook. Warm paper and ink.', swatch: ['#f6efe3', '#b5471f', '#2e6b5a'] },
];

const STORAGE_KEY = 'algoforge.theme';

interface ThemeContextValue {
  theme: ThemeName;
  setTheme: (t: ThemeName) => void;
  reducedMotion: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function isTheme(v: unknown): v is ThemeName {
  return v === 'after-dark' || v === 'dreamscape' || v === 'daylight';
}

export function readStoredTheme(): ThemeName {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (isTheme(v)) return v;
  } catch {
    /* ignore */
  }
  const attr = typeof document !== 'undefined' ? document.documentElement.getAttribute('data-theme') : null;
  return isTheme(attr) ? attr : 'after-dark';
}

export function ThemeProvider({ children, initial }: { children: ReactNode; initial?: ThemeName }) {
  const [theme, setThemeState] = useState<ThemeName>(() => initial ?? readStoredTheme());
  const [reducedMotion, setReducedMotion] = useState(() =>
    typeof window !== 'undefined' && 'matchMedia' in window ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false,
  );

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', THEMES.find((t) => t.id === theme)?.swatch[0] ?? '#060a09');
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('matchMedia' in window)) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, []);

  const setTheme = useCallback((t: ThemeName) => setThemeState(t), []);
  const value = useMemo(() => ({ theme, setTheme, reducedMotion }), [theme, setTheme, reducedMotion]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
