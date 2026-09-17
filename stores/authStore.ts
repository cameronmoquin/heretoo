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
  /**
   * The bot gate (migration 098). It is NOT a column on profiles — it
   * lives in public.human_verifications, a table with no write policy,
   * because a gate stored on a row its own subject can PATCH is not a
   * gate. Read-only here; the server is the only writer.
   *
   * null means NOT YET KNOWN (still booting, the query failed, or the
   * migration has not run). Gate on === false, never on falsy: RLS is
   * the real wall, and treating "unknown" as "refused" would lock every
   * verified person out of public the moment a read hiccups.
   */
  verified: boolean | null;
  isLoading: boolean;
  hasCompletedSetup: boolean;

  setSession: (session: Session | null) => void;
  setProfile: (profile: Profile | null) => void;
  setVerified: (verified: boolean | null) => void;
  setLoading: (loading: boolean) => void;
  setHasCompletedSetup: (completed: boolean) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  profile: null,
  verified: null,
  isLoading: true,
  hasCompletedSetup: false,

  setSession: (session) => set({ session, user: session?.user ?? null }),
  setProfile: (profile) =>
    set({ profile, hasCompletedSetup: !!profile?.handle }),
  setVerified: (verified) => set({ verified }),
  setLoading: (isLoading) => set({ isLoading }),
  setHasCompletedSetup: (hasCompletedSetup) => set({ hasCompletedSetup }),
  reset: () =>
    set({
      session: null,
      user: null,
      profile: null,
      verified: null,
      isLoading: false,
      hasCompletedSetup: false,
    }),
}));
