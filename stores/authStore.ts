import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';

/** Profile row shape — matches public.profiles (migration 001). */
export interface Profile {
  id: string;
  handle: string;
  display_name: string | null;
  bio: string | null;
  avatar_path: string | null;
  phone_e164: string | null;
  phone_verified: boolean;
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

  setSession: (session) => set({ session, user: session?.user ?? null }),
  setProfile: (profile) =>
    set({ profile, hasCompletedSetup: !!profile?.handle }),
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
