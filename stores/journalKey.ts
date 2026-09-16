/**
 * The unlocked journal, for the length of one visit.
 *
 * The password lives HERE and nowhere else: a plain in-memory store,
 * never persisted, never in a query cache, never in AsyncStorage or
 * localStorage. It has to be the password rather than a derived key
 * because every entry carries its own salt (deliberately — two seals of
 * the same words share nothing), so each decrypt derives fresh.
 *
 * It dies with the page. A reload, a closed tab, a sign-out — any of
 * them locks the journal again. That is the cheap half of the promise
 * that nobody reads the entries without the password; lib/vault.ts is
 * the expensive half.
 */

import { create } from 'zustand';

interface JournalKeyState {
  /** Null = locked. */
  password: string | null;
  unlock: (password: string) => void;
  lock: () => void;
}

export const useJournalKey = create<JournalKeyState>((set) => ({
  password: null,
  unlock: (password) => set({ password }),
  lock: () => set({ password: null }),
}));
