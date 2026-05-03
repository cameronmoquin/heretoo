/**
 * Theme preference store. Persists to localStorage on web,
 * in-memory on native (we'll wire AsyncStorage when we ship native).
 */
import { create } from 'zustand';
import { Platform } from 'react-native';
import type { ThemeMode } from '../constants/colors';

const STORAGE_KEY = 'heretoo:theme';

function loadInitial(): ThemeMode {
  // Dark mode is disabled for now while we dial in the polish pass —
  // always start in light. We deliberately ignore any persisted value
  // (including 'dark' from earlier sessions) so existing users flip
  // over to light on their next page load.
  return 'light';
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

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: loadInitial(),
  setMode: (mode) => { persist(mode); set({ mode }); },
  toggle: () => {
    const next: ThemeMode = get().mode === 'dark' ? 'light' : 'dark';
    persist(next);
    set({ mode: next });
  },
}));
