import { create } from 'zustand';

export type FeedFormat = 'default' | 'instagram' | 'facebook' | 'twitter' | 'snapchat' | 'myspace';

export const FEED_FORMATS: { id: FeedFormat; label: string; description: string }[] = [
  { id: 'default', label: 'HereToo', description: 'Clean. Balanced.' },
  { id: 'twitter', label: 'Text First', description: 'Compact. Words forward.' },
  { id: 'instagram', label: 'Photo First', description: 'Big visuals. Minimal text.' },
  { id: 'facebook', label: 'Classic', description: 'Cards. Reactions. Comments.' },
  { id: 'snapchat', label: 'Stories', description: 'Vertical. Playful.' },
  { id: 'myspace', label: 'Retro', description: 'Customizable. Nostalgic.' },
];

interface FeedFormatState {
  format: FeedFormat;
  myspaceBackground: string;
  setFormat: (format: FeedFormat) => void;
  setMyspaceBackground: (bg: string) => void;
}

export const useFeedFormatStore = create<FeedFormatState>((set) => ({
  format: 'default',
  myspaceBackground: '#000033',
  setFormat: (format) => set({ format }),
  setMyspaceBackground: (myspaceBackground) => set({ myspaceBackground }),
}));
