import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';

export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  birth_year: number | null;
  location_region: string | null;
  origin_story: string | null;
  trust_score: number;
  cluster_id: number;
  cluster_confidence: number;
  is_verified: boolean;
  is_human_verified: boolean;
  is_suspended: boolean;
  suspension_reason: string | null;
  bot_score: number;
  invite_count: number;
  invited_by: string | null;
  phone_verified: boolean;
  behavioral_verified: boolean;
  pulse_votes_count: number;
  created_at: string;
  updated_at: string;
}

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  hasCompletedSetup: boolean;

  setSession: (session: Session | null) => void;
  setProfile: (profile: Profile | null) => void;
  setLoading: (loading: boolean) => void;
  setHasCompletedSetup: (completed: boolean) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  profile: null,
  isLoading: true,
  hasCompletedSetup: false,

  setSession: (session) =>
    set({ session, user: session?.user ?? null }),
  setProfile: (profile) =>
    set({ profile, hasCompletedSetup: !!profile?.username }),
  setLoading: (isLoading) => set({ isLoading }),
  setHasCompletedSetup: (hasCompletedSetup) => set({ hasCompletedSetup }),
  reset: () =>
    set({
      session: null,
      user: null,
      profile: null,
      isLoading: false,
      hasCompletedSetup: false,
    }),
}));
