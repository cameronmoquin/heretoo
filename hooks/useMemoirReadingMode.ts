/**
 * useMemoirReadingMode. Reading-size scalar for the memoir surface.
 *
 * One knob: text size. 'large' scales the Type.* sizes up for the 65+
 * writer the memoir is built for; 'standard' reads at the app scale.
 * No palette here. The skin engine owns color; this owns size only.
 *
 * Stored in localStorage so the choice survives reloads without a
 * Supabase round-trip. Web-first PWA surface, so window-only is fine.
 */

import { useCallback, useEffect, useState } from 'react';

export type MemoirReadingMode = 'large' | 'standard';
const STORAGE_KEY = 'heretoo:memoir-reading-mode';

/** Multiplier the 'large' mode applies over every Type.* size. */
export const READING_SCALE_LARGE = 1.2;

function readInitial(): MemoirReadingMode {
  if (typeof window === 'undefined') return 'large';
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    // 'large_light' is the pre-reskin value. Read it as large.
    return v === 'standard' ? 'standard' : 'large';
  } catch {
    return 'large';
  }
}

export function useMemoirReadingMode() {
  const [mode, setModeState] = useState<MemoirReadingMode>(readInitial);

  // Re-read once on mount in case SSR/initial-render mismatched.
  useEffect(() => { setModeState(readInitial()); }, []);

  const setMode = useCallback((next: MemoirReadingMode) => {
    setModeState(next);
    if (typeof window !== 'undefined') {
      try { window.localStorage.setItem(STORAGE_KEY, next); } catch {}
    }
  }, []);

  const toggle = useCallback(() => {
    setMode(mode === 'large' ? 'standard' : 'large');
  }, [mode, setMode]);

  const large = mode === 'large';
  const scale = large ? READING_SCALE_LARGE : 1;

  // `elder` is the pre-reskin alias for the large-text mode. Kept so
  // consumers still reading it keep working; the memoir screens use
  // `scale` and `large`.
  return { mode, setMode, toggle, large, scale, elder: large };
}
