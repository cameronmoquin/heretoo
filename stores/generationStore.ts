/**
 * Generation preference store. Which generation skin the user has
 * chosen. Persists to localStorage on web (mirrors themeStore; native
 * persistence wires to AsyncStorage / profiles.style_prefs later).
 *
 * Free toggle: anyone can pick any generation. Default = boomer, which
 * is today's warm look, so existing users see no change until they opt
 * into a youthful skin.
 */
import { create } from 'zustand';
import { Platform } from 'react-native';
import { GENERATION_ORDER, type Generation } from '../constants/generations';

const STORAGE_KEY = 'heretoo:generation';

function isGeneration(v: unknown): v is Generation {
  return typeof v === 'string' && (GENERATION_ORDER as string[]).includes(v);
}

function loadInitial(): Generation {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (isGeneration(saved)) return saved;
    } catch {}
  }
  // Default skin: Gen Alpha (retro digital glitch). Each user can switch
  // in Profile -> Settings; their choice persists and overrides this.
  return 'alpha';
}

function persist(g: Generation) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try { window.localStorage.setItem(STORAGE_KEY, g); } catch {}
  }
}

interface GenerationState {
  generation: Generation;
  setGeneration: (g: Generation) => void;
  /** Cycle to the next generation in canonical order (Alpha → … → Boomer → Alpha). */
  cycle: () => void;
}

export const useGenerationStore = create<GenerationState>((set, get) => ({
  generation: loadInitial(),
  setGeneration: (g) => { persist(g); set({ generation: g }); },
  cycle: () => {
    const cur = get().generation;
    const i = GENERATION_ORDER.indexOf(cur);
    const next = GENERATION_ORDER[(i + 1) % GENERATION_ORDER.length];
    persist(next);
    set({ generation: next });
  },
}));
