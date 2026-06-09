/**
 * Tracks, per Subject, the timestamp of the most recent activity the
 * viewer has actually seen. Drives the "new activity" dot on the
 * Subjects tab and on each subject row — the in-app half of "win the
 * moment something is happening."
 *
 * Client-side + persisted (localStorage on web, in-memory on native
 * for now — same pattern as themeStore). No migration: a missing key
 * means "never seen," so a subject with any activity reads as new until
 * the viewer opens it. markSeen only ever advances the stored time.
 */
import { create } from 'zustand';
import { Platform } from 'react-native';
import { advanceSeen } from '../lib/subjects-activity';

const STORAGE_KEY = 'heretoo:subjects-seen';

function load(): Record<string, string> {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw) as Record<string, string>;
    } catch {}
  }
  return {};
}

function persist(map: Record<string, string>) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map)); } catch {}
  }
}

interface SubjectsSeenState {
  /** subjectId -> ISO timestamp of the latest activity the viewer has seen. */
  seen: Record<string, string>;
  /** Mark a subject seen up to `atIso`. Only advances (never rewinds). */
  markSeen: (subjectId: string, atIso: string) => void;
}

export const useSubjectsSeenStore = create<SubjectsSeenState>((set, get) => ({
  seen: load(),
  markSeen: (subjectId, atIso) => {
    const next = advanceSeen(get().seen, subjectId, atIso);
    if (!next) return; // missing/older time — no-op
    persist(next);
    set({ seen: next });
  },
}));
