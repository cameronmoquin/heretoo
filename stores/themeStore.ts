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

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: loadInitial(),
  setMode: (mode) => { persist(mode); set({ mode }); },
  toggle: () => {
    const next: ThemeMode = get().mode === 'dark' ? 'light' : 'dark';
    persist(next);
    set({ mode: next });
  },
}));
