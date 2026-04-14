import { create } from 'zustand';

export type PanelMode = 'art' | 'wallet' | 'events' | 'chat' | 'dm' | 'research';

interface PanelState {
  mode: PanelMode;
  isOpen: boolean;
  chatMessages: { id: string; author: string; text: string; time: string }[];
  researchQuery: string;
  setMode: (mode: PanelMode) => void;
  setOpen: (open: boolean) => void;
  addChatMessage: (msg: { author: string; text: string }) => void;
  setResearchQuery: (q: string) => void;
}

export const usePanelStore = create<PanelState>((set) => ({
  mode: 'art',
  isOpen: true,
  chatMessages: [
    { id: '1', author: 'Vega', text: 'Consistency is an argument.', time: '2m' },
    { id: '2', author: 'Sandy Corvo', text: 'Depends on what you are being consistent about.', time: '1m' },
    { id: '3', author: 'Dillon Marsh', text: 'I was consistent about the alpacas and look where that got me.', time: 'now' },
  ],
  researchQuery: '',
  setMode: (mode) => set({ mode }),
  setOpen: (isOpen) => set({ isOpen }),
  addChatMessage: (msg) =>
    set((s) => ({
      chatMessages: [
        ...s.chatMessages,
        { id: String(Date.now()), author: msg.author, text: msg.text, time: 'now' },
      ],
    })),
  setResearchQuery: (researchQuery) => set({ researchQuery }),
}));
