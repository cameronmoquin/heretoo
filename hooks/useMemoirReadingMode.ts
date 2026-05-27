/**
 * useMemoirReadingMode — per-user reading style for the memoir surface.
 *
 * Two modes:
 *   - 'large_light'  cream background, near-black upright type, bigger
 *                    sizes, solid surfaces. The default — built for the
 *                    65+ writer the memoir is actually for.
 *   - 'standard'     the rest-of-app dark ivory/gold aesthetic. Useful
 *                    when a younger user (the granddaughter helping
 *                    set it up, or interviewer mode) prefers the
 *                    brand styling.
 *
 * Stored in localStorage so the choice survives reloads without a
 * Supabase round-trip. Web-only is fine: the memoir is a web-first PWA
 * surface.
 */

import { useCallback, useEffect, useState } from 'react';

export type MemoirReadingMode = 'large_light' | 'standard';
const STORAGE_KEY = 'heretoo:memoir-reading-mode';

function readInitial(): MemoirReadingMode {
  if (typeof window === 'undefined') return 'large_light';
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === 'standard' ? 'standard' : 'large_light';
  } catch {
    return 'large_light';
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
    setMode(mode === 'large_light' ? 'standard' : 'large_light');
  }, [mode, setMode]);

  return { mode, setMode, toggle, elder: mode === 'large_light' };
}
