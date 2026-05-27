/**
 * useMemoirOnboarded — has the writer seen the memoir intro yet?
 *
 * Stored in localStorage rather than the profile because it's a
 * one-time UI nudge keyed to the device — a grandmother opening the
 * memoir for the first time on a new phone should see the welcome
 * again, which is the right behaviour.
 */

import { useCallback, useEffect, useState } from 'react';

const KEY = 'heretoo:memoir-onboarded';

function read(): boolean {
  if (typeof window === 'undefined') return true; // SSR: skip the gate
  try { return window.localStorage.getItem(KEY) === '1'; }
  catch { return true; }
}

export function useMemoirOnboarded() {
  const [seen, setSeenState] = useState<boolean>(read);

  useEffect(() => { setSeenState(read()); }, []);

  const markSeen = useCallback(() => {
    setSeenState(true);
    if (typeof window !== 'undefined') {
      try { window.localStorage.setItem(KEY, '1'); } catch {}
    }
  }, []);

  const reset = useCallback(() => {
    setSeenState(false);
    if (typeof window !== 'undefined') {
      try { window.localStorage.removeItem(KEY); } catch {}
    }
  }, []);

  return { seen, markSeen, reset };
}
