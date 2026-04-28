/**
 * Theme preference store. Persists to localStorage on web,
 * in-memory on native (we'll wire AsyncStorage when we ship native).
 */
import { create } from 'zustand';
import { Platform } from 'react-native';
import type { ThemeMode } from '../constants/colors';

const STORAGE_KEY = 'heretoo:theme';

function loadInitial(): ThemeMode {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      const v = window.localStorage.getItem(STORAGE_KEY);
      if (v === 'light' || v === 'dark') return v;
    } catch {}
  }
  return 'dark';
}

function persist(mode: ThemeMode) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try { window.localStorage.setItem(STORAGE_KEY, mode); } catch {}
  }
}

interface ThemeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
}

/**
 * Note: every StyleSheet.create({...}) in the app captures Colors values at
 * module-load time. Mutating Colors at runtime doesn't propagate to those
 * frozen style sheets. Toggling theme therefore reloads the page on web,
 * which makes module-load happen again with the new palette already set.
 *
 * 200ms flicker — but it actually works. The proper fix (move every
 * StyleSheet.create inside its component so it re-evaluates per render)
 * is a separate refactor.
 */
function reloadIfWeb() {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.location.reload();
  }
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: loadInitial(),
  setMode: (mode) => {
    persist(mode);
    set({ mode });
    reloadIfWeb();
  },
  toggle: () => {
    const next: ThemeMode = get().mode === 'dark' ? 'light' : 'dark';
    persist(next);
    set({ mode: next });
    reloadIfWeb();
  },
}));
