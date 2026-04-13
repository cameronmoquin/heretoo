import { create } from 'zustand';

export interface PulseTopic {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  is_active: boolean;
  created_at: string;
  expires_at: string | null;
  voter_count?: number;
  statement_count?: number;
}

export interface PulseStatement {
  id: string;
  topic_id: string;
  text: string;
  submitted_by: string;
  agree_count: number;
  disagree_count: number;
  pass_count: number;
  bridging_score: number;
  created_at: string;
}

export type VoteType = 'agree' | 'disagree' | 'pass';

interface PulseState {
  topics: PulseTopic[];
  activeTopic: PulseTopic | null;
  statements: PulseStatement[];
  currentStatementIndex: number;
  activeVoterCount: number;

  setTopics: (topics: PulseTopic[]) => void;
  setActiveTopic: (topic: PulseTopic | null) => void;
  setStatements: (statements: PulseStatement[]) => void;
  updateStatement: (statementId: string, updates: Partial<PulseStatement>) => void;
  setCurrentStatementIndex: (index: number) => void;
  advanceStatement: () => void;
  setActiveVoterCount: (count: number) => void;
}

export const usePulseStore = create<PulseState>((set) => ({
  topics: [],
  activeTopic: null,
  statements: [],
  currentStatementIndex: 0,
  activeVoterCount: 0,

  setTopics: (topics) => set({ topics }),
  setActiveTopic: (activeTopic) =>
    set({ activeTopic, currentStatementIndex: 0 }),
  setStatements: (statements) => set({ statements }),
  updateStatement: (statementId, updates) =>
    set((state) => ({
      statements: state.statements.map((s) =>
        s.id === statementId ? { ...s, ...updates } : s
      ),
    })),
  setCurrentStatementIndex: (currentStatementIndex) =>
    set({ currentStatementIndex }),
  advanceStatement: () =>
    set((state) => ({
      currentStatementIndex: Math.min(
        state.currentStatementIndex + 1,
        state.statements.length - 1
      ),
    })),
  setActiveVoterCount: (activeVoterCount) => set({ activeVoterCount }),
}));
