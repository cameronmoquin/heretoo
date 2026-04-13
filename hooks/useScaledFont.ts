import { useSettingsStore } from '../stores/settingsStore';

/**
 * Returns a scaled font size based on the user's font scale preference.
 * Use this in any component that renders text.
 *
 * Usage: const fs = useScaledFont(); then fontSize: fs(16)
 */
export function useScaledFont() {
  const fontScale = useSettingsStore((s) => s.fontScale);

  return function fs(baseSize: number): number {
    return Math.round(baseSize * fontScale);
  };
}

/**
 * Scale options for the settings screen.
 */
export const FONT_SCALE_OPTIONS = [
  { value: 0.85, label: 'Small' },
  { value: 1.0, label: 'Default' },
  { value: 1.15, label: 'Large' },
  { value: 1.3, label: 'Extra Large' },
] as const;
