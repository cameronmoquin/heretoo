import { create } from 'zustand';

interface SettingsState {
  fontScale: number; // 1.0 = default, 1.25 = large, 1.5 = extra large, 0.85 = small
  setFontScale: (scale: number) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  fontScale: 1.0,
  setFontScale: (fontScale) => set({ fontScale }),
}));
